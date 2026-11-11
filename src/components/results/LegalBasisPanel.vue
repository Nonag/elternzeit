<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { CURRENT_LAW_NOTES, EXPECTED_CHANGES, PARAMETER_YEARS, yearParameters } from '@/engine/params'
import { euro, num } from '@/engine/format'

const years = computed(() => PARAMETER_YEARS.map((year) => yearParameters(year)))

const rows = [
  { label: 'Kindergeld pro Monat', value: (y: ReturnType<typeof yearParameters>) => euro(y.childBenefitMonthly) },
  { label: 'Grundfreibetrag (Steuer)', value: (y: ReturnType<typeof yearParameters>) => euro(y.basicTaxAllowance) },
  { label: 'Arbeitnehmer-Pauschbetrag', value: (y: ReturnType<typeof yearParameters>) => euro(y.employeeLumpSum) },
  { label: 'Kinderfreibeträge (beide Eltern)', value: (y: ReturnType<typeof yearParameters>) => euro(y.childTaxAllowanceJoint) },
  { label: 'Beitragsgrenze Rente/Arbeitslosenversicherung (Monat)', value: (y: ReturnType<typeof yearParameters>) => euro(y.pensionCeilingMonthly) },
  { label: 'Beitragsgrenze Kranken-/Pflegeversicherung (Monat)', value: (y: ReturnType<typeof yearParameters>) => euro(y.healthCeilingMonthly, true) },
  { label: 'Ø Zusatzbeitrag Krankenkassen', value: (y: ReturnType<typeof yearParameters>) => `${num(y.averageAdditionalHealthRate, 2)} %` },
  { label: 'Minijob-Grenze', value: (y: ReturnType<typeof yearParameters>) => euro(y.minijobLimit) },
  { label: 'Kinderkrankentage je Elternteil und Kind', value: (y: ReturnType<typeof yearParameters>) => String(y.sickChildDaysPerParent) },
]
</script>

<template>
  <div class="grid gap-6 text-sm">
    <div class="grid gap-2">
      <h3 class="font-medium">Gerechnet wird mit dem voraussichtlich geltenden Recht (Stand 10.11.2026)</h3>
      <ul class="text-muted-foreground list-disc space-y-1 pl-5 text-xs leading-relaxed">
        <li v-for="note in CURRENT_LAW_NOTES" :key="note">{{ note }}</li>
      </ul>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[36rem] text-xs">
        <thead class="text-muted-foreground">
          <tr class="border-b">
            <th class="py-1.5 text-left font-medium">Wert</th>
            <th v-for="year in years" :key="year.year" class="py-1.5 text-right font-medium">
              {{ year.year }}
              <Badge v-if="year.status === 'expected'" variant="outline" class="ml-1 font-normal">voraussichtlich</Badge>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.label" class="border-b last:border-0">
            <td class="py-1.5">{{ row.label }}</td>
            <td v-for="year in years" :key="year.year" class="text-right tabular-nums">{{ row.value(year) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="grid gap-2">
      <h3 class="font-medium">Schon eingerechnet, aber noch nicht endgültig beschlossen</h3>
      <div class="grid gap-2 md:grid-cols-3">
        <div v-for="change in EXPECTED_CHANGES" :key="change.title" class="grid content-start gap-1 rounded-lg border p-3">
          <span class="font-medium">{{ change.title }}</span>
          <span class="text-muted-foreground text-xs leading-relaxed">{{ change.detail }}</span>
          <Badge variant="secondary" class="mt-1 font-normal">{{ change.status }}</Badge>
        </div>
      </div>
    </div>
  </div>
</template>
