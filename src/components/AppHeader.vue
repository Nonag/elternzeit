<script setup lang="ts">
import {
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  FilePlusIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  FolderXIcon,
  MoonIcon,
  PencilIcon,
  RotateCcwIcon,
  SaveIcon,
  SunIcon,
  Trash2Icon,
  UploadIcon,
} from '@lucide/vue'
import { useColorMode } from '@vueuse/core'
import { computed, reactive, ref } from 'vue'
import ConflictDialog from '@/components/dialogs/ConflictDialog.vue'
import PlanningDialog from '@/components/dialogs/PlanningDialog.vue'
import SelectField from '@/components/fields/SelectField.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { confirmDialog, messageDialog, promptDialog } from '@/lib/dialogs'
import { ApiError, type RemotePlanning } from '@/lib/planningApi'
import { describeDifferences } from '@/lib/planningDiff'
import { usePlanning, type PlanningDialogMode } from '@/stores/planning'
import { parsePlanning, useVariants } from '@/stores/variants'

const store = useVariants()
const { state, current, unsaved } = store
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
    if (outcome.status === 'needs-name') showDialog('create')
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

// "…" marks every entry that asks for more input. Server entries stay visible and get a reason when disabled.
const planningItems = computed(() => {
  const offline = serverReady.value ? null : serverHint.value
  return [
    { id: 'open', label: 'Planung öffnen …', icon: FolderOpenIcon, run: () => showDialog('open'), hint: offline },
    {
      id: 'save',
      label: planning.saveNeedsInput.value ? 'Planung speichern …' : 'Planung speichern',
      icon: SaveIcon,
      run: () => save(),
      hint: offline,
    },
    { id: 'save-as', label: 'Als neue Planung speichern …', icon: FolderPlusIcon, run: () => showDialog('create'), hint: offline },
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
  if (confirmed) store.replaceVariants(variants)
}

async function renameCurrent() {
  const name = await promptDialog({ title: 'Variante umbenennen', label: 'Name', value: current.value.name, confirmLabel: 'Umbenennen' })
  if (name) store.rename(name)
}

async function removeCurrent() {
  const confirmed = await confirmDialog({
    title: `Variante „${current.value.name}“ löschen?`,
    description: 'Das lässt sich nicht rückgängig machen.',
    confirmLabel: 'Löschen',
    destructive: true,
  })
  if (confirmed) store.remove(current.value.id)
}

async function resetToExample() {
  const confirmed = await confirmDialog({
    title: 'Variante zurücksetzen?',
    description: `Alle Eingaben von „${current.value.name}“ werden durch die Beispielwerte ersetzt.`,
    confirmLabel: 'Zurücksetzen',
    destructive: true,
  })
  if (confirmed) store.resetToExample()
}
</script>

<template>
  <header class="bg-card sticky top-0 z-40 border-b">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
      <h1 class="text-base leading-tight font-semibold">Elternzeit-Planer</h1>
      <div class="flex min-w-0 items-center gap-2 text-sm">
        <FolderIcon class="text-muted-foreground size-4 shrink-0" />
        <span class="max-w-56 truncate font-medium" :class="state.planning.name ? '' : 'text-muted-foreground'">
          {{ state.planning.name ?? 'Neue Planung' }}
        </span>
        <Badge v-if="unsaved" variant="outline" class="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400">
          nicht gespeichert
        </Badge>
      </div>
      <div class="flex items-center gap-1">
        <div class="w-52">
          <SelectField
            label="Varianten"
            :model-value="state.currentId"
            :options="state.variants.map((s) => ({ value: s.id, label: s.name }))"
            @update:model-value="(id) => store.select(id)"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="Menü"><EllipsisVerticalIcon /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-72">
            <DropdownMenuLabel>Variante</DropdownMenuLabel>
            <DropdownMenuItem @select="store.create()"><FilePlusIcon /> Neue Variante</DropdownMenuItem>
            <DropdownMenuItem @select="store.copy()"><CopyIcon /> Variante kopieren</DropdownMenuItem>
            <DropdownMenuItem @select="renameCurrent"><PencilIcon /> Variante umbenennen …</DropdownMenuItem>
            <DropdownMenuItem @select="resetToExample"><RotateCcwIcon /> Auf Beispielwerte zurücksetzen …</DropdownMenuItem>
            <DropdownMenuItem :disabled="state.variants.length <= 1" variant="destructive" @select="removeCurrent">
              <Trash2Icon /> Variante löschen …
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Planung</DropdownMenuLabel>
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
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="upload" />
      </div>
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
