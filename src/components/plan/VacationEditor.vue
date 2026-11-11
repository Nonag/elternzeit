<script setup lang="ts">
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import DateRangeInput from '@/components/fields/DateRangeInput.vue'
import InfoTip from '@/components/fields/InfoTip.vue'
import { addDays, parseIso } from '@/engine/dates'
import { createId } from '@/engine/plan'
import type { ParentKey, VacationPeriod } from '@/engine/types'
import { isWeekday, vacationDayCost, vacationDays, weekEnd, workMonths } from '@/engine/vacation'
import { num } from '@/lib/format'
import { useVariants } from '@/stores/variants'
import IssueTip from './IssueTip.vue'
import { planIssues } from './planIssues'

const props = defineProps<{ parentKey: ParentKey }>()
const { config, result } = useVariants()

const periods = computed(() => config.value.vacation[props.parentKey])
const summary = computed(() => result.value.vacation[props.parentKey])
const months = computed(() => workMonths(result.value, props.parentKey))
const maternityEnd = computed(() => (props.parentKey === 'a' ? result.value.maternity.end : null))
const first = computed(() => result.value.months[0].start)
const last = computed(() => result.value.months[result.value.months.length - 1].end)
const lifeMonthStarts = computed(() => result.value.months.map((m) => m.start))
const marks = computed(() => planIssues(result.value, config.value))

const yearOf = (date: string) => parseIso(date).year

function add() {
  config.value.vacation[props.parentKey].push({ id: createId('vacation'), from: '', to: '' })
}

function remove(id: string) {
  config.value.vacation[props.parentKey] = periods.value.filter((p) => p.id !== id)
}

/** Vacation days left in a calendar year without the given period itself. */
function daysLeft(year: number, own: VacationPeriod): number {
  const remaining = summary.value.years.find((y) => y.year === year)?.remaining ?? 0
  const ownDays = own.from && yearOf(own.from) === year ? (summary.value.periods[own.id]?.days ?? 0) : 0
  return remaining + ownDays
}

/** Keeps the weeks in one calendar year (the week around New Year may cross it) and within the days left there. */
function adjust(own: VacationPeriod, from: string, to: string) {
  const yearEnd = weekEnd(`${yearOf(from)}-12-31`)
  let end = to < yearEnd ? to : yearEnd
  const left = daysLeft(yearOf(from), own)
  while (end > from && vacationDays(months.value, from, end, maternityEnd.value) > left + 0.001) end = addDays(end, -7)
  return end > from ? { from, to: end } : null
}

function isDisabled(date: string): boolean {
  return isWeekday(date) && vacationDayCost(months.value, date, maternityEnd.value) === 0
}

function hint(own: VacationPeriod, start: string | null): string {
  const year = yearOf(start ?? (own.from || first.value))
  return `Ganze Wochen in einem Kalenderjahr. ${year} sind noch ${num(daysLeft(year, own))} Urlaubstage übrig.`
}

function label(period: VacationPeriod): string {
  const use = summary.value.periods[period.id]
  if (!period.from || !use) return ''
  return `${use.weeks} ${use.weeks === 1 ? 'Woche' : 'Wochen'} · ${num(use.days)} Tage`
}
</script>

<template>
  <div class="mt-2 grid gap-2">
    <div class="flex items-center justify-between">
      <span class="text-muted-foreground flex items-center gap-1 px-1 text-xs font-medium">
        Urlaub
        <InfoTip
          text="Bezahlter Urlaub in ganzen Wochen. Eine Woche kostet so viele Urlaubstage, wie in dieser Zeit pro Woche gearbeitet wird. In Elternzeit ohne Arbeit und im Mutterschutz gibt es keinen Urlaub."
        />
      </span>
      <Button variant="outline" size="sm" @click="add"><PlusIcon /> Urlaub</Button>
    </div>
    <div v-for="period in periods" :key="period.id" class="grid grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-2 px-1">
      <IssueTip v-slot="{ tone }" :issues="marks.vacation.get(period.id) ?? []">
        <DateRangeInput
          v-model:from="period.from"
          v-model:to="period.to"
          weeks
          :min="first"
          :max="last"
          :marked-dates="lifeMonthStarts"
          :is-date-disabled="isDisabled"
          :adjust="(from, to) => adjust(period, from, to)"
          :hint="(start) => hint(period, start)"
          placeholder="Wochen wählen"
          :tone="tone"
        />
      </IssueTip>
      <span class="text-muted-foreground text-xs whitespace-nowrap tabular-nums">{{ label(period) }}</span>
      <Button variant="ghost" size="icon" aria-label="Urlaub löschen" @click="remove(period.id)"><Trash2Icon /></Button>
    </div>
  </div>
</template>
