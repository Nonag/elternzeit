import { computed, reactive, ref } from 'vue'
import * as api from '@/lib/planningApi'
import { parsePlanning, useVariants } from './variants'

const server = reactive<{ status: api.ServerStatus | null }>({ status: null })
let statusRequested = false

/** Mirror of the stored session, so the UI can tell whether saving will ask for the password. */
const session = ref<api.Session | null>(api.loadSession())

function rememberSession(value: api.Session, remember: boolean) {
  api.storeSession(value, remember)
  session.value = value
}

function forgetSession() {
  api.clearSession()
  session.value = null
}

export async function refreshServerStatus() {
  server.status = await api.fetchStatus()
}

export type PlanningDialogMode = 'open' | 'create' | 'password'

export type SaveOutcome =
  | { status: 'saved' | 'unchanged' | 'needs-name' | 'needs-password' }
  | { status: 'conflict'; current: api.RemotePlanning }

/** Opening, saving and deleting the planning on the sync server. */
export function usePlanning() {
  const store = useVariants()
  if (!statusRequested) {
    statusRequested = true
    void refreshServerStatus()
  }

  /** Session of the open planning, if this browser still has one. */
  const currentSession = computed(() => {
    const name = store.state.planning.name
    return name && session.value?.name.toLowerCase() === name.toLowerCase() ? session.value : null
  })

  /** Replaces the local variants with the server state. */
  function adopt(remote: api.RemotePlanning) {
    store.replaceVariants(parsePlanning(remote.data))
    store.markSaved(remote.name, remote.version, remote.savedAt)
  }

  return {
    server,
    adopt,
    /** Saving asks for a name (first save) or the password (not remembered). */
    saveNeedsInput: computed(() => !currentSession.value),

    async open(name: string, password: string, remember: boolean) {
      const opened = await api.openSession(name, password)
      const remote = await api.loadPlanning(opened.token)
      rememberSession(opened, remember)
      adopt(remote)
    },

    async create(name: string, password: string, remember: boolean) {
      const snapshot = store.snapshot()
      const created = await api.createPlanning(name, password, store.planningData())
      rememberSession({ name: created.name, token: created.token }, remember)
      store.markSaved(created.name, created.version, created.savedAt, snapshot)
      void refreshServerStatus()
    },

    /** Asks the server for a new session of the open planning, e.g. when the password was not remembered. */
    async authenticate(password: string, remember: boolean) {
      const name = store.state.planning.name
      if (!name) throw new Error('No planning is open')
      rememberSession(await api.openSession(name, password), remember)
    },

    async save(force = false): Promise<SaveOutcome> {
      const { name, version } = store.state.planning
      if (!name || version === null) return { status: 'needs-name' }
      if (!force && !store.unsaved.value) return { status: 'unchanged' }
      const token = currentSession.value?.token
      if (!token) return { status: 'needs-password' }
      const snapshot = store.snapshot()
      try {
        const saved = await api.savePlanning(token, store.planningData(), version, force)
        store.markSaved(name, saved.version, saved.savedAt, snapshot)
        return { status: 'saved' }
      } catch (error) {
        if (error instanceof api.ApiError && error.status === 401) {
          forgetSession()
          return { status: 'needs-password' }
        }
        if (error instanceof api.ApiError && error.status === 409) {
          return { status: 'conflict', current: error.payload.current as api.RemotePlanning }
        }
        throw error
      }
    },

    /** Deletes the open planning on the server; the variants stay in this browser as a new planning. */
    async remove(): Promise<'deleted' | 'needs-password'> {
      const token = currentSession.value?.token
      if (!token) return 'needs-password'
      try {
        await api.deletePlanning(token)
      } catch (error) {
        if (error instanceof api.ApiError && error.status === 401) {
          forgetSession()
          return 'needs-password'
        }
        throw error
      }
      forgetSession()
      store.forgetPlanning()
      void refreshServerStatus()
      return 'deleted'
    },
  }
}
