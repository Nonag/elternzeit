import { computed, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { formatTimestamp } from '@/engine/format'
import { confirmDialog, messageDialog } from '@/lib/dialogs'
import { PERSISTENT } from '@/lib/toasts'
import { ApiError } from '@/lib/planningApi'
import { usePlanning, type MergeInput, type PlanningDialogMode, type SaveOutcome } from '@/stores/planning'
import { usePresence } from '@/stores/presence'
import { parsePlanning, useVariants, type Variant } from '@/stores/variants'

const ERROR_TEXT: Record<string, string> = {
  unauthorized: 'Name oder Passwort stimmt nicht.',
  'name-taken': 'Diesen Namen gibt es schon. Bitte einen anderen wählen.',
  'limit-reached': 'Auf dem Server ist kein Platz für weitere Planungen.',
  'password-too-short': 'Das Passwort ist zu kurz.',
  'invalid-name': 'Der Name ist zu lang.',
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) return ERROR_TEXT[error.message] ?? 'Das hat nicht geklappt. Bitte später noch einmal versuchen.'
  return 'Der Server ist nicht erreichbar.'
}

// One planning dialog and one save conflict for the whole header, so the menu and the save button share them.
const dialog = reactive({ open: false, mode: 'open' as PlanningDialogMode, busy: false, error: null as string | null })
/** What the password dialog continues with. */
const passwordPurpose = ref<'save' | 'delete'>('save')
const conflict = reactive({ open: false, input: null as MergeInput | null })

/** Opening, saving, importing and deleting the planning, with the dialogs and toasts they need. */
export function usePlanningActions() {
  const store = useVariants()
  const planning = usePlanning()
  const { state, unsaved, isBlank } = store
  const { newerOnServer } = usePresence()

  // Server functions stay visible everywhere and are only disabled without a server.
  const serverReady = computed(() => planning.server.status?.available === true)
  const serverHint = computed(() => {
    const status = planning.server.status
    if (!status) return 'Verbindung zum Server wird geprüft …'
    return status.available === false && status.reason === 'file'
      ? 'In der Offline-Datei nicht verfügbar, nur in der Server-Version.'
      : 'Der Server ist nicht erreichbar.'
  })

  /** Work that is not on the server: changes since the last save, or a new planning with any input. */
  const hasChanges = computed(() => (state.planning.name ? unsaved.value : !isBlank.value))

  /** A newer state on the server and nothing to save here: the save button loads it instead. */
  const loadsNewer = computed(() => !!newerOnServer.value && !hasChanges.value)

  // The save button is the only sign of changes: it can be clicked while there is something to save.
  const saveLabel = computed(() => {
    if (loadsNewer.value) return 'Neuen Stand laden'
    return planning.saveNeedsInput.value ? 'Planung speichern …' : 'Planung speichern'
  })
  const saveHint = computed(() => {
    if (!serverReady.value) return serverHint.value
    return hasChanges.value || loadsNewer.value ? null : 'Keine Änderungen'
  })
  /** Who saved the newer state on the server, and when. */
  const newerText = computed(() => {
    const newer = newerOnServer.value
    return newer ? `${newer.savedBy || 'Jemand'} hat am ${formatTimestamp(newer.savedAt)} einen neueren Stand gespeichert` : null
  })

  const dialogWarning = computed(() =>
    dialog.mode === 'open' && unsaved.value ? `Nicht gespeicherte Änderungen an „${state.planning.name}“ gehen dabei verloren.` : null,
  )

  function showDialog(mode: PlanningDialogMode) {
    Object.assign(dialog, { open: true, mode, busy: false, error: null })
  }

  async function submitDialog(value: { name: string; password: string; remember: boolean }) {
    const mode = dialog.mode
    dialog.busy = true
    dialog.error = null
    try {
      if (mode === 'open') await planning.open(value.name, value.password, value.remember)
      else if (mode === 'create') await planning.create(value.name, value.password, value.remember)
      else await planning.authenticate(value.password, value.remember)
      dialog.open = false
      const { name, savedAt } = state.planning
      if (mode === 'open') toast.success(`„${name}“ geöffnet`, { description: savedAt ? `Gespeichert am ${formatTimestamp(savedAt)}` : undefined })
      if (mode === 'create') toast.success(`„${name}“ gespeichert`)
    } catch (error) {
      dialog.error = errorText(error)
      return
    } finally {
      dialog.busy = false
    }
    if (mode === 'password') await (passwordPurpose.value === 'delete' ? removePlanning() : save())
  }

  async function loadNewer() {
    try {
      if ((await planning.reload()) === 'needs-password') {
        passwordPurpose.value = 'save'
        showDialog('password')
      } else toast.success('Neuen Stand geladen')
    } catch (error) {
      toast.error('Laden hat nicht geklappt', { description: errorText(error), ...PERSISTENT })
    }
  }

  function handle(outcome: SaveOutcome, previous?: MergeInput) {
    if (outcome.status === 'saved') toast.success('Gespeichert')
    else if (outcome.status === 'needs-name') showDialog('create')
    else if (outcome.status === 'needs-password') {
      passwordPurpose.value = 'save'
      showDialog('password')
    } else if (outcome.status === 'conflict') {
      const input = planning.mergeInput(outcome.current)
      // Saved again elsewhere while merging: the state merged with is now the shared one.
      if (previous) input.base = previous.remote
      Object.assign(conflict, { open: true, input })
    }
  }

  async function save() {
    if (loadsNewer.value) return loadNewer()
    try {
      handle(await planning.save())
    } catch (error) {
      toast.error('Speichern hat nicht geklappt', { description: errorText(error), ...PERSISTENT })
    }
  }

  /** Saves the variants merged in the conflict dialog. */
  async function saveMerged(variants: Variant[]) {
    const input = conflict.input
    if (!input) return
    conflict.open = false
    try {
      handle(await planning.saveMerged(variants, input.current), input)
    } catch (error) {
      toast.error('Speichern hat nicht geklappt', { description: errorText(error), ...PERSISTENT })
    }
  }

  async function removePlanning() {
    try {
      if ((await planning.remove()) === 'needs-password') {
        passwordPurpose.value = 'delete'
        showDialog('password')
      }
    } catch (error) {
      toast.error('Löschen hat nicht geklappt', { description: errorText(error), ...PERSISTENT })
    }
  }

  async function deletePlanning() {
    const name = state.planning.name
    if (!name) return
    const confirmed = await confirmDialog({
      title: `Planung „${name}“ löschen?`,
      description:
        'Sie wird vom Server gelöscht und lässt sich danach von niemandem mehr öffnen. Die Varianten in diesem Browser bleiben als neue Planung erhalten.',
      confirmLabel: 'Löschen',
      destructive: true,
    })
    if (confirmed) await removePlanning()
  }

  async function newPlanning() {
    if (hasChanges.value) {
      const confirmed = await confirmDialog({
        title: 'Neue Planung anlegen?',
        description: state.planning.name
          ? `Nicht gespeicherte Änderungen an „${state.planning.name}“ gehen dabei verloren.`
          : 'Die Varianten in diesem Browser gehen dabei verloren.',
        confirmLabel: 'Neue Planung',
      })
      if (!confirmed) return
    }
    store.newPlanning()
  }

  function exportPlanning() {
    const blob = new Blob([JSON.stringify(store.planningData(), null, 2)], { type: 'application/json' })
    const name = (state.planning.name ?? 'planung').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `elternzeit-${name}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function importPlanning(file: File) {
    let variants: Variant[]
    try {
      variants = parsePlanning(JSON.parse(await file.text()))
    } catch {
      await messageDialog('Datei nicht lesbar', 'Die Datei enthält keine Planung aus dem Elternzeit-Planer.')
      return
    }
    const subject = variants.length === 1 ? 'Die Variante' : `Die ${variants.length} Varianten`
    const confirmed = await confirmDialog({
      title: 'Planung importieren?',
      description: `${subject} aus der Datei ersetzen die Varianten in diesem Browser.`,
      confirmLabel: 'Importieren',
    })
    if (!confirmed) return
    store.replaceVariants(variants)
    toast.success('Planung importiert')
  }

  return {
    dialog,
    dialogWarning,
    passwordPurpose,
    conflict,
    serverReady,
    serverHint,
    hasChanges,
    saveLabel,
    saveHint,
    newerText,
    loadsNewer,
    showDialog,
    submitDialog,
    save,
    saveMerged,
    deletePlanning,
    newPlanning,
    exportPlanning,
    importPlanning,
  }
}
