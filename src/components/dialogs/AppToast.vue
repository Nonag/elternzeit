<script setup lang="ts">
import { CircleCheckIcon, OctagonXIcon, XIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { ToastAction } from '@/lib/toasts'

// Layout of the shadcn toast: icon, text, action and close button in one row. The card itself (background, border,
// shadow) is the list item of Sonner, see App.vue.
const props = defineProps<{
  title: string
  description?: string
  type?: 'success' | 'error'
  action?: ToastAction
  /** Passed by Sonner while the toasts are hovered; not needed here. */
  isPaused?: boolean
}>()
const emit = defineEmits<{ closeToast: [] }>()

function runAction() {
  props.action?.onClick()
  emit('closeToast')
}
</script>

<template>
  <div data-slot="toast" class="flex w-full items-center gap-3 p-4">
    <CircleCheckIcon v-if="type === 'success'" class="size-4 shrink-0" aria-hidden="true" />
    <OctagonXIcon v-else-if="type === 'error'" class="text-destructive size-4 shrink-0" aria-hidden="true" />
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p class="text-sm font-medium">{{ title }}</p>
      <p v-if="description" class="text-muted-foreground text-sm whitespace-pre-line">{{ description }}</p>
    </div>
    <Button v-if="action" variant="outline" size="sm" class="shrink-0" @click="runAction">{{ action.label }}</Button>
    <Button
      variant="ghost"
      size="icon-sm"
      class="text-muted-foreground hover:text-foreground shrink-0"
      aria-label="Schließen"
      @click="emit('closeToast')"
    >
      <XIcon />
    </Button>
  </div>
</template>
