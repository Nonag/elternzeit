<script setup lang="ts">
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import InfoTip from '@/components/fields/InfoTip.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import SelectField from '@/components/fields/SelectField.vue'
import { createId, normalizePeriods, sortPeriods } from '@/engine/plan'
import type { Issue } from '@/engine/result'
import type { AllowanceType, ParentKey, PeriodKind, PlanPeriod } from '@/engine/types'
import { useVariants } from '@/stores/variants'
import IssueTip from './IssueTip.vue'
import { planIssues, type PeriodField } from './planIssues'
import VacationEditor from './VacationEditor.vue'

const selected = defineModel<string | null>('selected', { default: null })
const { config, result } = useVariants()

const parentKeys = computed<ParentKey[]>(() => result.value.activeParents)

const kindOptions: { value: PeriodKind; label: string }[] = [
  { value: 'leave', label: 'Elternzeit' },
  { value: 'work', label: 'Arbeit' },
]

const allowanceOptions: { value: AllowanceType; label: string; short: string }[] = [
  { value: 'none', label: 'kein Elterngeld', short: 'kein' },
  { value: 'basic', label: 'Basiselterngeld', short: 'Basis' },
  { value: 'plus', label: 'ElterngeldPlus', short: 'Plus' },
  { value: 'bonus', label: 'Partnerschaftsbonus', short: 'Bonus' },
]

// Compact enough for two parents side by side (from ~58rem card width) without horizontal scrolling.
const GRID = 'grid grid-cols-[3rem_3rem_6.25rem_3.75rem_2.75rem_minmax(0,1fr)_2rem] items-center gap-1.5'

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
  const period: PlanPeriod = { id: createId('period'), from: start, to: start + 1, kind: 'leave', hours: 0, workDays: null, allowance: 'none' }
  config.value.periods[key] = normalizePeriods([...periods, period])
  selected.value = period.id
}

function remove(key: ParentKey, id: string) {
  config.value.periods[key] = config.value.periods[key].filter((b) => b.id !== id)
  if (selected.value === id) selected.value = null
}

/** Working days of the contract are stored as null, so the period follows changes of the contract. */
function updateWorkDays(key: ParentKey, period: PlanPeriod, days: number | null) {
  update(key, period.id, { workDays: days === null || days === config.value.parents[key].workDaysPerWeek ? null : days })
}

const marks = computed(() => planIssues(result.value, config.value))
const NONE: Issue[] = []
const FIELDS: PeriodField[] = ['to', 'kind', 'hours', 'allowance']

function issuesAt(period: PlanPeriod, field: PeriodField): Issue[] {
  return marks.value.fields.get(`${period.id}:${field}`) ?? NONE
}

function hasError(period: PlanPeriod): boolean {
  return FIELDS.some((field) => issuesAt(period, field).some((issue) => issue.severity === 'error'))
}
</script>

<template>
  <div class="@container">
    <div class="grid gap-6 @min-[58rem]:grid-cols-2 @min-[58rem]:gap-8">
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
            Art
            <InfoTip
              text="Elternzeit: unbezahlte Freistellung mit Kündigungsschutz. Bis zu 32 Stunden Arbeit pro Woche sind dabei möglich.
Arbeit: andere Wochenstunden ohne Elternzeit."
            />
          </span>
          <span class="flex items-center gap-1">
            Std.
            <InfoTip text="Arbeitsstunden pro Woche in diesem Zeitraum. 0 = gar nicht arbeiten." />
          </span>
          <span class="flex items-center gap-1">
            Tage
            <InfoTip text="Arbeitstage pro Woche. Wer an weniger Tagen arbeitet, hat entsprechend weniger Urlaubstage." />
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
          :class="[GRID, selected === period.id ? 'bg-accent ring-ring/40 ring-1' : '', hasError(period) ? 'bg-destructive/5' : '']"
          class="rounded-lg p-1"
          @click="selected = period.id"
        >
          <NumberInput :model-value="period.from" :min="1" :max="96" aria-label="von Monat" @update:model-value="(v) => update(key, period.id, { from: v ?? period.from })" />
          <IssueTip v-slot="{ tone }" :issues="issuesAt(period, 'to')">
            <NumberInput
              :model-value="period.to"
              :min="1"
              :max="96"
              :tone="tone"
              aria-label="bis Monat"
              @update:model-value="(v) => update(key, period.id, { to: v ?? period.to })"
            />
          </IssueTip>
          <IssueTip v-slot="{ tone }" :issues="issuesAt(period, 'kind')">
            <SelectField
              :model-value="period.kind"
              :options="kindOptions"
              trigger-class="px-2 text-xs"
              :tone="tone"
              @update:model-value="(v) => update(key, period.id, { kind: v as PeriodKind })"
            />
          </IssueTip>
          <IssueTip v-slot="{ tone }" :issues="issuesAt(period, 'hours')">
            <NumberInput
              :model-value="period.hours"
              nullable
              :tone="tone"
              placeholder="?"
              :min="0"
              :max="60"
              :step="0.5"
              :decimals="2"
              aria-label="Stunden pro Woche"
              @update:model-value="(v) => update(key, period.id, { hours: v })"
            />
          </IssueTip>
          <NumberInput
            :model-value="period.hours ? (period.workDays ?? config.parents[key].workDaysPerWeek) : null"
            nullable
            :disabled="!period.hours"
            placeholder="–"
            :min="0.5"
            :max="7"
            :step="0.5"
            :decimals="1"
            aria-label="Arbeitstage pro Woche"
            @update:model-value="(v) => updateWorkDays(key, period, v)"
          />
          <IssueTip v-slot="{ tone }" :issues="issuesAt(period, 'allowance')">
            <SelectField
              :model-value="period.allowance"
              :options="allowanceOptions"
              trigger-class="px-2 text-xs"
              :tone="tone"
              @update:model-value="(v) => update(key, period.id, { allowance: v as AllowanceType })"
            />
          </IssueTip>
          <Button variant="ghost" size="icon" aria-label="Zeitraum löschen" @click.stop="remove(key, period.id)"><Trash2Icon /></Button>
        </div>
        <VacationEditor :parent-key="key" />
      </div>
    </div>
  </div>
</template>
