<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'
import { CalendarIcon, CalendarRangeIcon, ChevronDownIcon, XIcon } from '@lucide/vue'
import { CalendarRoot, SelectTrigger as SelectTriggerPrimitive } from 'reka-ui'
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeading,
  CalendarNextButton,
  CalendarPrevButton,
} from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addDays, formatDate, formatDateRange, isoWeek, monthKey, monthName, parseIso, todayIso, weekEnd, weekStart } from '@/engine/dates'

// The one date picker of the app: a day, a range, or whole weeks that are added and taken out one by one. All modes
// share the calendar, the look of picked days and the preview, and stay open until a click outside.
type Mode = 'single' | 'range' | 'weeks'

const props = withDefaults(
  defineProps<{
    mode?: Mode
    /** Picked weeks in weeks mode, Monday to Sunday. */
    weeks?: { from: string; to: string }[]
    min?: string
    max?: string
    /** Day to open at while nothing is picked. */
    start?: string
    isDateDisabled?: (date: string) => boolean
    /** Days with a ring, e.g. the start of each life month. */
    markedDates?: string[]
    placeholder?: string
    /** A button next to the field resets the date. */
    clearable?: boolean
    /** Extra line below the calendar, e.g. for the first visible month ('YYYY-MM'). */
    hint?: string | ((month: string) => string)
    side?: 'top' | 'bottom'
    align?: 'start' | 'end'
  }>(),
  { mode: 'single', weeks: () => [], side: 'bottom', align: 'start' },
)
const date = defineModel<string | null>({ default: null })
const from = defineModel<string>('from', { default: '' })
const to = defineModel<string>('to', { default: '' })
const emit = defineEmits<{ toggleWeek: [monday: string]; interactOutside: [event: Event] }>()

const INSTRUCTION: Record<Mode, string> = {
  single: 'Tag anklicken.',
  range: 'Ersten und letzten Tag anklicken.',
  weeks: 'Wochen an- und abklicken.',
}
const PLACEHOLDER: Record<Mode, string> = { single: 'Datum wählen', range: 'Zeitraum wählen', weeks: 'Wochen wählen' }

const minValue = computed(() => (props.min ? parseDate(props.min) : undefined))
const maxValue = computed(() => (props.max ? parseDate(props.max) : undefined))
const marked = computed(() => new Set(props.markedDates ?? []))
const disabled = (day: string) => props.isDateDisabled?.(day) ?? false
// Kept empty, so every click reports its day; the picked days are drawn here instead.
const NONE: DateValue[] = []

/** First day of a range while the last one is still to be picked, and the day under the pointer. */
const draft = ref<string | null>(null)
const hovered = ref<string | null>(null)

const open = ref(false)
/** First visible month. */
const placeholder = shallowRef<DateValue>(parseDate(todayIso()))
const monthCount = computed(() => (props.mode === 'single' ? 1 : 2))
const calendar = useTemplateRef<{ $el: HTMLElement }>('calendar')
let openAt: string | undefined

/** The first day from min on that can be picked. */
function firstPickable(): string | undefined {
  if (!props.isDateDisabled || !props.min) return props.min
  const last = props.max ?? addDays(props.min, 730)
  for (let day = props.min; day <= last; day = addDays(day, 1)) if (!disabled(day)) return day
  return props.min
}

/** The day the calendar opens at: the current choice, else the start day or the first day that can be picked. */
function initialDay(): string {
  const picked = props.mode === 'single' ? date.value : props.mode === 'range' ? from.value : props.weeks.at(-1)?.from
  return picked || props.start || firstPickable() || todayIso()
}

/** Opens the calendar at the given day, or at the current choice. */
function show(at?: string) {
  if (open.value) placeholder.value = parseDate(at ?? initialDay())
  else {
    openAt = at
    open.value = true
  }
}
defineExpose({ show })

watch(open, async (isOpen) => {
  if (!isOpen) return
  const day = openAt ?? initialDay()
  placeholder.value = parseDate(day)
  openAt = undefined
  draft.value = null
  // Keyboard users start at that day.
  await nextTick()
  calendar.value?.$el.querySelector<HTMLElement>(`[data-value="${day}"]:not([data-outside-view])`)?.focus()
})

function pick(value: DateValue | DateValue[] | undefined) {
  const day = (Array.isArray(value) ? value[0] : value)?.toString()
  if (!day) return
  if (props.mode === 'single') date.value = day
  else if (props.mode === 'weeks') emit('toggleWeek', weekStart(day))
  else if (!draft.value) draft.value = day
  else {
    const [start, end] = [draft.value, day].sort()
    from.value = start
    to.value = end
    draft.value = null
  }
}

interface Band {
  from: string
  to: string
  /** From the first day of a range to the day under the pointer. */
  preview?: boolean
}

const bands = computed<Band[]>(() => {
  if (props.mode === 'weeks') return props.weeks
  if (props.mode === 'single') return date.value ? [{ from: date.value, to: date.value }] : []
  if (draft.value) {
    const [start, end] = [draft.value, hovered.value ?? draft.value].sort()
    return [{ from: start, to: end, preview: true }]
  }
  return from.value && to.value ? [{ from: from.value, to: to.value }] : []
})
const bandAt = (day: string) => bands.value.find((band) => band.from <= day && day <= band.to)

// Bands are rounded where they start and end, and where the row or the month ends.
function cellClass(value: DateValue): string[] {
  const day = value.toString()
  const band = bandAt(day)
  const left = day === weekStart(day) || value.day === 1 || day === band?.from ? 'rounded-l-md' : ''
  const right = day === weekEnd(day) || value.add({ days: 1 }).month !== value.month || day === band?.to ? 'rounded-r-md' : ''
  if (band) return [band.preview ? 'bg-primary/15' : 'bg-primary/20', left, right]
  // In weeks mode a day under the pointer previews its whole week.
  if (props.mode === 'weeks' && !disabled(weekStart(day))) return ['group-hover/week:bg-primary/15', left, right]
  return []
}

function triggerClass(value: DateValue): string[] {
  const day = value.toString()
  const band = bandAt(day)
  const edge = band && (band.preview ? day === draft.value : day === band.from || day === band.to)
  return [
    edge ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : '',
    marked.value.has(day) ? 'ring-primary/50 ring-1 ring-inset' : '',
  ]
}

const label = computed(() => {
  if (props.mode === 'single') return date.value ? formatDate(date.value) : ''
  if (props.mode === 'range') return from.value && to.value ? formatDateRange(from.value, to.value) : ''
  return ''
})
const hintText = computed(() => (typeof props.hint === 'function' ? props.hint(monthKey(placeholder.value.toString())) : props.hint))

// Header: one month has selects for month and year; two months show as text with a year select next to them.
// Months that min and max leave out cannot be shown.
const monthIndex = (year: number, month: number) => year * 12 + month - 1
const indexOf = (day: string | undefined, fallback: number) => (day ? monthIndex(parseIso(day).year, parseIso(day).month) : fallback)
const minIndex = computed(() => indexOf(props.min, -Infinity))
const maxIndex = computed(() => indexOf(props.max, Infinity))

function canShow(year: number, month: number): boolean {
  const index = monthIndex(year, month)
  return index >= minIndex.value && index + monthCount.value - 1 <= maxIndex.value
}

/** Shows the month first, as close as min and max allow. */
function showMonth(year: number, month: number) {
  const first = Math.min(Math.max(monthIndex(year, month), minIndex.value), maxIndex.value - monthCount.value + 1)
  placeholder.value = placeholder.value.set({ year: Math.floor(first / 12), month: (first % 12) + 1, day: 1 })
}

const heading = computed(() => {
  const first = placeholder.value
  const last = first.add({ months: monthCount.value - 1 })
  return first.year === last.year
    ? `${monthName(first.month)} – ${monthName(last.month)} ${last.year}`
    : `${monthName(first.month)} ${first.year} – ${monthName(last.month)} ${last.year}`
})

const years = computed(() => {
  const visible = placeholder.value.year
  const today = parseIso(todayIso()).year
  const first = props.min ? parseIso(props.min).year : Math.min(visible, today) - 1
  const last = props.max ? parseIso(props.max).year : Math.max(visible + monthCount.value - 1, today) + 3
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
})
const CAPTION_SELECT = 'h-7 gap-1 border-transparent bg-transparent px-2 font-medium shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted/50 data-[size=sm]:h-7'
</script>

<template>
  <div class="flex min-w-0 items-center gap-1">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <slot name="trigger">
          <Button variant="outline" class="h-9 min-w-0 flex-1 justify-start font-normal">
            <component :is="mode === 'single' ? CalendarIcon : CalendarRangeIcon" class="text-muted-foreground" />
            <span v-if="label" class="truncate">{{ label }}</span>
            <span v-else class="text-muted-foreground">{{ placeholder ?? PLACEHOLDER[mode] }}</span>
          </Button>
        </slot>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0" :side="side" :align="align" @interact-outside="(event: Event) => emit('interactOutside', event)">
        <CalendarRoot
          ref="calendar"
          v-slot="{ grid, weekDays }"
          v-model:placeholder="placeholder"
          class="p-3"
          multiple
          fixed-weeks
          :model-value="NONE"
          :min-value="minValue"
          :max-value="maxValue"
          :is-date-disabled="(value: DateValue) => disabled(value.toString())"
          locale="de-DE"
          :week-starts-on="1"
          :number-of-months="monthCount"
          @update:model-value="pick"
        >
          <!-- The visible months for screen readers. -->
          <CalendarHeading class="sr-only" />
          <div class="flex items-center justify-between gap-1">
            <CalendarPrevButton />
            <div class="flex items-center gap-0.5">
              <Select v-if="monthCount === 1" :model-value="String(placeholder.month)" @update:model-value="(m) => showMonth(placeholder.year, Number(m))">
                <SelectTrigger size="sm" :class="CAPTION_SELECT" aria-label="Monat">
                  <SelectValue>{{ monthName(placeholder.month) }}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="m in 12" :key="m" :value="String(m)" :disabled="!canShow(placeholder.year, m)">{{ monthName(m) }}</SelectItem>
                </SelectContent>
              </Select>
              <span v-else class="px-1 text-sm font-medium">{{ heading }}</span>
              <Select :model-value="String(placeholder.year)" @update:model-value="(y) => showMonth(Number(y), placeholder.month)">
                <SelectTrigger v-if="monthCount === 1" size="sm" :class="CAPTION_SELECT" aria-label="Jahr">
                  <SelectValue>{{ placeholder.year }}</SelectValue>
                </SelectTrigger>
                <SelectTriggerPrimitive v-else as-child>
                  <Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-foreground" aria-label="Jahr wählen">
                    <ChevronDownIcon />
                  </Button>
                </SelectTriggerPrimitive>
                <SelectContent :position="monthCount === 1 ? 'item-aligned' : 'popper'" align="center">
                  <SelectItem v-for="y in years" :key="y" :value="String(y)">{{ y }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CalendarNextButton />
          </div>
          <div class="mt-4 flex gap-4" @mouseleave="hovered = null">
            <CalendarGrid v-for="view in grid" :key="view.value.toString()">
              <CalendarGridHead>
                <CalendarGridRow>
                  <CalendarHeadCell v-if="mode === 'weeks'" class="w-8 flex-none">KW</CalendarHeadCell>
                  <CalendarHeadCell v-for="day in weekDays" :key="day" class="w-8 flex-none">{{ day }}</CalendarHeadCell>
                </CalendarGridRow>
              </CalendarGridHead>
              <CalendarGridBody>
                <CalendarGridRow v-for="dates in view.rows" :key="dates[0].toString()" class="group/week mt-2">
                  <!-- Weeks mode: the calendar week in front of each row adds or takes out the week as well. -->
                  <td v-if="mode === 'weeks'" :class="dates.every((d) => d.month !== view.value.month) ? 'invisible' : ''">
                    <button
                      type="button"
                      tabindex="-1"
                      class="text-muted-foreground hover:text-foreground flex size-8 items-center justify-center text-xs tabular-nums disabled:opacity-30"
                      :disabled="disabled(weekStart(dates[0].toString()))"
                      :aria-label="`KW ${isoWeek(dates[0].toString())}`"
                      @click="emit('toggleWeek', weekStart(dates[0].toString()))"
                    >
                      {{ isoWeek(dates[0].toString()) }}
                    </button>
                  </td>
                  <CalendarCell
                    v-for="d in dates"
                    :key="d.toString()"
                    :date="d"
                    class="flex-none"
                    :class="cellClass(d)"
                    @mouseenter="hovered = d.toString()"
                    @focusin="hovered = d.toString()"
                  >
                    <CalendarCellTrigger :day="d" :month="view.value" :class="triggerClass(d)" />
                  </CalendarCell>
                </CalendarGridRow>
              </CalendarGridBody>
            </CalendarGrid>
          </div>
        </CalendarRoot>
        <!-- w-0 min-w-full: the text wraps at the width of the calendar instead of widening it. -->
        <p class="text-muted-foreground w-0 min-w-full border-t px-3 py-2 text-xs">
          {{ INSTRUCTION[mode] }} Zum Schließen daneben klicken.
          <template v-if="markedDates?.length"><br />Umrandet: Beginn eines Lebensmonats.</template>
          <template v-if="hintText"><br />{{ hintText }}</template>
        </p>
      </PopoverContent>
    </Popover>
    <Button v-if="clearable && date" variant="ghost" size="icon" aria-label="Zurücksetzen" @click="date = null"><XIcon /></Button>
  </div>
</template>
