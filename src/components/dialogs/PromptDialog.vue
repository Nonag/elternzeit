<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { prompt, promptOptions as options } from '@/lib/dialogs'

const value = ref('')

watch(
  () => prompt.isRevealed.value,
  (open) => {
    if (open) value.value = options.value?.value ?? ''
  },
)

// Cancel button, close button, Escape and a click outside all cancel; only the submit button confirms.
function onOpenChange(open: boolean) {
  if (!open && prompt.isRevealed.value) prompt.cancel()
}

function submit() {
  const text = value.value.trim()
  if (text) prompt.confirm(text)
}
</script>

<template>
  <Dialog :open="prompt.isRevealed.value" @update:open="onOpenChange">
    <DialogContent>
      <form class="grid gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ options?.title }}</DialogTitle>
          <DialogDescription class="sr-only">{{ options?.label }}</DialogDescription>
        </DialogHeader>
        <div class="grid gap-2">
          <Label for="prompt-value">{{ options?.label }}</Label>
          <Input id="prompt-value" v-model="value" />
        </div>
        <DialogFooter>
          <DialogClose as-child><Button type="button" variant="outline">Abbrechen</Button></DialogClose>
          <Button type="submit" :disabled="!value.trim()">{{ options?.confirmLabel ?? 'OK' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
