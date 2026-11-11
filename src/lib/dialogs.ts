import { useConfirmDialog } from '@vueuse/core'
import { shallowRef } from 'vue'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  /** null hides the cancel button (plain message). */
  cancelLabel?: string | null
  destructive?: boolean
}

/** One app-wide confirmation dialog, rendered by ConfirmDialog.vue, instead of window.confirm and window.alert. */
export const confirmation = useConfirmDialog<ConfirmOptions>()
export const confirmationOptions = shallowRef<ConfirmOptions | null>(null)
confirmation.onReveal((options) => (confirmationOptions.value = options ?? null))

export async function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  const { isCanceled } = await confirmation.reveal(options)
  return !isCanceled
}

export async function messageDialog(title: string, description?: string): Promise<void> {
  await confirmation.reveal({ title, description, confirmLabel: 'OK', cancelLabel: null })
}

export interface PromptOptions {
  title: string
  label: string
  value: string
  confirmLabel?: string
}

/** One app-wide input dialog, rendered by PromptDialog.vue, instead of window.prompt. */
export const prompt = useConfirmDialog<PromptOptions, string>()
export const promptOptions = shallowRef<PromptOptions | null>(null)
prompt.onReveal((options) => (promptOptions.value = options ?? null))

/** Resolves with the entered text, or null if the dialog was cancelled. */
export async function promptDialog(options: PromptOptions): Promise<string | null> {
  const result = await prompt.reveal(options)
  return result.isCanceled ? null : (result.data ?? null)
}
