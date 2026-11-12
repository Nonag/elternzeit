<script setup lang="ts">
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { diffDays, formatDateRange, formatMonthKey } from '@/engine/dates'
import type { MonthRow } from '@/engine/result'
import type { ParentKey } from '@/engine/types'
import { count, formatMonthRange, num } from '@/engine/format'
import { useVariants } from '@/stores/variants'
import IssueMarker from './IssueMarker.vue'
import { planIssues } from './planIssues'
import { LEGEND, monthStyle } from './planStyle'

const emit = defineEmits<{ select: [periodId: string] }>()
const props = defineProps<{ selectedPeriodId?: string | null }>()

const { result, config } = useVariants()
const laneIssues = computed(() => planIssues(result.value, config.value).lanes)

interface Segment {
  key: string
  from: number
  to: number
  label: string
  short: string
  /** Shown when the segment is one life month wide. */
  tiny: string
  color: string
  textClass: string
  striped?: boolean
  borderClass?: string
  periodId: string | null
}

function buildSegments(months: MonthRow[], pick: (row: MonthRow) => Omit<Segment, 'key' | 'from' | 'to'> | null): Segment[] {
  const segments: Segment[] = []
  for (const row of months) {
    const value = pick(row)
    if (!value) continue
    const last = segments[segments.length - 1]
    if (last && last.to === row.index - 1 && last.short === value.short && last.color === value.color && last.periodId === value.periodId) {
      last.to = row.index
    } else {
      segments.push({ ...value, key: `${row.index}-${value.short}`, from: row.index, to: row.index })
    }
  }
  return segments
}

const months = computed(() => result.value.months)
const horizon = computed(() => months.value.length)

const lanes = computed(() => {
  const parentLanes = result.value.activeParents.map((key) => ({
    id: key,
    title: result.value.parents[key].name,
    parent: key as ParentKey | null,
    segments: buildSegments(months.value, (row) => {
      const style = monthStyle(row[key], config.value.parents[key].weeklyHours)
      return { ...style, periodId: row[key].periodId }
    }),
  }))
  // Family and friends by name, e.g. "Claudia 8 h"; one life month shows the hours only.
  const familyNames = (row: MonthRow) =>
    config.value.familyCare
      .filter((p) => p.from && p.to && p.daysPerWeek && p.hoursPerDay && p.from <= row.end && row.start <= p.to && p.label.trim())
      .map((p) => p.label.trim())
      .join(' + ')
  const family = buildSegments(months.value, (row) => {
    if (row.care.family <= 0.5) return null
    const names = familyNames(row)
    const hours = `${num(row.care.family)} h`
    return {
          label: `${names || 'Familie/Freunde'}: ${hours}/Woche`,
          short: names ? `${names} ${hours}` : hours,
          tiny: hours,
          color: 'var(--plan-family)',
          textClass: 'text-foreground',
          periodId: null,
        }
  })
  const childcare = buildSegments(months.value, (row) =>
    row.care.childcare > 0
      ? {
          label: row.care.settlingIn ? 'Kita-Eingewöhnung' : `Kita ${config.value.childcare.hoursPerWeek} h/Woche`,
          short: row.care.settlingIn ? 'Kita' : `Kita ${config.value.childcare.hoursPerWeek} h`,
          tiny: 'Kita',
          color: 'var(--plan-childcare)',
          textClass: 'text-foreground',
          periodId: null,
        }
      : null,
  )
  const gaps = buildSegments(months.value, (row) =>
    row.care.gap > 0.5
      ? {
          label: `Betreuungslücke: ${num(row.care.gap)} h/Woche`,
          short: `${num(row.care.gap)} h`,
          tiny: `${num(row.care.gap)} h`,
          color: 'var(--destructive)',
          textClass: 'text-white',
          periodId: null,
        }
      : null,
  )
  return [
    ...parentLanes,
    { id: 'family', title: 'Familie', parent: null, segments: family },
    { id: 'childcare', title: 'Kita', parent: null, segments: childcare },
    { id: 'gaps', title: 'Lücken', parent: null, segments: gaps },
  ]
})

/** Vacation weeks per parent, positioned to the day on the life-month grid. */
const vacationBars = computed(() => {
  const rows = months.value
  const first = rows[0].start
  const last = rows[rows.length - 1].end
  const position = (date: string, endOfDay: boolean) => {
    const i = rows.findIndex((row) => row.start <= date && date <= row.end)
    if (i < 0) return date < first ? 0 : 1
    return (i + (diffDays(rows[i].start, date) + (endOfDay ? 1 : 0)) / rows[i].days) / rows.length
  }
  return Object.fromEntries(
    result.value.activeParents.map((key) => [
      key,
      config.value.vacation[key]
        .filter((v) => v.from && v.to && v.to >= first && v.from <= last)
        .map((v) => {
          const use = result.value.vacation[key].periods[v.id]
          const left = position(v.from, false)
          return {
            id: v.id,
            left,
            width: position(v.to, true) - left,
            dates: formatDateRange(v.from, v.to),
            days: use ? `${count(use.weeks, 'Woche', 'Wochen')}, ${count(use.days, 'Urlaubstag', 'Urlaubstage')}` : '',
          }
        }),
    ]),
  ) as Record<ParentKey, { id: string; left: number; width: number; dates: string; days: string }[]>
})

const markers = computed(() => {
  const list: { month: number; label: string; className: string }[] = []
  for (const row of months.value) {
    if (row.markers.includes('birthday')) list.push({ month: row.index, label: `${(row.index - 1) / 12}. Geburtstag`, className: 'border-foreground/40' })
    if (row.markers.includes('lastBasic')) list.push({ month: row.index + 1, label: 'ab hier nur Plus', className: 'border-dashed border-sky-600/60' })
  }
  return list
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `6rem repeat(${horizon.value}, minmax(1.2rem, 1fr))`,
}))

function rangeLabel(segment: Segment): string {
  const first = months.value[segment.from - 1]
  const last = months.value[segment.to - 1]
  return `${formatMonthRange(segment.from, segment.to)} · ${formatDateRange(first.start, last.end)}`
}
</script>

<template>
  <div class="grid gap-3">
    <div class="overflow-x-auto pb-1">
      <div class="relative grid gap-y-1.5" :style="gridStyle">
        <div class="text-muted-foreground sticky left-0 z-10 bg-card text-[0.65rem]">Lebensmonat</div>
        <Tooltip v-for="row in months" :key="`h-${row.index}`">
          <TooltipTrigger as-child>
            <div class="text-muted-foreground cursor-default text-center text-[0.65rem] tabular-nums">{{ row.index }}</div>
          </TooltipTrigger>
          <TooltipContent>
            <div class="grid gap-0.5">
              <span class="font-medium">Monat {{ row.index }}</span>
              <span class="opacity-80">{{ formatDateRange(row.start, row.end) }} ({{ formatMonthKey(row.calendarMonth) }})</span>
            </div>
          </TooltipContent>
        </Tooltip>

        <template v-for="lane in lanes" :key="lane.id">
          <div class="sticky left-0 z-10 flex items-center gap-1 bg-card pr-2 text-xs font-medium">
            <span class="truncate">{{ lane.title }}</span>
            <IssueMarker :issues="laneIssues.get(lane.id) ?? []" />
          </div>
          <div class="relative grid h-7" :style="{ gridColumn: '2 / -1', gridTemplateColumns: `repeat(${horizon}, minmax(1.2rem, 1fr))` }">
            <div class="bg-muted/40 row-start-1 rounded" :style="{ gridColumn: `1 / ${horizon + 1}` }" />
            <Tooltip v-for="segment in lane.segments" :key="segment.key">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="row-start-1 mx-px flex items-center overflow-hidden rounded text-[0.65rem] font-medium whitespace-nowrap transition-shadow"
                  :class="[
                    segment.to > segment.from ? 'px-1' : 'justify-center px-0.5',
                    segment.textClass,
                    segment.striped ? 'plan-stripes' : '',
                    lane.parent ? 'hover:ring-2 hover:ring-ring' : '',
                    lane.parent && segment.periodId ? 'cursor-pointer' : 'cursor-default',
                    props.selectedPeriodId && segment.periodId === props.selectedPeriodId ? 'ring-2 ring-foreground' : '',
                    segment.borderClass,
                  ]"
                  :style="{ gridColumn: `${segment.from} / ${segment.to + 1}`, backgroundColor: segment.color }"
                  @click="segment.periodId && lane.parent && emit('select', segment.periodId)"
                >
                  <span class="truncate">{{ segment.to > segment.from ? segment.short : segment.tiny }}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div class="grid gap-0.5">
                  <span class="font-medium">{{ segment.label }}</span>
                  <span class="opacity-80">{{ rangeLabel(segment) }}</span>
                </div>
              </TooltipContent>
            </Tooltip>
            <template v-if="lane.parent">
              <Tooltip v-for="bar in vacationBars[lane.parent]" :key="bar.id">
                <TooltipTrigger as-child>
                  <!-- A thick bottom border of the lane, so the labels stay readable. -->
                  <div
                    class="absolute bottom-0 z-10 h-2.25 min-w-1 rounded-xs"
                    :style="{ left: `${bar.left * 100}%`, width: `${bar.width * 100}%`, backgroundColor: 'var(--plan-vacation)' }"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div class="grid gap-0.5">
                    <span class="font-medium">Urlaub: {{ bar.days }}</span>
                    <span class="opacity-80">{{ bar.dates }}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </template>
          </div>
        </template>

        <div
          v-for="marker in markers"
          :key="`m-${marker.month}-${marker.label}`"
          class="pointer-events-none absolute top-4 bottom-0 border-l"
          :class="marker.className"
          :style="{ left: `calc(6rem + (100% - 6rem) * ${(marker.month - 1) / horizon})` }"
          :title="marker.label"
        />
      </div>
    </div>
    <div class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem]">
      <span v-for="item in LEGEND" :key="item.label" class="flex items-center gap-1.5">
        <span class="inline-block" :class="[item.line ? 'h-2.25 w-4 rounded-xs' : 'size-3 rounded-sm', item.striped ? 'plan-stripes' : '']" :style="{ backgroundColor: item.color }" />
        {{ item.label }}
      </span>
      <span class="flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm border border-dashed" /> Arbeit</span>
    </div>
  </div>
</template>
