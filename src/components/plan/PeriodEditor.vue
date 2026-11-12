<script setup lang="ts">
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import InfoTip from '@/components/fields/InfoTip.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import SelectField from '@/components/fields/SelectField.vue'
import { formatMonthRange } from '@/engine/format'
import { createId, sortPeriods } from '@/engine/plan'
import type { Issue } from '@/engine/result'
import type { AllowanceType, ParentKey, PeriodKind, PlanPeriod } from '@/engine/types'
import { useVariants } from '@/stores/variants'
import IssueTip from './IssueTip.vue'
import { planIssues, type PeriodField } from './planIssues'
import VacationEditor from './VacationEditor.vue'

const selected = defineModel<string | null>('selected', { default: null })
const { config, result, state, loads } = useVariants()

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

/** A new period whose months are not entered or not free yet. */
type NewPeriod = Omit<PlanPeriod, 'from' | 'to'> & { from: number | null; to: number | null }

/** A row of the list: a period of the plan with the months as entered, or a new period. */
interface Row extends NewPeriod {
  isNew: boolean
  /** Why the entered months are not applied yet, if they are not. */
  pending: Issue | null
}

// Months are applied only when they fit: editing "von" or "bis" never trims or removes other periods. Entered months
// that overlap another period, or "bis" before "von", wait here and are applied as soon as the range is free.
const monthDrafts = ref<Record<string, { from: number | null; to: number | null }>>({})
const newPeriods = ref<Record<ParentKey, NewPeriod[]>>({ a: [], b: [] })

// Another variant or planning, or a plan from a preset or "Lücken schließen", starts without them.
watch([() => state.currentId, loads, () => config.value.periods], () => {
  monthDrafts.value = {}
  newPeriods.value = { a: [], b: [] }
})

/** Why months cannot be applied: missing, "bis" before "von", or an overlap with another period of the parent. */
function problem(key: ParentKey, id: string, from: number | null, to: number | null): string | null {
  if (from === null || to === null) return from === null && to === null ? '„von“ und „bis“ fehlen.' : from === null ? '„von“ fehlt.' : '„bis“ fehlt.'
  if (to < from) return '„bis“ liegt vor „von“.'
  const other = config.value.periods[key].find((p) => p.id !== id && p.from <= to && from <= p.to)
  return other ? `Überschneidet sich mit ${formatMonthRange(other.from, other.to)}. Wird übernommen, sobald der Zeitraum frei ist.` : null
}

const pendingIssue = (detail: string): Issue => ({ id: 'pending-months', severity: 'error', category: 'leave', title: 'Noch nicht übernommen', detail })

function rowsOf(key: ParentKey): Row[] {
  const applied = sortPeriods(config.value.periods[key]).map((period): Row => {
    const draft = monthDrafts.value[period.id]
    const reason = draft ? problem(key, period.id, draft.from, draft.to) : null
    return { ...period, ...draft, isNew: false, pending: reason ? pendingIssue(reason) : null }
  })
  const fresh = newPeriods.value[key].map((period): Row => {
    // An untouched new row is not an error yet.
    const reason = period.from === null && period.to === null ? null : problem(key, period.id, period.from, period.to)
    return { ...period, isNew: true, pending: reason ? pendingIssue(reason) : null }
  })
  return [...applied, ...fresh]
}

/** Applies all entered months that fit now, e.g. after the neighbouring period was shortened. */
function settle() {
  for (const key of ['a', 'b'] as ParentKey[]) {
    for (const period of config.value.periods[key]) {
      const draft = monthDrafts.value[period.id]
      if (draft && !problem(key, period.id, draft.from, draft.to)) {
        period.from = draft.from!
        period.to = draft.to!
        delete monthDrafts.value[period.id]
      }
    }
    for (const period of newPeriods.value[key]) {
      if (problem(key, period.id, period.from, period.to)) continue
      config.value.periods[key] = sortPeriods([...config.value.periods[key], { ...period, from: period.from!, to: period.to! }])
      newPeriods.value[key] = newPeriods.value[key].filter((p) => p.id !== period.id)
    }
  }
  const ids = new Set(Object.values(config.value.periods).flatMap((list) => list.map((p) => p.id)))
  for (const id of Object.keys(monthDrafts.value)) if (!ids.has(id)) delete monthDrafts.value[id]
}
watch(() => config.value.periods, settle, { deep: true })

function updateMonths(key: ParentKey, id: string, field: 'from' | 'to', value: number | null) {
  const fresh = newPeriods.value[key].find((p) => p.id === id)
  if (fresh) fresh[field] = value
  else {
    const period = config.value.periods[key].find((p) => p.id === id)
    if (!period) return
    monthDrafts.value[id] = { ...(monthDrafts.value[id] ?? { from: period.from, to: period.to }), [field]: value }
  }
  settle()
}

/** Changes anything but the months; other periods stay as they are. Hours are never filled in automatically. */
function update(key: ParentKey, id: string, patch: Partial<Omit<PlanPeriod, 'id' | 'from' | 'to'>>) {
  const fresh = newPeriods.value[key].find((p) => p.id === id)
  if (fresh) Object.assign(fresh, patch)
  else config.value.periods[key] = config.value.periods[key].map((p) => (p.id === id ? { ...p, ...patch } : p))
}

/** A new period starts empty and is added to the plan once its months are entered and free. */
function add(key: ParentKey) {
  const period: NewPeriod = { id: createId('period'), from: null, to: null, kind: 'leave', hours: null, workDays: null, allowance: 'none' }
  newPeriods.value[key] = [...newPeriods.value[key], period]
  selected.value = period.id
}

function remove(key: ParentKey, id: string) {
  newPeriods.value[key] = newPeriods.value[key].filter((p) => p.id !== id)
  config.value.periods[key] = config.value.periods[key].filter((b) => b.id !== id)
  delete monthDrafts.value[id]
  if (selected.value === id) selected.value = null
}

/** Working days of the contract are stored as null, so the period follows changes of the contract. */
function updateWorkDays(key: ParentKey, period: Row, days: number | null) {
  update(key, period.id, { workDays: days === null || days === config.value.parents[key].workDaysPerWeek ? null : days })
}

const marks = computed(() => planIssues(result.value, config.value))
const NONE: Issue[] = []
const FIELDS: PeriodField[] = ['to', 'kind', 'hours', 'workDays', 'allowance']

function issuesAt(row: Row, field: PeriodField): Issue[] {
  return marks.value.fields.get(`${row.id}:${field}`) ?? NONE
}

/** The issues of a month field, with the reason first when the entered months are not applied yet. */
function monthIssues(row: Row, field: 'from' | 'to'): Issue[] {
  const issues = field === 'to' ? issuesAt(row, 'to') : NONE
  return row.pending ? [row.pending, ...issues] : issues
}

function hasError(row: Row): boolean {
  return !!row.pending || FIELDS.some((field) => issuesAt(row, field).some((issue) => issue.severity === 'error'))
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
            <InfoTip
              text="Arbeitstage pro Woche. Wer an weniger Tagen arbeitet, hat entsprechend weniger Urlaubstage.
Betreuung ist nur an Tagen nötig, an denen beide Eltern arbeiten. Gerechnet wird so, als lägen ihre Arbeitstage möglichst nicht auf denselben Tagen."
            />
          </span>
          <span class="flex items-center gap-1">
            Elterngeld
            <InfoTip
              text="Basiselterngeld: voller Betrag, bis zum 14. Lebensmonat.
ElterngeldPlus: halber Betrag, doppelt so lange, gut bei Teilzeit.
Partnerschaftsbonus: zusätzliche Plus-Monate, wenn beide gleichzeitig 24–32 Stunden arbeiten."
            />
          </span>
          <span />
        </div>
        <p v-if="!rowsOf(key).length" class="text-muted-foreground px-1 py-2 text-xs">
          Noch keine Zeiträume. {{ result.parents[key].name }} arbeitet durchgehend wie bisher.
        </p>
        <div
          v-for="period in rowsOf(key)"
          :key="period.id"
          :class="[GRID, selected === period.id ? 'bg-accent ring-ring/40 ring-1' : '', hasError(period) ? 'bg-destructive/5' : '']"
          class="rounded-lg p-1"
          @click="selected = period.id"
        >
          <IssueTip v-slot="{ tone }" :issues="monthIssues(period, 'from')">
            <NumberInput
              :model-value="period.from"
              nullable
              :min="1"
              :max="96"
              :tone="tone"
              aria-label="von Monat"
              @update:model-value="(v) => updateMonths(key, period.id, 'from', v)"
            />
          </IssueTip>
          <IssueTip v-slot="{ tone }" :issues="monthIssues(period, 'to')">
            <NumberInput
              :model-value="period.to"
              nullable
              :min="1"
              :max="96"
              :tone="tone"
              aria-label="bis Monat"
              @update:model-value="(v) => updateMonths(key, period.id, 'to', v)"
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
          <IssueTip v-slot="{ tone }" :issues="issuesAt(period, 'workDays')">
            <NumberInput
              :model-value="period.hours ? (period.workDays ?? config.parents[key].workDaysPerWeek) : null"
              nullable
              :disabled="!period.hours"
              :tone="tone"
              placeholder="–"
              :min="0.5"
              :max="7"
              :step="0.5"
              :decimals="1"
              aria-label="Arbeitstage pro Woche"
              @update:model-value="(v) => updateWorkDays(key, period, v)"
            />
          </IssueTip>
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
