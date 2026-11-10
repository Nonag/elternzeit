<script setup lang="ts">
import { VisArea, VisAxis, VisLine, VisPlotline, VisXYContainer } from '@unovis/vue'
import { computed } from 'vue'
import { ChartContainer, ChartCrosshair, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatDate } from '@/engine/dates'
import { euro, signedEuro } from '@/lib/format'
import { useScenarios } from '@/stores/scenarios'

interface Datum {
  x: number
  balance: number
  change: number
  period: string
}

const { result, config } = useScenarios()

const data = computed<Datum[]>(() => [
  { x: 0, balance: result.value.totals.initialBalance, change: 0, period: 'Zur Geburt (nach Einmalkosten)' },
  ...result.value.months.map((m) => ({
    x: m.index,
    balance: m.balance,
    change: m.balanceChange,
    period: `Monat ${m.index} · ${formatDate(m.start)} – ${formatDate(m.end)}`,
  })),
])

const chartConfig: ChartConfig = {
  balance: { label: 'Kontostand', color: 'var(--line-balance)' },
}

const yDomain = computed<[number, number]>(() => {
  const values = data.value.map((d) => d.balance)
  const min = Math.min(0, config.value.minReserve, ...values)
  const max = Math.max(config.value.minReserve, ...values)
  const pad = (max - min) * 0.08 || 1000
  return [min < 0 ? min - pad : 0, max + pad]
})

const tickValues = computed(() => {
  const step = data.value.length > 37 ? 6 : 3
  return data.value.filter((d) => d.x % step === 0).map((d) => d.x)
})

const compactEuro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })

function tooltip(d: Datum | undefined): string {
  if (!d) return ''
  return `<div class="grid gap-1 rounded-lg border bg-background px-3 py-2 text-xs shadow-md text-foreground"><div class="font-medium">${d.period}</div><div class="flex justify-between gap-6"><span>Kontostand</span><span class="tabular-nums">${euro(d.balance)}</span></div><div class="flex justify-between gap-6 text-muted-foreground"><span>Veränderung</span><span class="tabular-nums">${signedEuro(d.change)}</span></div></div>`
}
</script>

<template>
  <ChartContainer :config="chartConfig" class="aspect-auto h-56 w-full" cursor>
    <VisXYContainer :data="data" :y-domain="yDomain" :padding="{ top: 10 }">
      <VisArea :x="(d: Datum) => d.x" :y="(d: Datum) => d.balance" color="var(--line-balance)" :opacity="0.15" />
      <VisLine :x="(d: Datum) => d.x" :y="(d: Datum) => d.balance" color="var(--line-balance)" :line-width="2" />
      <VisPlotline
        axis="y"
        :value="config.minReserve"
        color="var(--line-expenses)"
        line-style="dash"
        :line-width="1"
        :label-text="`Mindestreserve ${euro(config.minReserve)}`"
        label-position="top-left"
        :label-size="10"
        label-color="var(--muted-foreground)"
      />
      <VisAxis type="x" :tick-values="tickValues" label="Lebensmonat" :tick-format="(v: number) => (v === 0 ? 'Geburt' : String(v))" :grid-line="false" :domain-line="false" :tick-line="false" />
      <VisAxis type="y" :tick-format="(v: number) => compactEuro.format(v)" :domain-line="false" :tick-line="false" :num-ticks="4" />
      <ChartTooltip />
      <ChartCrosshair :x="(d: Datum) => d.x" :y="(d: Datum) => d.balance" :template="tooltip" :color="() => 'var(--line-balance)'" />
    </VisXYContainer>
  </ChartContainer>
</template>
