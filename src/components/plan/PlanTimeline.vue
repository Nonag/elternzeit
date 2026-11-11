<script setup lang="ts">
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate, formatMonthKey } from '@/engine/dates'
import type { MonthRow } from '@/engine/result'
import type { ParentKey } from '@/engine/types'
import { num } from '@/lib/format'
import { useVariants } from '@/stores/variants'
import { LEGEND, monthStyle } from './planStyle'

const emit = defineEmits<{ select: [parent: ParentKey, from: number, to: number, periodId: string | null] }>()
const props = defineProps<{ selectedPeriodId?: string | null }>()

const { result, config } = useVariants()

interface Segment {
  key: string
  from: number
  to: number
  label: string
  short: string
  color: string
  textClass: string
  striped?: boolean
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
      const style = monthStyle(row[key])
      return { ...style, periodId: row[key].periodId }
    }),
  }))
  const family = buildSegments(months.value, (row) =>
    row.care.family > 0.5
      ? {
          label: `Familie/Freunde: ${num(row.care.family)} h/Woche`,
          short: `${num(row.care.family)} h`,
          color: 'var(--plan-family)',
          textClass: 'text-foreground',
          periodId: null,
        }
      : null,
  )
  const childcare = buildSegments(months.value, (row) =>
    row.care.childcare > 0
      ? {
          label: row.care.settlingIn ? 'Kita-Eingewöhnung' : `Kita ${config.value.childcare.hoursPerWeek} h/Woche`,
          short: row.care.settlingIn ? 'Eingew.' : `Kita ${config.value.childcare.hoursPerWeek} h`,
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
          short: `Lücke`,
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
  const lmRange = segment.from === segment.to ? `Monat ${segment.from}` : `Monat ${segment.from}–${segment.to}`
  return `${lmRange} · ${formatDate(first.start)} – ${formatDate(last.end)}`
}

function onClick(parent: ParentKey | null, segment: Segment) {
  if (parent) emit('select', parent, segment.from, segment.to, segment.periodId)
}
</script>

<template>
  <div class="grid gap-3">
    <div class="overflow-x-auto pb-1">
      <div class="relative grid gap-y-1.5" :style="gridStyle">
        <div class="text-muted-foreground sticky left-0 z-10 bg-card text-[0.65rem]">Lebensmonat</div>
        <div
          v-for="row in months"
          :key="`h-${row.index}`"
          class="text-muted-foreground text-center text-[0.65rem] tabular-nums"
          :title="`${formatDate(row.start)} – ${formatDate(row.end)} (${formatMonthKey(row.calendarMonth)})`"
        >
          {{ row.index }}
        </div>

        <template v-for="lane in lanes" :key="lane.id">
          <div class="sticky left-0 z-10 flex items-center truncate bg-card pr-2 text-xs font-medium">{{ lane.title }}</div>
          <div class="relative grid h-7" :style="{ gridColumn: '2 / -1', gridTemplateColumns: `repeat(${horizon}, minmax(1.2rem, 1fr))` }">
            <div class="bg-muted/40 row-start-1 rounded" :style="{ gridColumn: `1 / ${horizon + 1}` }" />
            <Tooltip v-for="segment in lane.segments" :key="segment.key">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="row-start-1 mx-px flex items-center overflow-hidden rounded px-1 text-[0.65rem] font-medium whitespace-nowrap transition-shadow"
                  :class="[
                    segment.textClass,
                    segment.striped ? 'plan-stripes' : '',
                    lane.parent ? 'cursor-pointer hover:ring-2 hover:ring-ring' : 'cursor-default',
                    props.selectedPeriodId && segment.periodId === props.selectedPeriodId ? 'ring-2 ring-foreground' : '',
                    segment.color === 'var(--plan-work)' ? 'border border-dashed' : '',
                  ]"
                  :style="{ gridColumn: `${segment.from} / ${segment.to + 1}`, backgroundColor: segment.color }"
                  @click="onClick(lane.parent, segment)"
                >
                  <span v-if="segment.to - segment.from >= 1" class="truncate">{{ segment.short }}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div class="grid gap-0.5">
                  <span class="font-medium">{{ segment.label }}</span>
                  <span class="opacity-80">{{ rangeLabel(segment) }}</span>
                </div>
              </TooltipContent>
            </Tooltip>
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
        <span class="inline-block size-3 rounded-sm" :class="item.striped ? 'plan-stripes' : ''" :style="{ backgroundColor: item.color }" />
        {{ item.label }}
      </span>
      <span class="flex items-center gap-1.5"><span class="inline-block size-3 rounded-sm border border-dashed" /> Arbeit</span>
    </div>
  </div>
</template>
