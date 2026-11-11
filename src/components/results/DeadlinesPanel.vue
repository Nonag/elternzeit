<script setup lang="ts">
import { CalendarCheckIcon, CircleAlertIcon, CircleCheckIcon, ClockIcon, FlagIcon } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { diffDays } from '@/engine/dates'
import type { Deadline, DeadlineStatus } from '@/engine/deadlines'
import { formatDate } from '@/lib/format'
import { useVariants } from '@/stores/variants'

const { deadlines, config, today, result } = useVariants()
const hidePast = ref(false)

const STATUS: Record<DeadlineStatus, { label: string; className: string; icon: typeof ClockIcon }> = {
  missed: { label: 'Frist vorbei', className: 'bg-destructive/10 text-destructive', icon: CircleAlertIcon },
  soon: { label: 'bald fällig', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', icon: ClockIcon },
  upcoming: { label: 'offen', className: 'bg-secondary text-secondary-foreground', icon: ClockIcon },
  done: { label: 'erledigt', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', icon: CircleCheckIcon },
  event: { label: 'Termin', className: 'bg-sky-100 text-sky-800', icon: FlagIcon },
  'past-event': { label: 'vergangen', className: 'bg-muted text-muted-foreground', icon: FlagIcon },
}

const CATEGORY: Record<string, string> = {
  leave: 'Elternzeit',
  allowance: 'Elterngeld',
  benefits: 'Leistungen',
  tax: 'Steuer',
  childcare: 'Kita',
  family: 'Familie',
  insurance: 'Versicherung',
  event: 'Termin',
}

const visible = computed(() =>
  deadlines.value.filter((d) => !hidePast.value || !(d.status === 'done' || d.status === 'past-event')),
)

function relative(date: string): string {
  const days = diffDays(today, date)
  if (days === 0) return 'heute'
  if (Math.abs(days) < 60) return days > 0 ? `in ${days} Tagen` : `vor ${-days} Tagen`
  const months = Math.round(Math.abs(days) / 30.4)
  return days > 0 ? `in ${months} Monaten` : `vor ${months} Monaten`
}

function toggle(deadline: Deadline, done: boolean) {
  const list = config.value.doneDeadlines
  const index = list.indexOf(deadline.id)
  if (done && index < 0) list.push(deadline.id)
  if (!done && index >= 0) list.splice(index, 1)
}
</script>

<template>
  <div class="grid gap-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-muted-foreground text-xs">
        Berechnet aus {{ result.birth === result.dueDate ? 'dem errechneten Termin' : 'dem Geburtsdatum' }} und eurem Plan – Stand heute
        ({{ formatDate(today) }}). Abhaken wird in der Variante gespeichert.
      </p>
      <label class="flex items-center gap-1.5 text-xs">
        <Checkbox v-model="hidePast" /> Erledigtes und Vergangenes ausblenden
      </label>
    </div>
    <ol class="relative grid gap-2 border-l pl-4">
      <li v-for="deadline in visible" :key="deadline.id" class="relative grid gap-1 rounded-lg border p-3">
        <component
          :is="STATUS[deadline.status].icon"
          class="bg-card absolute top-3.5 -left-[1.4rem] size-4 rounded-full"
          :class="deadline.status === 'missed' ? 'text-destructive' : deadline.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'"
        />
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold tabular-nums">{{ formatDate(deadline.date) }}</span>
          <span class="text-muted-foreground text-xs">{{ relative(deadline.date) }}</span>
          <span class="rounded-full px-2 py-0.5 text-[0.65rem] font-medium" :class="STATUS[deadline.status].className">
            {{ STATUS[deadline.status].label }}
          </span>
          <Badge variant="outline" class="font-normal">{{ CATEGORY[deadline.category] }}</Badge>
          <label v-if="!deadline.isEvent" class="ml-auto flex items-center gap-1.5 text-xs">
            <Checkbox
              :model-value="deadline.status === 'done'"
              @update:model-value="(v) => toggle(deadline, v === true)"
            />
            erledigt
          </label>
        </div>
        <div class="flex items-center gap-1.5 text-sm font-medium">
          <CalendarCheckIcon v-if="!deadline.isEvent" class="text-muted-foreground size-3.5" />
          {{ deadline.title }}
        </div>
        <p class="text-muted-foreground text-xs leading-relaxed">
          {{ deadline.detail }}
          <span v-if="deadline.earliest"> Frühestens ab {{ formatDate(deadline.earliest) }}.</span>
        </p>
      </li>
    </ol>
  </div>
</template>
