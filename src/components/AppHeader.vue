<script setup lang="ts">
import {
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  FilePlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
} from '@lucide/vue'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import SelectField from '@/components/fields/SelectField.vue'
import { formatDate } from '@/engine/dates'
import { useScenarios } from '@/stores/scenarios'

const store = useScenarios()
const { state, current, result } = store
const fileInput = ref<HTMLInputElement | null>(null)

function download() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'elternzeit-szenarien.json'
  link.click()
  URL.revokeObjectURL(link.href)
}

async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const count = store.importJson(await file.text())
    if (!count) alert('Keine Szenarien in der Datei gefunden.')
  } catch {
    alert('Die Datei konnte nicht gelesen werden.')
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

function removeCurrent() {
  if (confirm(`Szenario „${current.value.name}“ löschen?`)) store.remove(current.value.id)
}

function resetCurrent() {
  if (confirm('Alle Eingaben dieses Szenarios auf die Beispielwerte zurücksetzen?')) store.resetCurrent()
}
</script>

<template>
  <header class="bg-card sticky top-0 z-40 border-b">
    <div class="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <div class="mr-2">
        <h1 class="text-base leading-tight font-semibold">Elternzeit-Planer</h1>
        <p class="text-muted-foreground text-xs">
          {{ result.birth === result.dueDate ? 'Errechneter Termin' : 'Geburt' }} {{ formatDate(result.birth) }} ·
          Rechtsstand 10.11.2026
        </p>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-44">
          <SelectField
            :model-value="state.currentId"
            :options="state.scenarios.map((s) => ({ value: s.id, label: s.name }))"
            @update:model-value="(id) => store.select(id)"
          />
        </div>
        <Input v-model="current.name" class="h-8 w-40" aria-label="Name des Szenarios" />
        <Button variant="outline" size="sm" class="h-8" @click="store.duplicate()"><CopyIcon /> Variante</Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="Weitere Aktionen"><EllipsisVerticalIcon /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-56">
            <DropdownMenuItem @click="store.create()"><FilePlusIcon /> Neues Szenario</DropdownMenuItem>
            <DropdownMenuItem @click="store.duplicate()"><CopyIcon /> Szenario duplizieren</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="download"><DownloadIcon /> Alle Szenarien exportieren</DropdownMenuItem>
            <DropdownMenuItem @click="fileInput?.click()"><UploadIcon /> Szenarien importieren</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="resetCurrent"><RotateCcwIcon /> Auf Beispielwerte zurücksetzen</DropdownMenuItem>
            <DropdownMenuItem :disabled="state.scenarios.length <= 1" class="text-destructive" @click="removeCurrent">
              <Trash2Icon /> Szenario löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="upload" />
      </div>
      <p class="text-muted-foreground ml-auto hidden text-xs lg:block">Alle Daten bleiben lokal in diesem Browser.</p>
    </div>
  </header>
</template>
