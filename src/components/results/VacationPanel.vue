<script setup lang="ts">
import SwitchField from '@/components/fields/SwitchField.vue'
import type { ParentKey } from '@/engine/types'
import { formatDate, num } from '@/lib/format'
import { useVariants } from '@/stores/variants'

const { result, config } = useVariants()

/** Vacation periods of a parent with their dates and days. */
function vacationPeriods(key: ParentKey) {
  const months = result.value.months
  return result.value.periods[key]
    .filter((period) => period.kind === 'vacation' && period.from <= months.length)
    .map((period) => ({
      id: period.id,
      start: months[period.from - 1].start,
      end: months[Math.min(period.to, months.length) - 1].end,
      ...result.value.vacation[key].periods[period.id],
    }))
}
</script>

<template>
  <div class="grid gap-4">
    <div class="grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
      <p class="text-muted-foreground text-xs leading-relaxed">
        Für jeden vollen Kalendermonat Elternzeit darf der Arbeitgeber den Jahresurlaub um ein Zwölftel kürzen. Nicht gekürzt
        wird, wenn man in der Elternzeit Teilzeit arbeitet, und auch nicht für den Mutterschutz. Resturlaub von vor der
        Elternzeit verfällt nicht – er kann danach noch im selben oder im nächsten Jahr genommen werden. Wer in Teilzeit an
        weniger Tagen pro Woche arbeitet, hat entsprechend weniger, aber gleich lange Urlaubstage. Geplanter Urlaub zählt
        für das Kalenderjahr, in dem er liegt.
      </p>
      <div class="md:w-64">
        <SwitchField v-model="config.employerReducesVacation" label="Arbeitgeber kürzt den Urlaub" />
      </div>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div v-for="key in result.activeParents" :key="key" class="grid content-start gap-2 rounded-lg border p-3">
        <div class="flex items-baseline justify-between">
          <span class="text-sm font-medium">{{ result.parents[key].name }}</span>
          <span class="text-muted-foreground text-xs">{{ config.parents[key].vacationDaysPerYear }} Tage/Jahr laut Vertrag</span>
        </div>
        <table class="w-full text-xs">
          <thead class="text-muted-foreground">
            <tr class="border-b">
              <th class="py-1 text-left font-medium">Jahr</th>
              <th class="py-1 text-right font-medium">Anspruch</th>
              <th class="py-1 text-right font-medium">Kürzung</th>
              <th class="py-1 text-right font-medium">geplant</th>
              <th class="py-1 text-right font-medium">übrig</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="year in result.vacation[key].years" :key="year.year" class="border-b last:border-0">
              <td class="py-1">{{ year.year }}</td>
              <td class="text-right tabular-nums">{{ num(year.annual) }}</td>
              <td class="text-right tabular-nums" :class="year.reduction > 0 ? 'text-destructive' : ''">
                {{ year.reduction > 0 ? `−${num(year.reduction)}` : '–' }}
              </td>
              <td class="text-right tabular-nums">{{ year.planned > 0 ? `−${num(year.planned)}` : '–' }}</td>
              <td class="text-right font-medium tabular-nums" :class="year.remaining < 0 ? 'text-destructive' : ''">
                {{ num(year.remaining) }} Tage
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="result.vacation[key].ranges.length" class="text-muted-foreground grid gap-0.5 text-xs">
          <span v-for="range in result.vacation[key].ranges" :key="range.start">
            Elternzeit {{ formatDate(range.start) }} – {{ formatDate(range.end) }}: {{ range.lifeMonths }} Monate,
            davon {{ range.fullCalendarMonths }} volle Kalendermonate
          </span>
          <span v-if="result.vacation[key].savedByAlignment > 0" class="text-emerald-700 dark:text-emerald-400">
            Weil die Elternzeit nicht am Monatsersten beginnt, werden {{ num(result.vacation[key].savedByAlignment) }} Tage
            weniger gekürzt als bei Elternzeit in ganzen Kalendermonaten.
          </span>
        </div>
        <p v-else class="text-muted-foreground text-xs">Keine Elternzeit ohne Arbeit, daher keine Kürzung.</p>
        <div v-if="vacationPeriods(key).length" class="text-muted-foreground grid gap-0.5 text-xs">
          <span v-for="period in vacationPeriods(key)" :key="period.id">
            Urlaub {{ formatDate(period.start) }} – {{ formatDate(period.end) }}: {{ num(period.taken) }} von
            {{ num(period.available) }} Arbeitstagen
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
