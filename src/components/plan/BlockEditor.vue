<script setup lang="ts">
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import InfoTip from '@/components/fields/InfoTip.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import SelectField from '@/components/fields/SelectField.vue'
import { createId, normalizeBlocks, sortBlocks } from '@/engine/plan'
import type { AllowanceVariant, ParentKey, PlanBlock } from '@/engine/types'
import { useScenarios } from '@/stores/scenarios'

const selected = defineModel<string | null>('selected', { default: null })
const { config, result } = useScenarios()

const parentKeys = computed<ParentKey[]>(() => result.value.activeParents)

const allowanceOptions: { value: AllowanceVariant; label: string }[] = [
  { value: 'none', label: 'kein Elterngeld' },
  { value: 'basic', label: 'Basiselterngeld' },
  { value: 'plus', label: 'ElterngeldPlus' },
  { value: 'bonus', label: 'Partnerschaftsbonus' },
]

// Compact enough for two parents side by side (from ~54rem card width) without horizontal scrolling.
const GRID = 'grid grid-cols-[3.25rem_3.25rem_2.5rem_4.25rem_minmax(0,1fr)_2rem] items-center gap-1.5'

function blocksOf(key: ParentKey): PlanBlock[] {
  return sortBlocks(config.value.blocks[key])
}

/** Applies a change; the edited block wins overlaps with other blocks. Hours are never filled in automatically. */
function update(key: ParentKey, id: string, patch: Partial<PlanBlock>) {
  const blocks = config.value.blocks[key]
  const block = blocks.find((b) => b.id === id)
  if (!block) return
  const edited = { ...block, ...patch }
  if (edited.to < edited.from) edited.to = edited.from
  config.value.blocks[key] = normalizeBlocks([...blocks.filter((b) => b.id !== id), edited])
}

function add(key: ParentKey) {
  const blocks = config.value.blocks[key]
  const start = blocks.length ? Math.max(...blocks.map((b) => b.to)) + 1 : 1
  const block: PlanBlock = { id: createId('block'), from: start, to: start + 1, leave: true, hours: 0, allowance: 'none' }
  config.value.blocks[key] = normalizeBlocks([...blocks, block])
  selected.value = block.id
}

function remove(key: ParentKey, id: string) {
  config.value.blocks[key] = config.value.blocks[key].filter((b) => b.id !== id)
  if (selected.value === id) selected.value = null
}

function hasError(key: ParentKey, block: PlanBlock): boolean {
  return block.hours === null || (!block.leave && block.hours === 0) || result.value.issues.some((i) => i.id === `block-hours-${block.id}`)
}
</script>

<template>
  <div class="@container">
    <div class="grid gap-6 @min-[54rem]:grid-cols-2 @min-[54rem]:gap-8">
      <div v-for="key in parentKeys" :key="key" class="grid min-w-0 content-start gap-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">{{ result.parents[key].name }}</span>
          <Button variant="outline" size="sm" @click="add(key)"><PlusIcon /> Zeitraum</Button>
        </div>
        <div :class="GRID" class="text-muted-foreground px-1 text-xs font-medium">
          <span class="flex items-center gap-1">
            von
            <InfoTip text="Lebensmonat des Kindes: 1 ist der erste Monat ab der Geburt." />
          </span>
          <span>bis</span>
          <span class="flex items-center gap-1">
            EZ
            <InfoTip text="Elternzeit: unbezahlte Freistellung mit Kündigungsschutz. Bis zu 32 Stunden Arbeit pro Woche sind dabei möglich." />
          </span>
          <span class="flex items-center gap-1">
            Std.
            <InfoTip text="Arbeitsstunden pro Woche in diesem Zeitraum. 0 = gar nicht arbeiten." />
          </span>
          <span class="flex items-center gap-1">
            Elterngeld
            <InfoTip
              text="Basiselterngeld: voller Betrag, bis zum 14. Lebensmonat.
ElterngeldPlus: halber Betrag, doppelt so lange – gut bei Teilzeit.
Partnerschaftsbonus: zusätzliche Plus-Monate, wenn beide gleichzeitig 24–32 Stunden arbeiten."
            />
          </span>
          <span />
        </div>
        <p v-if="!blocksOf(key).length" class="text-muted-foreground px-1 py-2 text-xs">
          Noch keine Zeiträume – {{ result.parents[key].name }} arbeitet durchgehend wie bisher.
        </p>
        <div
          v-for="block in blocksOf(key)"
          :key="block.id"
          :class="[GRID, selected === block.id ? 'bg-accent ring-ring/40 ring-1' : '', hasError(key, block) ? 'bg-destructive/5' : '']"
          class="rounded-lg p-1"
          @click="selected = block.id"
        >
          <NumberInput :model-value="block.from" :min="1" :max="96" aria-label="von Monat" @update:model-value="(v) => update(key, block.id, { from: v ?? block.from })" />
          <NumberInput :model-value="block.to" :min="1" :max="96" aria-label="bis Monat" @update:model-value="(v) => update(key, block.id, { to: v ?? block.to })" />
          <div class="flex justify-center">
            <Switch :model-value="block.leave" aria-label="Elternzeit" @update:model-value="(v: boolean) => update(key, block.id, { leave: v })" />
          </div>
          <NumberInput
            :model-value="block.hours"
            nullable
            :invalid="block.hours === null || (!block.leave && block.hours === 0)"
            placeholder="?"
            :min="0"
            :max="60"
            :step="0.5"
            :decimals="2"
            aria-label="Stunden pro Woche"
            @update:model-value="(v) => update(key, block.id, { hours: v })"
          />
          <SelectField
            :model-value="block.allowance"
            :options="allowanceOptions"
            trigger-class="px-2 text-xs"
            @update:model-value="(v) => update(key, block.id, { allowance: v as AllowanceVariant })"
          />
          <Button variant="ghost" size="icon" aria-label="Zeitraum löschen" @click.stop="remove(key, block.id)"><Trash2Icon /></Button>
        </div>
      </div>
    </div>
  </div>
</template>
