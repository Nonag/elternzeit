import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

export const MAX_PLANNINGS = 50
const MAX_NAME_LENGTH = 60
const MIN_PASSWORD_LENGTH = 6
const MIN_ADMIN_PASSWORD_LENGTH = 8
const MAX_VARIANTS = 50
/** Remembered sessions kept per planning; older ones are dropped. */
const TOKENS_PER_PLANNING = 20

export type StoreErrorCode =
  | 'invalid-name'
  | 'password-too-short'
  | 'name-taken'
  | 'limit-reached'
  | 'invalid-data'
  | 'admin-exists'

export class StoreError extends Error {
  code: StoreErrorCode
  constructor(code: StoreErrorCode) {
    super(code)
    this.code = code
  }
}

export interface PlanningRecord {
  name: string
  data: unknown
  version: number
  savedAt: string
}

export interface PlanningInfo {
  id: number
  name: string
  createdAt: string
  openedAt: string | null
  savedAt: string
}

export type SaveResult = { ok: true; version: number; savedAt: string } | { ok: false; current: PlanningRecord }

interface PlanningRow {
  id: number
  name: string
  password_hash: string
  data: string
  version: number
  created_at: string
  opened_at: string | null
  saved_at: string
}

function hashPassword(password: string): string {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${scryptSync(password, salt, 32).toString('hex')}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, 'hex'), expected.length), expected)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** A planning is the export format of the app: an object with a non-empty list of variants. */
function serializeData(data: unknown): string {
  const variants = (data as { variants?: unknown } | null)?.variants
  if (!Array.isArray(variants) || !variants.length || variants.length > MAX_VARIANTS) throw new StoreError('invalid-data')
  return JSON.stringify(data)
}

function record(row: PlanningRow): PlanningRecord {
  return { name: row.name, data: JSON.parse(row.data), version: row.version, savedAt: row.saved_at }
}

export type Store = ReturnType<typeof openStore>

export function openStore(file: string, { maxPlannings = MAX_PLANNINGS } = {}) {
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS plannings (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      data TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      opened_at TEXT,
      saved_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tokens (
      token_hash TEXT PRIMARY KEY,
      planning_id INTEGER NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
  `)
  const now = () => new Date().toISOString()

  const byName = db.prepare('SELECT * FROM plannings WHERE name = ?')
  const byToken = db.prepare('SELECT p.* FROM plannings p JOIN tokens t ON t.planning_id = p.id WHERE t.token_hash = ?')

  function issueToken(planningId: number): string {
    const token = randomBytes(32).toString('base64url')
    db.prepare('INSERT INTO tokens (token_hash, planning_id, created_at) VALUES (?, ?, ?)').run(hashToken(token), planningId, now())
    db.prepare(
      `DELETE FROM tokens WHERE planning_id = ? AND token_hash NOT IN
        (SELECT token_hash FROM tokens WHERE planning_id = ? ORDER BY created_at DESC LIMIT ${TOKENS_PER_PLANNING})`,
    ).run(planningId, planningId)
    return token
  }

  const count = () => (db.prepare('SELECT COUNT(*) AS n FROM plannings').get() as { n: number }).n

  function adminHash(): string | undefined {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string } | undefined
    return row?.value
  }

  return {
    close: () => db.close(),
    limit: maxPlannings,

    adminConfigured: () => adminHash() !== undefined,

    setupAdmin(password: string) {
      if (adminHash() !== undefined) throw new StoreError('admin-exists')
      if (password.length < MIN_ADMIN_PASSWORD_LENGTH) throw new StoreError('password-too-short')
      db.prepare("INSERT INTO settings (key, value) VALUES ('admin_password', ?)").run(hashPassword(password))
    },

    checkAdmin(password: string): boolean {
      const hash = adminHash()
      return hash !== undefined && verifyPassword(password, hash)
    },

    count,

    create(name: string, password: string, data: unknown): PlanningRecord & { token: string } {
      const trimmed = name.trim()
      if (!trimmed || trimmed.length > MAX_NAME_LENGTH) throw new StoreError('invalid-name')
      if (password.length < MIN_PASSWORD_LENGTH) throw new StoreError('password-too-short')
      const serialized = serializeData(data)
      if (byName.get(trimmed)) throw new StoreError('name-taken')
      if (count() >= maxPlannings) throw new StoreError('limit-reached')
      const timestamp = now()
      const { lastInsertRowid } = db
        .prepare('INSERT INTO plannings (name, password_hash, data, version, created_at, opened_at, saved_at) VALUES (?, ?, ?, 1, ?, ?, ?)')
        .run(trimmed, hashPassword(password), serialized, timestamp, timestamp, timestamp)
      return { name: trimmed, data, version: 1, savedAt: timestamp, token: issueToken(Number(lastInsertRowid)) }
    },

    /** Checks name and password and returns a session token, or null. */
    openSession(name: string, password: string): { name: string; token: string } | null {
      const row = byName.get(name.trim()) as PlanningRow | undefined
      if (!row || !verifyPassword(password, row.password_hash)) return null
      return { name: row.name, token: issueToken(row.id) }
    },

    /** Id of the planning a session belongs to, or null if the token is unknown. */
    planningId(token: string): number | null {
      const row = byToken.get(hashToken(token)) as PlanningRow | undefined
      return row ? row.id : null
    },

    load(token: string): PlanningRecord | null {
      const row = byToken.get(hashToken(token)) as PlanningRow | undefined
      if (!row) return null
      db.prepare('UPDATE plannings SET opened_at = ? WHERE id = ?').run(now(), row.id)
      return record(row)
    },

    /** Saves only on top of the version the client loaded, unless `force` is set. Null if the token is unknown. */
    save(token: string, data: unknown, baseVersion: number, force: boolean): SaveResult | null {
      const row = byToken.get(hashToken(token)) as PlanningRow | undefined
      if (!row) return null
      const serialized = serializeData(data)
      if (!force && row.version !== baseVersion) return { ok: false, current: record(row) }
      const savedAt = now()
      db.prepare('UPDATE plannings SET data = ?, version = ?, saved_at = ? WHERE id = ?').run(serialized, row.version + 1, savedAt, row.id)
      return { ok: true, version: row.version + 1, savedAt }
    },

    /** Deletes the planning a session belongs to; false if the token is unknown. */
    removeByToken(token: string): boolean {
      const row = byToken.get(hashToken(token)) as PlanningRow | undefined
      if (!row) return false
      db.prepare('DELETE FROM plannings WHERE id = ?').run(row.id)
      return true
    },

    list(): PlanningInfo[] {
      const rows = db.prepare('SELECT id, name, created_at, opened_at, saved_at FROM plannings ORDER BY name').all() as unknown as PlanningRow[]
      return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, openedAt: r.opened_at, savedAt: r.saved_at }))
    },

    remove(ids: number[]): number {
      const statement = db.prepare('DELETE FROM plannings WHERE id = ?')
      let removed = 0
      for (const id of ids) removed += Number(statement.run(id).changes)
      return removed
    },
  }
}
