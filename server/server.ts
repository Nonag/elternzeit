import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { gzipSync } from 'node:zlib'
import { StoreError, type Store, type StoreErrorCode } from './store.ts'

const MAX_BODY_BYTES = 1_000_000

class HttpError extends Error {
  status: number
  constructor(status: number, code: string) {
    super(code)
    this.status = status
  }
}

const STORE_ERROR_STATUS: Record<StoreErrorCode, number> = {
  'invalid-name': 400,
  'password-too-short': 400,
  'invalid-data': 400,
  'name-taken': 409,
  'admin-exists': 409,
  'limit-reached': 403,
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'too-large')
    chunks.push(chunk as Buffer)
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>
  } catch {
    // handled below
  }
  throw new HttpError(400, 'bad-json')
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function credentials(req: IncomingMessage, scheme: 'Bearer' | 'Basic'): string {
  const header = req.headers.authorization ?? ''
  if (!header.startsWith(`${scheme} `)) return ''
  const value = header.slice(scheme.length + 1)
  if (scheme === 'Bearer') return value
  // Basic auth: the user name is ignored, only the password counts.
  const decoded = Buffer.from(value, 'base64').toString('utf8')
  return decoded.slice(decoded.indexOf(':') + 1)
}

export interface AppOptions {
  /** The built single-file app, or null if it is missing (development). */
  html: Buffer | null
  /** Delay before answering a failed login, against password guessing. */
  failedLoginDelayMs?: number
}

export function createApp(store: Store, { html, failedLoginDelayMs = 1000 }: AppOptions): Server {
  const gzippedHtml = html ? gzipSync(html) : null

  async function unauthorized(res: ServerResponse) {
    await new Promise((resolve) => setTimeout(resolve, failedLoginDelayMs))
    send(res, 401, { error: 'unauthorized' })
  }

  function serveApp(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method-not-allowed' })
    if (!html || !gzippedHtml) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('dist/index.html is missing, run "npm run build" first.')
    }
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')
    const body = gzip ? gzippedHtml : html
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept-Encoding',
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    })
    res.end(req.method === 'HEAD' ? undefined : body)
  }

  async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
    switch (`${req.method} ${path}`) {
      case 'GET /api/status':
        return send(res, 200, { adminConfigured: store.adminConfigured(), count: store.count(), limit: store.limit })

      case 'POST /api/admin/setup': {
        const { password } = await readJson(req)
        store.setupAdmin(text(password))
        return send(res, 201, {})
      }

      case 'GET /api/admin/plannings':
        if (!store.checkAdmin(credentials(req, 'Basic'))) return unauthorized(res)
        return send(res, 200, { plannings: store.list(), limit: store.limit })

      case 'POST /api/admin/plannings/delete': {
        if (!store.checkAdmin(credentials(req, 'Basic'))) return unauthorized(res)
        const { ids } = await readJson(req)
        const valid = Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id)) : []
        return send(res, 200, { deleted: store.remove(valid) })
      }

      case 'POST /api/planning': {
        const { name, password, data } = await readJson(req)
        const created = store.create(text(name), text(password), data)
        return send(res, 201, { name: created.name, token: created.token, version: created.version, savedAt: created.savedAt })
      }

      case 'POST /api/planning/session': {
        const { name, password } = await readJson(req)
        const session = store.login(text(name), text(password))
        return session ? send(res, 200, session) : unauthorized(res)
      }

      case 'GET /api/planning': {
        const planning = store.load(credentials(req, 'Bearer'))
        return planning ? send(res, 200, planning) : unauthorized(res)
      }

      case 'PUT /api/planning': {
        const { data, baseVersion, force } = await readJson(req)
        const result = store.save(credentials(req, 'Bearer'), data, Number(baseVersion), force === true)
        if (!result) return unauthorized(res)
        return result.ok ? send(res, 200, { version: result.version, savedAt: result.savedAt }) : send(res, 409, { error: 'conflict', current: result.current })
      }

      case 'DELETE /api/planning':
        return store.removeByToken(credentials(req, 'Bearer')) ? send(res, 200, {}) : unauthorized(res)

      default:
        return send(res, 404, { error: 'not-found' })
    }
  }

  return createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (!path.startsWith('/api/')) return serveApp(req, res)
    try {
      await handleApi(req, res, path)
    } catch (error) {
      if (error instanceof StoreError) return send(res, STORE_ERROR_STATUS[error.code], { error: error.code })
      if (error instanceof HttpError) return send(res, error.status, { error: error.message })
      console.error(error)
      send(res, 500, { error: 'server-error' })
    }
  })
}
