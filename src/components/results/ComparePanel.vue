<script setup lang="ts">
import { VisAxis, VisLine, VisXYContainer } from '@unovis/vue'
import { computed, ref, watch } from 'vue'
import { Checkbox } from '@/components/ui/checkbox'
import { ChartContainer, ChartCrosshair, ChartLegendContent, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { simulate } from '@/engine/simulate'
import type { SimulationResult } from '@/engine/result'
import { compactEuro, euro, fixed, num, signedEuro } from '@/engine/format'
import { useVariants } from '@/stores/variants'

const { state } = useVariants()

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
const selectedIds = ref<string[]>(state.variants.slice(0, 4).map((s) => s.id))
watch(
  () => state.variants.map((s) => s.id),
  (ids, previous) => {
    const added = ids.filter((id) => !previous?.includes(id))
    selectedIds.value = [...selectedIds.value.filter((id) => ids.includes(id)), ...added].slice(-5)
    if (!selectedIds.value.length) selectedIds.value = ids.slice(0, 4)
  },
)

function toggle(id: string, value: boolean) {
  if (value && !selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id].slice(-5)
  if (!value) selectedIds.value = selectedIds.value.filter((x) => x !== id)
}

const compared = computed(() =>
  state.variants
    .filter((s) => selectedIds.value.includes(s.id))
    .map((s, i) => ({ id: s.id, name: s.name, color: COLORS[i % COLORS.length], result: simulate(s.config) })),
)

interface Metric {
  label: string
  value: (r: SimulationResult) => string
  numeric?: (r: SimulationResult) => number
  higherIsBetter?: boolean
}

const points = (v: number) => `${v > 0 ? '+' : ''}${fixed(v, 2)}`

const metrics: Metric[] = [
  { label: 'Elterngeld gesamt', value: (r) => euro(r.totals.parentalAllowance), numeric: (r) => r.totals.parentalAllowance, higherIsBetter: true },
  { label: 'Haushaltseinkommen gesamt', value: (r) => euro(r.totals.income), numeric: (r) => r.totals.income, higherIsBetter: true },
  { label: 'Differenz zum Netto vor der Geburt', value: (r) => signedEuro(r.totals.delta), numeric: (r) => r.totals.delta, higherIsBetter: true },
  { label: 'Tiefster Kontostand', value: (r) => euro(r.totals.minBalance), numeric: (r) => r.totals.minBalance, higherIsBetter: true },
  { label: 'Kontostand am Ende', value: (r) => euro(r.totals.finalBalance), numeric: (r) => r.totals.finalBalance, higherIsBetter: true },
  {
    label: 'Elterngeld-Monatsbeträge genutzt',
    value: (r) => `${num(r.entitlement.used)} / ${r.entitlement.available}`,
    numeric: (r) => r.entitlement.used,
    higherIsBetter: true,
  },
  {
    label: 'Elternzeit-Monate',
    value: (r) => r.activeParents.map((k) => `${r.parents[k].name} ${r.parents[k].counts.leaveMonths}`).join(' · '),
  },
  {
    label: 'Rentenpunkte-Saldo',
    value: (r) => r.activeParents.map((k) => `${r.parents[k].name} ${points(r.longTerm.pension[k].pointsBalance)}`).join(' · '),
  },
  {
    label: 'Urlaubskürzung (Tage)',
    value: (r) =>
      r.activeParents
        .map((k) => `${r.parents[k].name} ${num(r.vacation[k].years.reduce((s, y) => s + y.reduction, 0))}`)
        .join(' · '),
  },
  {
    label: 'Betreuungslücke (Monate)',
    value: (r) => String(r.months.filter((m) => m.care.gap > 0.5).length),
    numeric: (r) => r.months.filter((m) => m.care.gap > 0.5).length,
    higherIsBetter: false,
  },
  {
    label: 'Fehler / Warnungen',
    value: (r) => `${r.issues.filter((i) => i.severity === 'error').length} / ${r.issues.filter((i) => i.severity === 'warning').length}`,
    numeric: (r) => r.issues.filter((i) => i.severity === 'error').length * 100 + r.issues.filter((i) => i.severity === 'warning').length,
    higherIsBetter: false,
  },
]

function isBest(metric: Metric, r: SimulationResult): boolean {
  if (!metric.numeric || compared.value.length < 2) return false
  const values = compared.value.map((c) => metric.numeric!(c.result))
  const best = metric.higherIsBetter ? Math.max(...values) : Math.min(...values)
  return metric.numeric(r) === best && values.some((v) => v !== best)
}

type Datum = { x: number } & Record<string, number>
const chartData = computed<Datum[]>(() => {
  const length = Math.max(0, ...compared.value.map((c) => c.result.months.length))
  return Array.from({ length }, (_, i) => {
    const datum: Datum = { x: i + 1 }
    compared.value.forEach((c, j) => {
      datum[`s${j}`] = c.result.months[i]?.balance ?? Number.NaN
    })
    return datum
  })
})
const chartConfig = computed<ChartConfig>(() =>
  Object.fromEntries(compared.value.map((c, j) => [`s${j}`, { label: c.name, color: c.color }])),
)

function tooltip(d: Datum | undefined): string {
  if (!d) return ''
  const rows = compared.value
    .map((c, j) => `<div class="flex justify-between gap-6"><span class="flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-sm" style="background:${c.color}"></span>${c.name}</span><span class="tabular-nums">${euro(d[`s${j}`])}</span></div>`)
    .join('')
  return `<div class="grid gap-1 rounded-lg border bg-background px-3 py-2 text-xs shadow-md text-foreground"><div class="font-medium">Monat ${d.x} – Kontostand</div>${rows}</div>`
}
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap gap-x-4 gap-y-2">
      <label v-for="variant in state.variants" :key="variant.id" class="flex items-center gap-1.5 text-sm">
        <Checkbox :model-value="selectedIds.includes(variant.id)" @update:model-value="(v) => toggle(variant.id, v === true)" />
        {{ variant.name }}
      </label>
      <span v-if="state.variants.length < 2" class="text-muted-foreground text-xs">
        Zum Vergleichen eine Variante kopieren und ändern.
      </span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[40rem] text-xs">
        <thead>
          <tr class="border-b">
            <th class="py-1.5 text-left font-medium" />
            <th v-for="c in compared" :key="c.id" class="py-1.5 text-right font-medium">
              <span class="inline-flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-sm" :style="{ background: c.color }" />{{ c.name }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="metric in metrics" :key="metric.label" class="border-b last:border-0">
            <td class="text-muted-foreground py-1.5">{{ metric.label }}</td>
            <td
              v-for="c in compared"
              :key="c.id"
              class="text-right tabular-nums"
              :class="isBest(metric, c.result) ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''"
            >
              {{ metric.value(c.result) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <ChartContainer v-if="compared.length" :config="chartConfig" class="aspect-auto h-64 w-full" cursor>
      <VisXYContainer :data="chartData" :padding="{ top: 10 }">
        <VisLine
          v-for="(c, j) in compared"
          :key="c.id"
          :x="(d: Datum) => d.x"
          :y="(d: Datum) => d[`s${j}`]"
          :color="c.color"
          :line-width="2"
        />
        <VisAxis type="x" label="Lebensmonat" :tick-format="(v: number) => String(v)" :grid-line="false" :domain-line="false" :tick-line="false" :num-ticks="12" />
        <VisAxis type="y" :tick-format="(v: number) => compactEuro(v)" :domain-line="false" :tick-line="false" :num-ticks="4" />
        <ChartTooltip />
        <ChartCrosshair :x="(d: Datum) => d.x" :y="compared.map((_, j) => (d: Datum) => d[`s${j}`])" :template="tooltip" :color="() => 'transparent'" />
      </VisXYContainer>
      <ChartLegendContent />
    </ChartContainer>
  </div>
</template>
