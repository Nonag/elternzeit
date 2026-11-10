<script setup lang="ts">
import { VisAxis, VisLine, VisPlotband, VisPlotline, VisStackedBar, VisXYContainer } from '@unovis/vue'
import { computed } from 'vue'
import { ChartContainer, ChartCrosshair, ChartLegendContent, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatDate } from '@/engine/dates'
import { euro } from '@/lib/format'
import { useScenarios } from '@/stores/scenarios'

interface Datum {
  x: number
  salaryA: number
  maternityA: number
  allowanceA: number
  salaryB: number
  allowanceB: number
  childBenefit: number
  reference: number
  expenses: number
  income: number
  period: string
}

const { result } = useScenarios()

const data = computed<Datum[]>(() =>
  result.value.months.map((m) => ({
    x: m.index,
    salaryA: m.a.netSalary,
    maternityA: m.a.maternityBenefit,
    allowanceA: m.a.parentalAllowance,
    salaryB: m.b.netSalary,
    allowanceB: m.b.parentalAllowance,
    childBenefit: m.childBenefit,
    reference: m.preBirthIncome,
    expenses: m.expenses,
    income: m.income,
    period: `Monat ${m.index} · ${formatDate(m.start)} – ${formatDate(m.end)}`,
  })),
)

const twoParents = computed(() => result.value.activeParents.length === 2)
const nameA = computed(() => result.value.parents.a.name)
const nameB = computed(() => result.value.parents.b.name)

const stackKeys = computed(() =>
  (twoParents.value
    ? (['salaryA', 'maternityA', 'allowanceA', 'salaryB', 'allowanceB', 'childBenefit'] as const)
    : (['salaryA', 'maternityA', 'allowanceA', 'childBenefit'] as const)) as readonly (keyof Datum)[],
)

const chartConfig = computed<ChartConfig>(() => ({
  salaryA: { label: `Netto-Lohn ${nameA.value}`, color: 'var(--income-salary-a)' },
  maternityA: { label: 'Mutterschaftsleistungen', color: 'var(--income-maternity-a)' },
  allowanceA: { label: `Elterngeld ${nameA.value}`, color: 'var(--income-allowance-a)' },
  ...(twoParents.value
    ? {
        salaryB: { label: `Netto-Lohn ${nameB.value}`, color: 'var(--income-salary-b)' },
        allowanceB: { label: `Elterngeld ${nameB.value}`, color: 'var(--income-allowance-b)' },
      }
    : {}),
  childBenefit: { label: 'Kindergeld', color: 'var(--income-child-benefit)' },
  reference: { label: 'Netto vor der Geburt', color: 'var(--line-reference)' },
  expenses: { label: 'Ausgaben', color: 'var(--line-expenses)' },
}))

const colors = computed(() => stackKeys.value.map((key) => chartConfig.value[key as string]?.color as string))
const accessors = computed(() => stackKeys.value.map((key) => (d: Datum) => d[key] as number))

const maternityEnd = computed(() => {
  const last = [...result.value.months].reverse().find((m) => m.a.maternityDays > 0)
  return last?.index ?? null
})
const childcareStart = computed(() => result.value.childcare.startMonthIndex)

const tickValues = computed(() => {
  const step = data.value.length > 36 ? 6 : 3
  return data.value.filter((d) => (d.x - 1) % step === 0).map((d) => d.x)
})

const compactEuro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })

function tooltip(d: Datum | undefined): string {
  if (!d) return ''
  const rows = [...stackKeys.value, 'reference', 'expenses']
    .filter((key) => key === 'reference' || key === 'expenses' || (d[key as keyof Datum] as number) > 0)
    .map((key) => {
      const entry = chartConfig.value[key as string]
      return `<div class="flex items-center justify-between gap-6"><span class="flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-sm" style="background:${entry?.color}"></span>${entry?.label}</span><span class="tabular-nums">${euro(d[key as keyof Datum] as number)}</span></div>`
    })
    .join('')
  return `<div class="grid gap-1 rounded-lg border bg-background px-3 py-2 text-xs shadow-md text-foreground"><div class="font-medium">${d.period}</div>${rows}<div class="flex justify-between gap-6 border-t pt-1 font-medium"><span>Einnahmen gesamt</span><span class="tabular-nums">${euro(d.income)}</span></div></div>`
}
</script>

<template>
  <ChartContainer :config="chartConfig" class="aspect-auto h-80 w-full" cursor>
    <VisXYContainer :data="data" :padding="{ top: 10 }">
      <VisPlotband
        v-if="maternityEnd"
        axis="x"
        :from="0.5"
        :to="maternityEnd + 0.5"
        color="color-mix(in oklch, var(--plan-maternity) 15%, transparent)"
        label-text="Mutterschutz"
        label-position="top-left-inside"
        :label-size="10"
        label-color="var(--muted-foreground)"
      />
      <VisStackedBar :x="(d: Datum) => d.x" :y="accessors" :color="colors" :bar-padding="0.15" :rounded-corners="2" />
      <VisLine :x="(d: Datum) => d.x" :y="(d: Datum) => d.reference" color="var(--line-reference)" :line-width="1.5" :line-dash-array="[5, 4]" />
      <VisLine :x="(d: Datum) => d.x" :y="(d: Datum) => d.expenses" color="var(--line-expenses)" :line-width="2" />
      <VisPlotline
        v-if="childcareStart"
        axis="x"
        :value="childcareStart - 0.5"
        color="var(--plan-childcare)"
        line-style="dash"
        :line-width="2"
        label-text="Kita-Start"
        label-position="top-right"
        :label-size="10"
        label-color="var(--muted-foreground)"
      />
      <VisAxis type="x" label="Lebensmonat" :tick-values="tickValues" :tick-format="(v: number) => String(v)" :grid-line="false" :domain-line="false" :tick-line="false" />
      <VisAxis type="y" :tick-format="(v: number) => compactEuro.format(v)" :domain-line="false" :tick-line="false" :num-ticks="5" />
      <ChartTooltip />
      <ChartCrosshair
        :x="(d: Datum) => d.x"
        :y="[(d: Datum) => d.reference, (d: Datum) => d.expenses]"
        :y-stacked="accessors"
        :template="tooltip"
        :color="() => 'transparent'"
      />
    </VisXYContainer>
    <ChartLegendContent class="flex-wrap" />
  </ChartContainer>
</template>
