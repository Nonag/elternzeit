import { markRaw } from 'vue'
import { toast } from 'vue-sonner'
import AppToast from '@/components/dialogs/AppToast.vue'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface NotifyOptions {
  description?: string
  type?: 'success' | 'error'
  action?: ToastAction
  /** Stays until it is closed: news about other people, errors and the result of "Lücken schließen". */
  persistent?: boolean
  /** A toast with the same id replaces the one shown. */
  id?: string
}

const component = markRaw(AppToast)

/**
 * Toasts shown per id. Sonner measures the height of a toast once, when it appears, so a replacement is shown as a new
 * toast instead of changing the old one; otherwise a longer or shorter text jumps when the toasts are hovered.
 */
const shown = new Map<string, string | number>()

/** Shows a toast with a close button, in the layout of the shadcn toast. It closes after 5 seconds, or 10 with more text. */
export function notify(title: string, { description, type, action, persistent = false, id }: NotifyOptions = {}) {
  if (id) dismissToast(id)
  // No id key at all when there is none: Sonner would take an undefined id over its own.
  const toastId = toast.custom(component, {
    duration: persistent ? Number.POSITIVE_INFINITY : description ? 10_000 : 5000,
    componentProps: { title, description, type, action },
  })
  if (id) shown.set(id, toastId)
}

export function dismissToast(id: string) {
  const toastId = shown.get(id)
  if (toastId === undefined) return
  toast.dismiss(toastId)
  shown.delete(id)
}
