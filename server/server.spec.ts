import { get, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './server.ts'
import { openStore, type Store } from './store.ts'

let store: Store
let server: Server
let base: string

beforeEach(async () => {
  store = openStore(':memory:', { maxPlannings: 3 })
  server = createApp(store, { html: Buffer.from('<!doctype html><title>Elternzeit-Planer</title>'), unauthorizedDelayMs: 0 })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(() => {
  server.close()
  store.close()
})

async function api(method: string, path: string, options: { body?: unknown; token?: string; admin?: string } = {}) {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  if (options.admin) headers.Authorization = `Basic ${Buffer.from(`admin:${options.admin}`).toString('base64')}`
  const response = await fetch(base + path, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) })
  return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, any> }
}

function rawGet(path: string, headers: Record<string, string>): Promise<{ headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    get(base + path, { headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }))
    }).on('error', reject)
  })
}

const planning = (name = 'Variante A') => ({ app: 'elternzeit-planer', version: 2, variants: [{ id: 's1', name, config: {} }] })

describe('server', () => {
  it('serves the app for every path outside /api, compressed on request', async () => {
    for (const path of ['/', '/admin']) {
      const plain = await rawGet(path, {})
      expect(plain.headers['content-type']).toContain('text/html')
      expect(plain.body.toString()).toContain('<title>Elternzeit-Planer</title>')
    }
    const gzipped = await rawGet('/', { 'Accept-Encoding': 'gzip' })
    expect(gzipped.headers['content-encoding']).toBe('gzip')
    expect(gunzipSync(gzipped.body).toString()).toContain('<title>Elternzeit-Planer</title>')
  })

  it('creates, opens and saves a planning and detects conflicting saves', async () => {
    const created = await api('POST', '/api/planning', { body: { name: 'Familie', password: 'geheim1', data: planning() } })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ name: 'Familie', version: 1 })

    expect((await api('POST', '/api/planning', { body: { name: 'familie', password: 'geheim1', data: planning() } })).body.error).toBe('name-taken')
    expect((await api('POST', '/api/planning', { body: { name: 'Kurz', password: '123', data: planning() } })).body.error).toBe('password-too-short')
    expect((await api('POST', '/api/planning', { body: { name: 'Leer', password: 'geheim1', data: {} } })).body.error).toBe('invalid-data')

    expect((await api('POST', '/api/planning/session', { body: { name: 'Familie', password: 'falsch' } })).status).toBe(401)
    const session = await api('POST', '/api/planning/session', { body: { name: 'FAMILIE', password: 'geheim1' } })
    expect(session.body.name).toBe('Familie')

    const loaded = await api('GET', '/api/planning', { token: session.body.token })
    expect(loaded.body).toMatchObject({ name: 'Familie', version: 1, data: planning() })

    const first = await api('PUT', '/api/planning', { token: created.body.token, body: { data: planning('Variante B'), baseVersion: 1 } })
    expect(first.body.version).toBe(2)

    const conflict = await api('PUT', '/api/planning', { token: session.body.token, body: { data: planning('Variante C'), baseVersion: 1 } })
    expect(conflict.status).toBe(409)
    expect(conflict.body.current).toMatchObject({ version: 2, data: planning('Variante B') })

    const forced = await api('PUT', '/api/planning', { token: session.body.token, body: { data: planning('Variante C'), baseVersion: 1, force: true } })
    expect(forced.body.version).toBe(3)
    expect((await api('GET', '/api/planning', { token: 'unbekannt' })).status).toBe(401)
  })

  it('lets the people who opened a planning delete it', async () => {
    const created = await api('POST', '/api/planning', { body: { name: 'Familie', password: 'geheim1', data: planning() } })
    const other = await api('POST', '/api/planning/session', { body: { name: 'Familie', password: 'geheim1' } })
    expect((await api('DELETE', '/api/planning', { token: 'unbekannt' })).status).toBe(401)
    expect((await api('DELETE', '/api/planning', { token: created.body.token })).status).toBe(200)
    expect((await api('GET', '/api/planning', { token: other.body.token })).status).toBe(401)
    expect((await api('GET', '/api/status')).body.count).toBe(0)
  })

  it('limits the number of plannings', async () => {
    for (const name of ['A', 'B', 'C']) {
      expect((await api('POST', '/api/planning', { body: { name, password: 'geheim1', data: planning() } })).status).toBe(201)
    }
    const blocked = await api('POST', '/api/planning', { body: { name: 'D', password: 'geheim1', data: planning() } })
    expect(blocked).toMatchObject({ status: 403, body: { error: 'limit-reached' } })
    expect((await api('GET', '/api/status')).body).toMatchObject({ count: 3, limit: 3 })
  })

  it('sets the admin password once and lets the admin list and delete plannings', async () => {
    expect((await api('GET', '/api/status')).body.adminConfigured).toBe(false)
    expect((await api('POST', '/api/admin/setup', { body: { password: 'kurz' } })).body.error).toBe('password-too-short')
    expect((await api('POST', '/api/admin/setup', { body: { password: 'admin-geheim' } })).status).toBe(201)
    expect((await api('POST', '/api/admin/setup', { body: { password: 'anderes-geheim' } })).body.error).toBe('admin-exists')
    expect((await api('GET', '/api/status')).body.adminConfigured).toBe(true)

    const created = await api('POST', '/api/planning', { body: { name: 'Familie', password: 'geheim1', data: planning() } })
    expect((await api('GET', '/api/admin/plannings', { admin: 'falsch' })).status).toBe(401)
    const list = await api('GET', '/api/admin/plannings', { admin: 'admin-geheim' })
    expect(list.body.plannings).toHaveLength(1)
    expect(list.body.plannings[0]).toMatchObject({ name: 'Familie' })
    expect(list.body.plannings[0].createdAt).toBeTruthy()

    const deleted = await api('POST', '/api/admin/plannings/delete', { admin: 'admin-geheim', body: { ids: [list.body.plannings[0].id] } })
    expect(deleted.body.deleted).toBe(1)
    expect((await api('GET', '/api/planning', { token: created.body.token })).status).toBe(401)
  })
})
