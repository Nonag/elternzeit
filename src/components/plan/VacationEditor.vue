<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'
import { CalendarRangeIcon, PlusIcon, Trash2Icon } from '@lucide/vue'
import { computed, ref, shallowRef } from 'vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import InfoTip from '@/components/fields/InfoTip.vue'
import WeekCalendar from '@/components/fields/WeekCalendar.vue'
import { addDays, formatDateRange, weekEnd, weekStart } from '@/engine/dates'
import { createId } from '@/engine/plan'
import type { ParentKey, VacationPeriod } from '@/engine/types'
import { count, num } from '@/engine/format'
import { toggleVacationWeek, vacationDaysByYear, vacationWeeks, workMonths } from '@/engine/vacation'
import { TONE_BORDER } from '@/lib/issues'
import { useVariants } from '@/stores/variants'
import IssueTip from './IssueTip.vue'
import { planIssues } from './planIssues'

const props = defineProps<{ parentKey: ParentKey }>()
const { config, result } = useVariants()

const periods = computed(() => [...config.value.vacation[props.parentKey]].sort((x, y) => x.from.localeCompare(y.from)))
const summary = computed(() => result.value.vacation[props.parentKey])
const months = computed(() => workMonths(result.value, props.parentKey))
const maternityEnd = computed(() => (props.parentKey === 'a' ? result.value.maternity.end : null))
const first = computed(() => result.value.months[0].start)
const last = computed(() => result.value.months[result.value.months.length - 1].end)
const lifeMonthStarts = computed(() => new Set(result.value.months.map((m) => m.start)))
const marks = computed(() => planIssues(result.value, config.value))

const left = (year: number) => summary.value.years.find((y) => y.year === year)?.remaining ?? 0

const selectedWeeks = computed(() => new Set(periods.value.flatMap(vacationWeeks)))

/** Weeks of the plan that can be added: they cost vacation days and fit into the days left in their years. */
const selectableWeeks = computed(() => {
  const weeks: string[] = []
  for (let monday = weekStart(first.value); monday <= last.value; monday = addDays(monday, 7)) {
    const cost = vacationDaysByYear(months.value, monday, weekEnd(monday), maternityEnd.value)
    if (cost.size && [...cost].every(([year, days]) => days <= left(year) + 0.001)) weeks.push(monday)
  }
  return weeks
})
const selectable = computed(() => new Set(selectableWeeks.value))

function isWeekDisabled(monday: string): boolean {
  return !selectedWeeks.value.has(monday) && !selectable.value.has(monday)
}

function toggle(monday: string) {
  config.value.vacation[props.parentKey] = toggleVacationWeek(config.value.vacation[props.parentKey], monday, () => createId('vacation'))
}

function remove(id: string) {
  config.value.vacation[props.parentKey] = periods.value.filter((p) => p.id !== id)
}

const open = ref(false)
const month = shallowRef<DateValue>(parseDate(first.value))

/** Opens at the last vacation, or else at the first week that can be picked. */
function startMonth() {
  const start = periods.value.at(-1)?.from ?? selectableWeeks.value[0] ?? first.value
  month.value = parseDate(start)
}

function openAt(date: string) {
  month.value = parseDate(date)
  open.value = true
}

// Clicking another vacation while the calendar is open only moves the calendar there.
function keepOpenForRows(event: Event) {
  const target = (event as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent?.target
  if (target instanceof Element && target.closest('[data-vacation-period]')) event.preventDefault()
}

const daysLeftText = computed(() => {
  const years = [...new Set([month.value.year, month.value.add({ months: 1 }).year])]
  return `Übrige Urlaubstage ${years.map((year) => `${year}: ${num(Math.max(0, left(year)))}`).join(' · ')}`
})

function label(period: VacationPeriod): string {
  const use = summary.value.periods[period.id]
  if (!use) return ''
  return `${count(use.weeks, 'Woche', 'Wochen')} · ${count(use.days, 'Tag', 'Tage')}`
}
</script>

<template>
  <Popover v-model:open="open">
    <div class="mt-2 grid gap-2">
      <PopoverAnchor as-child>
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground flex items-center gap-1 px-1 text-xs font-medium">
            Urlaub
            <InfoTip
              text="Bezahlter Urlaub in ganzen Wochen. Eine Woche kostet so viele Urlaubstage, wie in dieser Zeit pro Woche gearbeitet wird. In Elternzeit ohne Arbeit und im Mutterschutz gibt es keinen Urlaub."
            />
          </span>
          <PopoverTrigger as-child>
            <Button variant="outline" size="sm" @click="startMonth"><PlusIcon /> Urlaub</Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <div v-for="period in periods" :key="period.id" class="grid grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-2 px-1">
        <IssueTip v-slot="{ tone }" :issues="marks.vacation.get(period.id) ?? []">
          <Button
            variant="outline"
            class="h-9 w-full justify-start font-normal"
            :class="tone && TONE_BORDER[tone]"
            :aria-invalid="tone === 'error' || undefined"
            data-vacation-period
            @click="openAt(period.from)"
          >
            <CalendarRangeIcon class="text-muted-foreground" />
            {{ formatDateRange(period.from, period.to) }}
          </Button>
        </IssueTip>
        <span class="text-muted-foreground text-xs whitespace-nowrap tabular-nums">{{ label(period) }}</span>
        <Button variant="ghost" size="icon" aria-label="Urlaub löschen" @click="remove(period.id)"><Trash2Icon /></Button>
      </div>
    </div>
    <PopoverContent class="w-auto p-0" side="top" align="end" @interact-outside="keepOpenForRows">
      <WeekCalendar
        v-model:month="month"
        :ranges="periods"
        :is-week-disabled="isWeekDisabled"
        :min="first"
        :max="last"
        :marked-dates="lifeMonthStarts"
        @toggle="toggle"
      />
      <p class="text-muted-foreground border-t px-3 py-2 text-xs">
        Wochen an- und abklicken. Zum Schließen daneben klicken.
        <br />Umrandet: Beginn eines Lebensmonats.
        <br />{{ daysLeftText }}
      </p>
    </PopoverContent>
  </Popover>
</template>
