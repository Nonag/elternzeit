<script setup lang="ts">
import {
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  FilePlusIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  FolderXIcon,
  MoonIcon,
  PencilIcon,
  Redo2Icon,
  SaveAllIcon,
  SaveIcon,
  SunIcon,
  Trash2Icon,
  Undo2Icon,
  UploadIcon,
} from '@lucide/vue'
import { onKeyStroke, useColorMode, useEventListener } from '@vueuse/core'
import { SelectTrigger as SelectTriggerPrimitive } from 'reka-ui'
import { toast } from 'vue-sonner'
import { computed, reactive, ref } from 'vue'
import ConflictDialog from '@/components/dialogs/ConflictDialog.vue'
import PlanningDialog from '@/components/dialogs/PlanningDialog.vue'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { confirmDialog, messageDialog, promptDialog } from '@/lib/dialogs'
import { formatTimestamp } from '@/lib/format'
import { ApiError, type RemotePlanning } from '@/lib/planningApi'
import { describeDifferences } from '@/lib/planningDiff'
import { usePlanning, type PlanningDialogMode } from '@/stores/planning'
import { parsePlanning, useVariants } from '@/stores/variants'

const store = useVariants()
const { state, current, unsaved, canUndo, canRedo, isBlank } = store
const planning = usePlanning()
const fileInput = ref<HTMLInputElement | null>(null)

const colorMode = useColorMode()
const isDark = computed(() => colorMode.state.value === 'dark')

// Server functions stay visible everywhere and are only disabled without a server.
const serverReady = computed(() => planning.server.status?.available === true)
const serverHint = computed(() => {
  const status = planning.server.status
  if (!status) return 'Verbindung zum Server wird geprüft …'
  return status.available === false && status.reason === 'file'
    ? 'In der Offline-Datei nicht verfügbar, nur in der Server-Version.'
    : 'Der Server ist nicht erreichbar.'
})

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

const dialog = reactive({ open: false, mode: 'open' as PlanningDialogMode, busy: false, error: null as string | null })
const dialogWarning = computed(() =>
  dialog.mode === 'open' && unsaved.value ? `Nicht gespeicherte Änderungen an „${state.planning.name}“ gehen dabei verloren.` : null,
)

/** What the password dialog continues with. */
const passwordPurpose = ref<'save' | 'delete'>('save')

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

const conflict = reactive({ open: false, current: null as RemotePlanning | null, differences: [] as string[] })

async function save(force = false) {
  try {
    const outcome = await planning.save(force)
    if (outcome.status === 'saved') toast.success('Gespeichert')
    else if (outcome.status === 'needs-name') showDialog('create')
    else if (outcome.status === 'needs-password') {
      passwordPurpose.value = 'save'
      showDialog('password')
    } else if (outcome.status === 'conflict') {
      const differences = describeDifferences(state.variants, parsePlanning(outcome.current.data))
      Object.assign(conflict, { open: true, current: outcome.current, differences })
    }
  } catch (error) {
    await messageDialog('Speichern hat nicht geklappt', errorText(error))
  }
}

function takeServerState() {
  if (conflict.current) planning.adopt(conflict.current)
}

async function deleteCurrentPlanning() {
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

async function removePlanning() {
  try {
    if ((await planning.remove()) === 'needs-password') {
      passwordPurpose.value = 'delete'
      showDialog('password')
    }
  } catch (error) {
    await messageDialog('Löschen hat nicht geklappt', errorText(error))
  }
}

/** Work that is not on the server: changes since the last save, or a new planning with any input. */
const hasChanges = computed(() => (state.planning.name ? unsaved.value : !isBlank.value))

// The save button is the only sign of changes: it can be clicked while there is something to save.
const saveLabel = computed(() => (planning.saveNeedsInput.value ? 'Planung speichern …' : 'Planung speichern'))
const saveHint = computed(() => {
  if (!serverReady.value) return serverHint.value
  return hasChanges.value ? null : 'Keine Änderungen'
})

// Closing the window with something to save asks first, like other online editors.
useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
  if (saveHint.value) return
  event.preventDefault()
  event.returnValue = ''
})

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

// "…" marks every entry that asks for more input. Server entries stay visible and get a reason when disabled.
const planningItems = computed(() => {
  const offline = serverReady.value ? null : serverHint.value
  return [
    { id: 'new', label: hasChanges.value ? 'Neue Planung …' : 'Neue Planung', icon: FolderPlusIcon, run: newPlanning, hint: null },
    { id: 'open', label: 'Planung öffnen …', icon: FolderOpenIcon, run: () => showDialog('open'), hint: offline },
    { id: 'save', label: saveLabel.value, icon: SaveIcon, run: () => save(), hint: saveHint.value },
    { id: 'save-as', label: 'Als neue Planung speichern …', icon: SaveAllIcon, run: () => showDialog('create'), hint: offline },
    { id: 'export', label: 'Planung exportieren', icon: DownloadIcon, run: download, hint: null },
    { id: 'import', label: 'Planung importieren …', icon: UploadIcon, run: () => fileInput.value?.click(), hint: null },
    {
      id: 'delete',
      label: 'Planung löschen …',
      icon: FolderXIcon,
      run: deleteCurrentPlanning,
      hint: offline ?? (state.planning.name ? null : 'Die Planung ist noch nicht auf dem Server gespeichert.'),
      destructive: true,
    },
  ]
})

function download() {
  const blob = new Blob([JSON.stringify(store.planningData(), null, 2)], { type: 'application/json' })
  const name = (state.planning.name ?? 'planung').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `elternzeit-${name}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let variants
  try {
    variants = parsePlanning(JSON.parse(await file.text()))
  } catch {
    await messageDialog('Datei nicht lesbar', 'Die Datei enthält keine Planung aus dem Elternzeit-Planer.')
    return
  }
  const count = variants.length === 1 ? 'Die Variante' : `Die ${variants.length} Varianten`
  const confirmed = await confirmDialog({
    title: 'Planung importieren?',
    description: `${count} aus der Datei ersetzen die Varianten in diesem Browser.`,
    confirmLabel: 'Importieren',
  })
  if (confirmed) {
    store.replaceVariants(variants)
    toast.success('Planung importiert')
  }
}

async function renameCurrent() {
  const name = await promptDialog({ title: 'Variante umbenennen', label: 'Name', value: current.value.name, confirmLabel: 'Umbenennen' })
  if (name) store.rename(name)
}

/** Every switch to another variant gets a toast; with the same id, a quick next switch replaces it. */
function announceVariant(title: string, description?: string) {
  toast(title, { id: 'variant', description })
}

function selectVariant(id: string) {
  if (id === state.currentId) return
  store.select(id)
  announceVariant(`Zu „${current.value.name}“ gewechselt`)
}

function createVariant() {
  store.create()
  announceVariant(`„${current.value.name}“ angelegt`)
}

function copyVariant() {
  store.copy()
  announceVariant(`„${current.value.name}“ angelegt`)
}

async function removeCurrent() {
  const name = current.value.name
  const confirmed = await confirmDialog({ title: `Variante „${name}“ löschen?`, confirmLabel: 'Löschen', destructive: true })
  if (!confirmed) return
  store.remove(current.value.id)
  announceVariant(`„${name}“ gelöscht`, `Zu „${current.value.name}“ gewechselt.`)
}

function undo() {
  const switched = store.undo()
  if (switched) announceVariant(`Zu „${switched.name}“ gewechselt`, 'Die Änderung dort wurde rückgängig gemacht.')
}

function redo() {
  const switched = store.redo()
  if (switched) announceVariant(`Zu „${switched.name}“ gewechselt`, 'Die Änderung dort wurde wiederholt.')
}

// Save, undo and redo in the header, also with the usual shortcuts. In text fields the browser's own undo stays.
const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Strg+'

const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

onKeyStroke((event) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return
  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    if (!saveHint.value) void save()
  } else if (key === 'z' && !isTextField(event.target)) {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
  }
})
</script>

<template>
  <header class="bg-card sticky top-0 z-40 border-b">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
      <h1 class="text-base leading-tight font-semibold">Elternzeit-Planer</h1>
      <div class="flex flex-wrap items-center gap-2">
        <!-- Planning: the name only shows which planning is open; the arrow opens its menu. -->
        <ButtonGroup aria-label="Planung">
          <ButtonGroupText class="bg-background dark:border-input dark:bg-input/30 max-w-56 font-medium">
            <FolderIcon class="text-muted-foreground" />
            <span class="truncate" :class="state.planning.name ? '' : 'text-muted-foreground'">{{ state.planning.name ?? 'Neue Planung' }}</span>
          </ButtonGroupText>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="icon" aria-label="Menü Planung"><ChevronDownIcon /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-72">
              <Tooltip v-for="item in planningItems" :key="item.id" :disabled="!item.hint">
                <TooltipTrigger as-child>
                  <div>
                    <DropdownMenuItem :disabled="!!item.hint" :variant="item.destructive ? 'destructive' : 'default'" @select="item.run">
                      <component :is="item.icon" /> {{ item.label }}
                    </DropdownMenuItem>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">{{ item.hint }}</TooltipContent>
              </Tooltip>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
        <!-- Variant: the name opens the list of variants; the arrow opens the variant menu. -->
        <ButtonGroup aria-label="Variante">
          <Select :model-value="state.currentId" @update:model-value="(id) => selectVariant(String(id))">
            <SelectTriggerPrimitive as-child>
              <Button variant="outline" class="max-w-56 justify-start">
                <FileIcon class="text-muted-foreground" />
                <span class="truncate">{{ current.name }}</span>
              </Button>
            </SelectTriggerPrimitive>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                <SelectLabel>Varianten</SelectLabel>
                <SelectItem v-for="variant in state.variants" :key="variant.id" :value="variant.id">{{ variant.name }}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="icon" aria-label="Menü Variante"><ChevronDownIcon /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-60">
              <DropdownMenuItem @select="createVariant"><FilePlusIcon /> Neue Variante</DropdownMenuItem>
              <DropdownMenuItem @select="copyVariant"><CopyIcon /> Variante kopieren</DropdownMenuItem>
              <DropdownMenuItem @select="renameCurrent"><PencilIcon /> Variante umbenennen …</DropdownMenuItem>
              <DropdownMenuItem :disabled="state.variants.length <= 1" variant="destructive" @select="removeCurrent">
                <Trash2Icon /> Variante löschen …
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
        <Separator orientation="vertical" class="mx-1 my-1" />
        <div class="flex items-center">
          <Tooltip>
            <TooltipTrigger as-child>
              <span>
                <Button variant="ghost" size="icon" :disabled="!!saveHint" :aria-label="saveLabel" @click="save()"><SaveIcon /></Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{{ saveHint ?? `${saveLabel} (${shortcut}S)` }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <span>
                <Button variant="ghost" size="icon" :disabled="!canUndo" aria-label="Rückgängig" @click="undo()"><Undo2Icon /></Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Rückgängig ({{ shortcut }}Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <span>
                <Button variant="ghost" size="icon" :disabled="!canRedo" aria-label="Wiederholen" @click="redo()"><Redo2Icon /></Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Wiederholen ({{ shortcut }}⇧Z)</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="upload" />
      <Button
        variant="ghost"
        size="icon"
        class="ml-auto"
        :aria-label="isDark ? 'Helles Design' : 'Dunkles Design'"
        :title="isDark ? 'Helles Design' : 'Dunkles Design'"
        @click="colorMode = isDark ? 'light' : 'dark'"
      >
        <SunIcon v-if="isDark" />
        <MoonIcon v-else />
      </Button>
    </div>
    <PlanningDialog
      v-model:open="dialog.open"
      :mode="dialog.mode"
      :name="state.planning.name"
      :busy="dialog.busy"
      :error="dialog.error"
      :warning="dialogWarning"
      :purpose="passwordPurpose"
      @submit="submitDialog"
    />
    <ConflictDialog
      v-if="conflict.current"
      v-model:open="conflict.open"
      :name="conflict.current.name"
      :saved-at="conflict.current.savedAt"
      :differences="conflict.differences"
      @load-server="takeServerState"
      @overwrite="save(true)"
    />
  </header>
</template>
