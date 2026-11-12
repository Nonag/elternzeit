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
  /** Stays until it is closed: news about other people and errors. All others close after 5 seconds. */
  persistent?: boolean
  /** A toast with the same id replaces the one shown. */
  id?: string
}

const component = markRaw(AppToast)

/** Shows a toast with a close button, in the layout of the shadcn toast. */
export function notify(title: string, { description, type, action, persistent = false, id }: NotifyOptions = {}) {
  toast.custom(component, {
    id,
    duration: persistent ? Number.POSITIVE_INFINITY : 5000,
    componentProps: { title, description, type, action },
  })
}

export const dismissToast = (id: string) => toast.dismiss(id)
