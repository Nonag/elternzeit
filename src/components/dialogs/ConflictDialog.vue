<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatTimestamp } from '@/lib/format'

const MAX_LINES = 8

const props = defineProps<{ name: string; savedAt: string; differences: string[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ loadServer: []; overwrite: [] }>()

const savedAt = computed(() => formatTimestamp(props.savedAt))
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent class="data-[size=default]:sm:max-w-lg">
      <AlertDialogHeader>
        <AlertDialogTitle>„{{ name }}“ wurde inzwischen geändert</AlertDialogTitle>
        <AlertDialogDescription>
          Die Planung wurde am {{ savedAt }} in einem anderen Browser gespeichert. Das ist dort anders als bei dir:
        </AlertDialogDescription>
      </AlertDialogHeader>
      <ul class="text-muted-foreground grid list-disc gap-1 pl-5 text-sm">
        <li v-for="line in differences.slice(0, MAX_LINES)" :key="line">{{ line }}</li>
        <li v-if="differences.length > MAX_LINES">und {{ differences.length - MAX_LINES }} weitere</li>
        <li v-if="!differences.length">Nur die Reihenfolge der Varianten.</li>
      </ul>
      <AlertDialogFooter>
        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
        <AlertDialogAction variant="outline" @click="emit('loadServer')">Server-Stand übernehmen</AlertDialogAction>
        <AlertDialogAction @click="emit('overwrite')">Meinen Stand speichern</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
