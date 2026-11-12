import { useEventListener, useIntervalFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { createId } from '@/engine/plan'
import * as api from '@/lib/planningApi'
import { usePlanning } from './planning'
import { userName } from './user'
import { useVariants } from './variants'

const CLIENT_KEY = 'elternzeit-planer:client'
/** Alone a check every 15 seconds is enough; with others it is every 5 seconds. */
const ALONE_MS = 15_000
const SHARED_MS = 5_000

/** One id per browser, so all tabs count as one person. */
const client = localStorage.getItem(CLIENT_KEY) ?? createId('client')
localStorage.setItem(CLIENT_KEY, client)

const others = ref<api.PresenceEntry[]>([])
/** Token the list belongs to, so a change of planning is not taken for people leaving. */
const reportedFor = ref<string | null>(null)
/** Saved state on the server at the last check. */
const head = ref<{ token: string; version: number; savedAt: string; savedBy: string | null } | null>(null)
let started = false

const leave = (token: string) => void api.reportPresence(token, client, '', true).catch(() => {})

function start() {
  const { currentSession } = usePlanning()
  const token = () => currentSession.value?.token

  async function report() {
    const current = token()
    if (!current) {
      reportedFor.value = null
      others.value = []
      head.value = null
      return
    }
    try {
      const { others: list, version, savedAt, savedBy } = await api.reportPresence(current, client, userName.value)
      reportedFor.value = current
      others.value = list
      head.value = { token: current, version, savedAt, savedBy }
    } catch {
      // Keep the last state: a short network problem is not people leaving.
    }
  }

  useIntervalFn(report, computed(() => (others.value.length ? SHARED_MS : ALONE_MS)))
  watch([token, userName], ([current], [previous]) => {
    if (previous && previous !== current) leave(previous)
    void report()
  })
  // Hidden tabs are slowed down by the browser; coming back checks at once.
  useEventListener(document, 'visibilitychange', () => document.visibilityState === 'visible' && void report())
  useEventListener('pagehide', () => {
    const current = token()
    if (current) leave(current)
  })
  void report()
}

/** Others who have the open planning open right now, and a newer saved state from elsewhere. */
export function usePresence() {
  if (!started) {
    started = true
    start()
  }
  const { state } = useVariants()
  const { currentSession } = usePlanning()
  /** The saved state on the server, if it is newer than the one this browser has. */
  const newerOnServer = computed(() => {
    const saved = head.value
    const version = state.planning.version
    return saved && saved.token === currentSession.value?.token && version !== null && saved.version > version ? saved : null
  })
  return { others, reportedFor, newerOnServer }
}
