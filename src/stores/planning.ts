import { reactive } from 'vue'
import * as api from '@/lib/planningApi'
import { parsePlanning, useScenarios } from './scenarios'

const server = reactive<{ status: api.ServerStatus | null }>({ status: null })
let statusRequested = false

export async function refreshServerStatus() {
  server.status = await api.fetchStatus()
}

export type PlanningDialogMode = 'open' | 'create' | 'password'

export type SaveOutcome =
  | { status: 'saved' | 'unchanged' | 'needs-name' | 'needs-password' }
  | { status: 'conflict'; current: api.RemotePlanning }

/** Opening and saving the planning on the sync server. */
export function usePlanning() {
  const store = useScenarios()
  if (!statusRequested) {
    statusRequested = true
    void refreshServerStatus()
  }

  /** Replaces the local variants with the server state. */
  function adopt(remote: api.RemotePlanning) {
    store.replaceScenarios(parsePlanning(remote.data))
    store.markSaved(remote.name, remote.version, remote.savedAt)
  }

  return {
    server,
    adopt,

    async open(name: string, password: string, remember: boolean) {
      const session = await api.login(name, password)
      const remote = await api.loadPlanning(session.token)
      api.storeSession(session, remember)
      adopt(remote)
    },

    async create(name: string, password: string, remember: boolean) {
      const snapshot = store.snapshot()
      const created = await api.createPlanning(name, password, store.planningData())
      api.storeSession({ name: created.name, token: created.token }, remember)
      store.markSaved(created.name, created.version, created.savedAt, snapshot)
      void refreshServerStatus()
    },

    /** Signs in again for the open planning, e.g. after the browser forgot the session. */
    async authenticate(password: string, remember: boolean) {
      const name = store.state.planning.name
      if (!name) throw new Error('No planning is open')
      api.storeSession(await api.login(name, password), remember)
    },

    async save(force = false): Promise<SaveOutcome> {
      const { name, version } = store.state.planning
      if (!name || version === null) return { status: 'needs-name' }
      if (!force && !store.dirty.value) return { status: 'unchanged' }
      const session = api.loadSession()
      if (!session || session.name.toLowerCase() !== name.toLowerCase()) return { status: 'needs-password' }
      const snapshot = store.snapshot()
      try {
        const saved = await api.savePlanning(session.token, store.planningData(), version, force)
        store.markSaved(name, saved.version, saved.savedAt, snapshot)
        return { status: 'saved' }
      } catch (error) {
        if (error instanceof api.ApiError && error.status === 401) {
          api.clearSession()
          return { status: 'needs-password' }
        }
        if (error instanceof api.ApiError && error.status === 409) {
          return { status: 'conflict', current: error.payload.current as api.RemotePlanning }
        }
        throw error
      }
    },
  }
}
