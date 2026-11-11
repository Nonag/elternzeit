<script setup lang="ts">
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import InfoTip from '@/components/fields/InfoTip.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import SelectField from '@/components/fields/SelectField.vue'
import { createId, normalizePeriods, sortPeriods } from '@/engine/plan'
import type { AllowanceType, ParentKey, PlanPeriod } from '@/engine/types'
import { useVariants } from '@/stores/variants'

const selected = defineModel<string | null>('selected', { default: null })
const { config, result } = useVariants()

const parentKeys = computed<ParentKey[]>(() => result.value.activeParents)

const allowanceOptions: { value: AllowanceType; label: string }[] = [
  { value: 'none', label: 'kein Elterngeld' },
  { value: 'basic', label: 'Basiselterngeld' },
  { value: 'plus', label: 'ElterngeldPlus' },
  { value: 'bonus', label: 'Partnerschaftsbonus' },
]

// Compact enough for two parents side by side (from ~54rem card width) without horizontal scrolling.
const GRID = 'grid grid-cols-[3.25rem_3.25rem_2.5rem_4.25rem_minmax(0,1fr)_2rem] items-center gap-1.5'

function periodsOf(key: ParentKey): PlanPeriod[] {
  return sortPeriods(config.value.periods[key])
}

/** Applies a change; the edited period wins overlaps with other periods. Hours are never filled in automatically. */
function update(key: ParentKey, id: string, patch: Partial<PlanPeriod>) {
  const periods = config.value.periods[key]
  const period = periods.find((b) => b.id === id)
  if (!period) return
  const edited = { ...period, ...patch }
  if (edited.to < edited.from) edited.to = edited.from
  config.value.periods[key] = normalizePeriods([...periods.filter((b) => b.id !== id), edited])
}

function add(key: ParentKey) {
  const periods = config.value.periods[key]
  const start = periods.length ? Math.max(...periods.map((b) => b.to)) + 1 : 1
  const period: PlanPeriod = { id: createId('period'), from: start, to: start + 1, kind: 'leave', hours: 0, allowance: 'none' }
  config.value.periods[key] = normalizePeriods([...periods, period])
  selected.value = period.id
}

function remove(key: ParentKey, id: string) {
  config.value.periods[key] = config.value.periods[key].filter((b) => b.id !== id)
  if (selected.value === id) selected.value = null
}

function hasError(key: ParentKey, period: PlanPeriod): boolean {
  return period.hours === null || (period.kind === 'work' && period.hours === 0) || result.value.issues.some((i) => i.id === `period-hours-${period.id}`)
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
        <p v-if="!periodsOf(key).length" class="text-muted-foreground px-1 py-2 text-xs">
          Noch keine Zeiträume – {{ result.parents[key].name }} arbeitet durchgehend wie bisher.
        </p>
        <div
          v-for="period in periodsOf(key)"
          :key="period.id"
          :class="[GRID, selected === period.id ? 'bg-accent ring-ring/40 ring-1' : '', hasError(key, period) ? 'bg-destructive/5' : '']"
          class="rounded-lg p-1"
          @click="selected = period.id"
        >
          <NumberInput :model-value="period.from" :min="1" :max="96" aria-label="von Monat" @update:model-value="(v) => update(key, period.id, { from: v ?? period.from })" />
          <NumberInput :model-value="period.to" :min="1" :max="96" aria-label="bis Monat" @update:model-value="(v) => update(key, period.id, { to: v ?? period.to })" />
          <div class="flex justify-center">
            <Switch
              :model-value="period.kind === 'leave'"
              aria-label="Elternzeit"
              @update:model-value="(v: boolean) => update(key, period.id, { kind: v ? 'leave' : 'work' })"
            />
          </div>
          <NumberInput
            :model-value="period.hours"
            nullable
            :invalid="period.hours === null || (period.kind === 'work' && period.hours === 0)"
            placeholder="?"
            :min="0"
            :max="60"
            :step="0.5"
            :decimals="2"
            aria-label="Stunden pro Woche"
            @update:model-value="(v) => update(key, period.id, { hours: v })"
          />
          <SelectField
            :model-value="period.allowance"
            :options="allowanceOptions"
            trigger-class="px-2 text-xs"
            @update:model-value="(v) => update(key, period.id, { allowance: v as AllowanceType })"
          />
          <Button variant="ghost" size="icon" aria-label="Zeitraum löschen" @click.stop="remove(key, period.id)"><Trash2Icon /></Button>
        </div>
      </div>
    </div>
  </div>
</template>
