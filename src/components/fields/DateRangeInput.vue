<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import { CalendarRangeIcon } from '@lucide/vue'
import type { DateRange } from 'reka-ui'
import { computed, ref, shallowRef, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RangeCalendar } from '@/components/ui/range-calendar'
import { formatDate } from '@/engine/dates'
import { weekEnd, weekStart } from '@/engine/vacation'
import { TONE_BORDER, type FieldTone } from '@/lib/issues'

const from = defineModel<string>('from', { required: true })
const to = defineModel<string>('to', { required: true })
const props = defineProps<{
  min?: string
  max?: string
  markedDates?: string[]
  /** Whole weeks: the range snaps to Monday until Friday. */
  weeks?: boolean
  isDateDisabled?: (date: string) => boolean
  /** Corrects a picked range before it is saved; null keeps the previous range. */
  adjust?: (from: string, to: string) => { from: string; to: string } | null
  /** Extra line below the calendar, for the start picked so far. */
  hint?: (start: string | null) => string | null
  placeholder?: string
  /** Marks the field for an error, a warning or a tip. */
  tone?: FieldTone
}>()

const minValue = computed(() => (props.min ? parseDate(props.min) : undefined))
const maxValue = computed(() => (props.max ? parseDate(props.max) : undefined))
const marked = computed(() => new Set(props.markedDates ?? []))

const open = ref(false)
// The calendar works on a local draft; the range is only saved once start and end are picked.
const draft = shallowRef<DateRange>({ start: undefined, end: undefined })

function saved(): DateRange {
  return { start: from.value ? parseDate(from.value) : undefined, end: to.value ? parseDate(to.value) : undefined }
}

watch(open, (isOpen) => {
  if (isOpen) {
    draft.value = saved()
  }
})

// Saves every complete range; the popover stays open until the user clicks outside.
function update(range: DateRange) {
  if (!range.start || !range.end) {
    draft.value = range
    return
  }
  let next: { from: string; to: string } | null = { from: range.start.toString(), to: range.end.toString() }
  if (props.weeks) next = { from: weekStart(next.from), to: weekEnd(next.to) }
  if (props.adjust) next = props.adjust(next.from, next.to)
  if (!next) {
    draft.value = saved()
    return
  }
  from.value = next.from
  to.value = next.to
  draft.value = { start: parseDate(next.from), end: parseDate(next.to) }
}

const hintText = computed(() => props.hint?.(draft.value.start?.toString() ?? null) ?? null)
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        class="h-9 w-full justify-start font-normal"
        :class="tone && TONE_BORDER[tone]"
        :aria-invalid="tone === 'error' || undefined"
      >
        <CalendarRangeIcon class="text-muted-foreground" />
        <span v-if="from && to">{{ formatDate(from) }} – {{ formatDate(to) }}</span>
        <span v-else class="text-muted-foreground">{{ placeholder ?? 'Zeitraum wählen' }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <RangeCalendar
        :model-value="draft"
        :default-placeholder="draft.start ?? minValue"
        :min-value="minValue"
        :max-value="maxValue"
        :is-date-marked="(date) => marked.has(date.toString())"
        :is-date-disabled="isDateDisabled ? (date) => isDateDisabled!(date.toString()) : undefined"
        locale="de-DE"
        :week-starts-on="1"
        :number-of-months="2"
        fixed-weeks
        @update:model-value="update"
      />
      <p class="text-muted-foreground border-t px-3 py-2 text-xs">
        {{ weeks ? 'Erste und letzte Woche anklicken.' : 'Ersten und letzten Tag anklicken.' }} Zum Schließen daneben klicken.
        <template v-if="markedDates?.length"><br />Umrandet: Beginn eines Lebensmonats.</template>
        <template v-if="hintText"><br />{{ hintText }}</template>
      </p>
    </PopoverContent>
  </Popover>
</template>
