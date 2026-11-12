/** Client for the optional sync server (server/). */

/** Same limits as in server/store.ts. */
export const MIN_PASSWORD_LENGTH = 6
export const MIN_ADMIN_PASSWORD_LENGTH = 8

export type ServerStatus =
  | { available: true; adminConfigured: boolean; count: number; limit: number }
  | { available: false; reason: 'file' | 'unreachable' }

export interface RemotePlanning {
  name: string
  data: unknown
  version: number
  savedAt: string
  savedBy: string | null
}

export interface AdminPlanning {
  id: number
  name: string
  createdAt: string
  openedAt: string | null
  savedAt: string
}

export class ApiError extends Error {
  status: number
  payload: Record<string, unknown>
  constructor(status: number, payload: Record<string, unknown>) {
    super(typeof payload.error === 'string' ? payload.error : `HTTP ${status}`)
    this.status = status
    this.payload = payload
  }
}

interface RequestOptions {
  body?: unknown
  token?: string
  adminPassword?: string
  /** Lets the request finish while the page is closed. */
  keepalive?: boolean
}

function basicAuth(password: string): string {
  // btoa only accepts Latin-1, so encode the UTF-8 bytes first.
  const bytes = new TextEncoder().encode(`admin:${password}`)
  return `Basic ${btoa(String.fromCharCode(...bytes))}`
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  if (options.adminPassword) headers.Authorization = basicAuth(options.adminPassword)
  const response = await fetch(`/api/${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    keepalive: options.keepalive,
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) throw new ApiError(response.status, payload)
  return payload as T
}

export async function fetchStatus(): Promise<ServerStatus> {
  if (location.protocol === 'file:') return { available: false, reason: 'file' }
  try {
    const status = await request<{ adminConfigured: boolean; count: number; limit: number }>('GET', 'status')
    return { available: true, ...status }
  } catch {
    return { available: false, reason: 'unreachable' }
  }
}

export const setupAdmin = (password: string) => request<object>('POST', 'admin/setup', { body: { password } })

export const listPlannings = (adminPassword: string) =>
  request<{ plannings: AdminPlanning[]; limit: number }>('GET', 'admin/plannings', { adminPassword })

export const deletePlannings = (adminPassword: string, ids: number[]) =>
  request<{ deleted: number }>('POST', 'admin/plannings/delete', { adminPassword, body: { ids } })

export const createPlanning = (name: string, password: string, data: unknown, savedBy: string) =>
  request<{ name: string; token: string; version: number; savedAt: string }>('POST', 'planning', { body: { name, password, data, savedBy } })

export const openSession = (name: string, password: string) =>
  request<{ name: string; token: string }>('POST', 'planning/session', { body: { name, password } })

export const loadPlanning = (token: string) => request<RemotePlanning>('GET', 'planning', { token })

export const savePlanning = (token: string, data: unknown, baseVersion: number, savedBy: string, force = false) =>
  request<{ version: number; savedAt: string }>('PUT', 'planning', { token, body: { data, baseVersion, force, savedBy } })

export const deletePlanning = (token: string) => request<object>('DELETE', 'planning', { token })

/** Another browser with the same planning open. */
export interface PresenceEntry {
  client: string
  name: string
}

/** Tells the server this browser has the planning open (or left it) and returns the other browsers. */
export interface PresenceReport {
  others: PresenceEntry[]
  /** Saved state on the server, to notice saves from elsewhere. */
  version: number
  savedAt: string
  savedBy: string | null
}

export const reportPresence = (token: string, client: string, name: string, leave = false) =>
  request<PresenceReport>('POST', 'planning/presence', { token, body: { client, name, leave }, keepalive: leave })

/** Server session of this browser; kept in localStorage if the password is remembered on this device. */
export interface Session {
  name: string
  token: string
}

const SESSION_KEY = 'elternzeit-planer:session'

export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY)
  try {
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function storeSession(session: Session, remember: boolean) {
  clearSession()
  ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}
