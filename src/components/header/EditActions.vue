<script setup lang="ts">
import { Redo2Icon, SaveIcon, Undo2Icon } from '@lucide/vue'
import { onKeyStroke, useEventListener } from '@vueuse/core'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useVariants } from '@/stores/variants'
import { usePlanningActions } from './usePlanningActions'
import { useVariantActions } from './useVariantActions'

const { canUndo, canRedo } = useVariants()
const { save, saveLabel, saveHint } = usePlanningActions()
const { undo, redo } = useVariantActions()

const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Strg+'

const buttons = computed(() => [
  { id: 'save', label: saveLabel.value, tooltip: saveHint.value ?? `${saveLabel.value} (${shortcut}S)`, icon: SaveIcon, disabled: !!saveHint.value, run: () => save() },
  { id: 'undo', label: 'Rückgängig', tooltip: `Rückgängig (${shortcut}Z)`, icon: Undo2Icon, disabled: !canUndo.value, run: undo },
  { id: 'redo', label: 'Wiederholen', tooltip: `Wiederholen (${shortcut}⇧Z)`, icon: Redo2Icon, disabled: !canRedo.value, run: redo },
])

// The usual shortcuts; in text fields the browser's own undo stays.
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

// Closing the window with something to save asks first, like other online editors.
useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
  if (saveHint.value) return
  event.preventDefault()
  event.returnValue = ''
})
</script>

<template>
  <div class="flex items-center">
    <!-- The span keeps the tooltip working on disabled buttons. -->
    <Tooltip v-for="button in buttons" :key="button.id">
      <TooltipTrigger as-child>
        <span>
          <Button variant="ghost" size="icon" :disabled="button.disabled" :aria-label="button.label" @click="button.run()">
            <component :is="button.icon" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{{ button.tooltip }}</TooltipContent>
    </Tooltip>
  </div>
</template>
