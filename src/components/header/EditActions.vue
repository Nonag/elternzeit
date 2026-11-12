<script setup lang="ts">
import { DownloadIcon, Redo2Icon, SaveIcon, Undo2Icon } from '@lucide/vue'
import { onKeyStroke } from '@vueuse/core'
import { computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PERSISTENT } from '@/lib/toasts'
import { useVariants } from '@/stores/variants'
import { usePlanningActions } from './usePlanningActions'
import { useVariantActions } from './useVariantActions'

const { canUndo, canRedo, undoRestoresSaved } = useVariants()
const { save, saveLabel, saveHint, newerText, loadsNewer } = usePlanningActions()
const { undo, redo } = useVariantActions()

const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Strg+'

const buttons = computed(() => [
  {
    id: 'save',
    label: saveLabel.value,
    tooltip: [newerText.value, saveHint.value ?? `${saveLabel.value} (${shortcut}S)`].filter(Boolean).join('. '),
    icon: loadsNewer.value ? DownloadIcon : SaveIcon,
    disabled: !!saveHint.value,
    dot: !!newerText.value,
    run: () => save(),
  },
  {
    id: 'undo',
    label: undoRestoresSaved.value ? 'Zum letzten Speicherstand' : 'Rückgängig',
    tooltip: `${undoRestoresSaved.value ? 'Zum letzten Speicherstand' : 'Rückgängig'} (${shortcut}Z)`,
    icon: Undo2Icon,
    disabled: !canUndo.value,
    run: undo,
  },
  { id: 'redo', label: 'Wiederholen', tooltip: `Wiederholen (${shortcut}⇧Z)`, icon: Redo2Icon, disabled: !canRedo.value, run: redo },
])

// The usual shortcuts; in text fields the browser's own undo stays.
// A newer state from elsewhere stays as a toast until it is closed, loaded or saved over.
watch([newerText, loadsNewer], ([text]) => {
  if (!text) return void toast.dismiss('newer')
  toast(text, {
    id: 'newer',
    ...PERSISTENT,
    action: { label: loadsNewer.value ? 'Laden' : 'Speichern …', onClick: () => void save() },
  })
})

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
  <div class="flex items-center">
    <!-- The span keeps the tooltip working on disabled buttons. -->
    <Tooltip v-for="button in buttons" :key="button.id">
      <TooltipTrigger as-child>
        <span>
          <Button variant="ghost" size="icon" class="relative" :disabled="button.disabled" :aria-label="button.label" @click="button.run()">
            <component :is="button.icon" />
            <span v-if="'dot' in button && button.dot" class="bg-destructive absolute top-1.5 right-1.5 size-2 rounded-full" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{{ button.tooltip }}</TooltipContent>
    </Tooltip>
  </div>
</template>
