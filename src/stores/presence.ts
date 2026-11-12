import { useEventListener, useIntervalFn, useLocalStorage } from '@vueuse/core'
import { ref, watch } from 'vue'
import { createId } from '@/engine/plan'
import * as api from '@/lib/planningApi'
import { usePlanning } from './planning'

const NAME_KEY = 'elternzeit-planer:user-name'
const CLIENT_KEY = 'elternzeit-planer:client'
const HEARTBEAT_MS = 15_000

/** Own name, shown to others who have the same planning open. */
export const userName = useLocalStorage(NAME_KEY, '')

/** One id per browser, so all tabs count as one person. */
const client = localStorage.getItem(CLIENT_KEY) ?? createId('client')
localStorage.setItem(CLIENT_KEY, client)

const others = ref<api.PresenceEntry[]>([])
let started = false

const leave = (token: string) => void api.reportPresence(token, client, '', true).catch(() => {})

function start() {
  const { currentSession } = usePlanning()
  const token = () => currentSession.value?.token

  async function report() {
    const current = token()
    if (!current) {
      others.value = []
      return
    }
    try {
      others.value = (await api.reportPresence(current, client, userName.value)).others
    } catch {
      others.value = []
    }
  }

  useIntervalFn(report, HEARTBEAT_MS)
  watch([token, userName], ([current], [previous]) => {
    if (previous && previous !== current) leave(previous)
    void report()
  })
  useEventListener('pagehide', () => {
    const current = token()
    if (current) leave(current)
  })
  void report()
}

/** Others who have the open planning open in their browser right now. */
export function usePresence() {
  if (!started) {
    started = true
    start()
  }
  return { others, userName }
}
