<script setup lang="ts">
import { ChevronDownIcon, DownloadIcon, FolderIcon, FolderOpenIcon, FolderPlusIcon, FolderXIcon, SaveAllIcon, SaveIcon, UploadIcon, UserPenIcon } from '@lucide/vue'
import { useFileDialog } from '@vueuse/core'
import { computed } from 'vue'
import ConflictDialog from '@/components/dialogs/ConflictDialog.vue'
import PlanningDialog from '@/components/dialogs/PlanningDialog.vue'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { promptDialog } from '@/lib/dialogs'
import { userName } from '@/stores/user'
import { useVariants } from '@/stores/variants'
import { usePlanningActions } from './usePlanningActions'

const { state } = useVariants()
const {
  dialog,
  dialogWarning,
  passwordPurpose,
  conflict,
  serverReady,
  serverHint,
  hasChanges,
  saveLabel,
  saveHint,
  showDialog,
  submitDialog,
  save,
  saveMerged,
  deletePlanning,
  newPlanning,
  exportPlanning,
  importPlanning,
} = usePlanningActions()

const fileDialog = useFileDialog({ accept: 'application/json,.json', multiple: false, reset: true })
fileDialog.onChange((files) => {
  const file = files?.[0]
  if (file) void importPlanning(file)
})

async function changeName() {
  const name = await promptDialog({ title: 'Dein Name', label: 'Name', value: userName.value, confirmLabel: 'Speichern' })
  if (name?.trim()) userName.value = name.trim()
}

// "…" marks every entry that asks for more input. Server entries stay visible and get a reason when disabled.
const items = computed(() => {
  const offline = serverReady.value ? null : serverHint.value
  return [
    { id: 'new', label: hasChanges.value ? 'Neue Planung …' : 'Neue Planung', icon: FolderPlusIcon, run: newPlanning, hint: null },
    { id: 'open', label: 'Planung öffnen …', icon: FolderOpenIcon, run: () => showDialog('open'), hint: offline },
    { id: 'save', label: saveLabel.value, icon: SaveIcon, run: () => save(), hint: saveHint.value },
    { id: 'save-as', label: 'Als neue Planung speichern …', icon: SaveAllIcon, run: () => showDialog('create'), hint: offline },
    { id: 'export', label: 'Planung exportieren', icon: DownloadIcon, run: exportPlanning, hint: null },
    { id: 'import', label: 'Planung importieren …', icon: UploadIcon, run: () => fileDialog.open(), hint: null },
    {
      id: 'delete',
      label: 'Planung löschen …',
      icon: FolderXIcon,
      run: deletePlanning,
      hint: offline ?? (state.planning.name ? null : 'Die Planung ist noch nicht auf dem Server gespeichert.'),
      destructive: true,
    },
    { id: 'user', label: 'Dein Name …', icon: UserPenIcon, run: changeName, hint: null },
  ]
})
</script>

<template>
  <!-- The name only shows which planning is open; the arrow opens the planning menu. -->
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
        <Tooltip v-for="item in items" :key="item.id" :disabled="!item.hint">
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
  <ConflictDialog v-if="conflict.input" v-model:open="conflict.open" :input="conflict.input" @save="saveMerged" />
</template>
