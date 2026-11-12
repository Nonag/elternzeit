import { confirmDialog, promptDialog } from '@/lib/dialogs'
import { notify } from '@/lib/toasts'
import { useVariants } from '@/stores/variants'

/** Every switch to another variant gets a toast; with the same id, a quick next switch replaces it. */
function announce(title: string, description?: string) {
  notify(title, { id: 'variant', description })
}

/** Switching, adding and removing variants, and undo and redo, which may switch variants as well. */
export function useVariantActions() {
  const store = useVariants()
  const { state, current } = store

  return {
    select(id: string) {
      if (id === state.currentId) return
      store.select(id)
      announce(`Zu „${current.value.name}“ gewechselt`)
    },
    create() {
      store.create()
      announce(`„${current.value.name}“ angelegt`)
    },
    copy() {
      store.copy()
      announce(`„${current.value.name}“ angelegt`)
    },
    async rename() {
      const name = await promptDialog({ title: 'Variante umbenennen', label: 'Name', value: current.value.name, confirmLabel: 'Umbenennen' })
      if (name) store.rename(name)
    },
    async remove() {
      const name = current.value.name
      if (!(await confirmDialog({ title: `Variante „${name}“ löschen?`, confirmLabel: 'Löschen', destructive: true }))) return
      store.remove(current.value.id)
      announce(`„${name}“ gelöscht`, `Zu „${current.value.name}“ gewechselt.`)
    },
    undo() {
      const { switched, saved } = store.undo()
      if (saved) announce('Letzter Speicherstand wiederhergestellt')
      else if (switched) announce(`Zu „${switched.name}“ gewechselt`, 'Die Änderung dort wurde rückgängig gemacht.')
    },
    redo() {
      const { switched } = store.redo()
      if (switched) announce(`Zu „${switched.name}“ gewechselt`, 'Die Änderung dort wurde wiederholt.')
    },
  }
}
