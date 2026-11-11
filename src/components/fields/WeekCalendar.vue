<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'
import { CalendarRoot } from 'reka-ui'
import { computed } from 'vue'
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNextButton,
  CalendarPrevButton,
} from '@/components/ui/calendar'
import { isoWeek, weekEnd, weekStart } from '@/engine/vacation'

// Whole weeks: a click on a day or on the calendar week (KW) adds the week or takes it out again. Picked periods
// and the hovered week look like the range and its preview in the other date pickers.
const month = defineModel<DateValue>('month', { required: true })
const props = defineProps<{
  /** Picked periods, Monday to Sunday. */
  ranges: { from: string; to: string }[]
  isWeekDisabled: (monday: string) => boolean
  min?: string
  max?: string
  markedDates?: Set<string>
}>()
const emit = defineEmits<{ toggle: [monday: string] }>()

const minValue = computed(() => (props.min ? parseDate(props.min) : undefined))
const maxValue = computed(() => (props.max ? parseDate(props.max) : undefined))
// Kept empty, so every click reports its day; the picked weeks are drawn here instead.
const NONE: DateValue[] = []

const mondayOf = (date: DateValue) => weekStart(date.toString())
const rangeAt = (day: string) => props.ranges.find((r) => r.from <= day && day <= r.to)

function pick(dates: DateValue | DateValue[] | undefined) {
  const date = Array.isArray(dates) ? dates[0] : dates
  if (date) emit('toggle', mondayOf(date))
}

// Bands are rounded where they start and end, and where the row or the month ends.
function cellClass(date: DateValue): string[] {
  const day = date.toString()
  const monday = mondayOf(date)
  const range = rangeAt(day)
  const monthStart = date.day === 1
  const monthEnd = date.add({ days: 1 }).month !== date.month
  const left = day === monday || monthStart ? 'rounded-l-md' : ''
  const right = day === weekEnd(day) || monthEnd ? 'rounded-r-md' : ''
  if (range) return ['bg-primary/20', left, right]
  return props.isWeekDisabled(monday) ? [] : ['group-hover/week:bg-primary/15', left, right]
}

function triggerClass(date: DateValue): string[] {
  const day = date.toString()
  const range = rangeAt(day)
  const edge = range && (day === range.from || day === range.to)
  return [
    edge ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : '',
    props.markedDates?.has(day) ? 'ring-primary/50 ring-1 ring-inset' : '',
  ]
}
</script>

<template>
  <CalendarRoot
    v-slot="{ grid, weekDays }"
    v-model:placeholder="month"
    data-slot="week-calendar"
    class="p-3"
    multiple
    fixed-weeks
    :model-value="NONE"
    :min-value="minValue"
    :max-value="maxValue"
    :is-date-disabled="(date) => isWeekDisabled(mondayOf(date))"
    locale="de-DE"
    :week-starts-on="1"
    :number-of-months="2"
    @update:model-value="pick"
  >
    <CalendarHeader class="px-0">
      <CalendarHeading />
      <nav class="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between">
        <CalendarPrevButton />
        <CalendarNextButton />
      </nav>
    </CalendarHeader>
    <div class="mt-4 flex gap-4">
      <CalendarGrid v-for="view in grid" :key="view.value.toString()">
        <CalendarGridHead>
          <CalendarGridRow>
            <CalendarHeadCell class="w-8 flex-none">KW</CalendarHeadCell>
            <CalendarHeadCell v-for="day in weekDays" :key="day" class="w-8 flex-none">{{ day }}</CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow v-for="dates in view.rows" :key="dates[0].toString()" class="group/week mt-2">
            <td :class="dates.every((date) => date.month !== view.value.month) ? 'invisible' : ''">
              <button
                type="button"
                tabindex="-1"
                class="text-muted-foreground hover:text-foreground flex size-8 items-center justify-center text-xs tabular-nums disabled:opacity-30"
                :disabled="!rangeAt(mondayOf(dates[0])) && isWeekDisabled(mondayOf(dates[0]))"
                :aria-label="`KW ${isoWeek(mondayOf(dates[0]))}`"
                @click="emit('toggle', mondayOf(dates[0]))"
              >
                {{ isoWeek(mondayOf(dates[0])) }}
              </button>
            </td>
            <CalendarCell v-for="date in dates" :key="date.toString()" :date="date" class="flex-none" :class="cellClass(date)">
              <CalendarCellTrigger :day="date" :month="view.value" :class="triggerClass(date)" />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>
