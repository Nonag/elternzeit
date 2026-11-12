<script setup lang="ts">
import { computed } from 'vue'
import ChoiceToggle from '@/components/fields/ChoiceToggle.vue'
import FormField from '@/components/fields/FormField.vue'
import InfoTip from '@/components/fields/InfoTip.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import type { ParentKey } from '@/engine/types'
import { euro, fixed, num, signedEuro } from '@/engine/format'
import { useVariants } from '@/stores/variants'

const { result, config } = useVariants()

const longTerm = computed(() => result.value.longTerm)
const parentOptions = computed(() => result.value.activeParents.map((k) => ({ value: k as ParentKey, label: result.value.parents[k].name })))
const points = (value: number) => fixed(value, 2)
const name = (key: ParentKey) => result.value.parents[key].name
</script>

<template>
  <div class="grid gap-5">
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FormField label="Kindererziehungszeiten für" hint="Für die ersten drei Lebensjahre bekommt ein Elternteil zusätzliche Rentenpunkte, etwa einen pro Jahr. Ohne Antrag ist das die Mutter. Eine andere Aufteilung geht per gemeinsamer Erklärung, höchstens zwei Monate rückwirkend.">
        <ChoiceToggle v-model="config.childRaisingCreditTo" :options="parentOptions" />
      </FormField>
      <FormField label="Rendite Ersparnisse p. a.">
        <NumberInput v-model="config.assumptions.returnRate" :min="0" :max="12" :step="0.5" :decimals="1" unit="%" />
      </FormField>
      <FormField label="Jahre bis zur Rente">
        <NumberInput v-model="config.assumptions.yearsToRetirement" :min="1" :max="50" unit="J." />
      </FormField>
      <FormField label="Jahre Rentenbezug">
        <NumberInput v-model="config.assumptions.retirementYears" :min="1" :max="40" unit="J." />
      </FormField>
    </div>

    <div class="grid gap-2">
      <h3 class="text-sm font-medium">Rentenpunkte in den {{ result.horizon }} geplanten Monaten</h3>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[40rem] text-xs">
          <thead class="text-muted-foreground">
            <tr class="border-b">
              <th class="py-1 text-left font-medium">Elternteil</th>
              <th class="py-1 text-right font-medium">Punkte aus Gehalt (Plan)</th>
              <th class="py-1 text-right font-medium">bei 100 %</th>
              <th class="py-1 text-right font-medium">+ Kindererziehung</th>
              <th class="py-1 text-right font-medium">Saldo</th>
              <th class="py-1 text-right font-medium">Rente/Monat</th>
              <th class="py-1 text-right font-medium">über {{ config.assumptions.retirementYears }} Jahre</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="key in result.activeParents" :key="key" class="border-b last:border-0">
              <td class="py-1.5 font-medium">{{ name(key) }}</td>
              <template v-if="longTerm.pension[key].insured">
                <td class="text-right tabular-nums">{{ points(longTerm.pension[key].pointsSalary) }}</td>
                <td class="text-muted-foreground text-right tabular-nums">{{ points(longTerm.pension[key].pointsReference) }}</td>
                <td class="text-right tabular-nums">{{ points(longTerm.pension[key].pointsChildRaising) }}</td>
                <td class="text-right font-medium tabular-nums" :class="longTerm.pension[key].pointsBalance < 0 ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400'">
                  {{ longTerm.pension[key].pointsBalance > 0 ? '+' : '' }}{{ points(longTerm.pension[key].pointsBalance) }}
                </td>
                <td class="text-right tabular-nums">{{ signedEuro(longTerm.pension[key].monthlyPensionBalance) }}</td>
                <td class="text-right tabular-nums">{{ signedEuro(longTerm.pension[key].lifetimeBalance) }}</td>
              </template>
              <td v-else colspan="6" class="text-muted-foreground text-right">nicht rentenversicherungspflichtig</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-muted-foreground text-xs leading-relaxed">
        Ein Rentenpunkt bringt heute {{ euro(longTerm.pensionValue, true) }} Rente im Monat. Wer ein Jahr lang das
        Durchschnittsgehalt verdient, bekommt einen Punkt; Elterngeld zählt nicht. Fehlende Punkte lassen sich mit
        freiwilligen Beiträgen nachkaufen, etwa {{ euro(longTerm.costPerPoint) }} pro Punkt, allerdings nur für Monate, in
        denen man sonst nicht rentenversichert ist.
      </p>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div class="grid content-start gap-1 rounded-lg border p-3">
        <span class="text-muted-foreground flex items-center gap-1 text-xs">
          Einkommensverlust gegenüber Vollzeit
          <InfoTip text="Was beide in Vollzeit netto verdient hätten, minus die tatsächlichen Einnahmen inklusive Elterngeld und Mutterschaftsgeld." />
        </span>
        <span class="text-xl font-semibold tabular-nums">{{ euro(longTerm.lostIncome) }}</span>
        <span class="text-muted-foreground text-xs">
          Angelegt mit {{ num(config.assumptions.returnRate) }} % Rendite wären das zur Rente etwa
          <strong class="text-foreground">{{ euro(longTerm.lostIncomeAtRetirement) }}</strong>.
        </span>
        <span class="text-muted-foreground mt-1 text-xs">
          Persönlich: <span v-for="key in result.activeParents" :key="key" class="mr-2">{{ name(key) }} {{ euro(longTerm.personalLoss[key]) }}</span>
        </span>
      </div>
      <div class="grid content-start gap-1 rounded-lg border p-3">
        <span class="text-muted-foreground text-xs">Ausgleich bei Teilung der Einbußen 50 : 50</span>
        <template v-if="longTerm.compensation">
          <span class="text-sm">
            {{ name(longTerm.compensation.from) }} gleicht {{ name(longTerm.compensation.to) }} aus:
            <strong>{{ euro(longTerm.compensation.incomeTransfer) }}</strong>
            ({{ euro(longTerm.compensation.incomeTransferMonthly) }} pro Monat über den Planungszeitraum).
          </span>
          <span v-if="longTerm.compensation.pointsTransfer > 0.01" class="text-sm">
            Rentenlücke halbieren: {{ points(longTerm.compensation.pointsTransfer) }} Punkte ≈
            <strong>{{ euro(longTerm.compensation.pointsCost) }}</strong> (z. B. freiwillige Beiträge oder privates Altersvorsorgedepot).
          </span>
          <span class="text-muted-foreground text-xs leading-relaxed">
            {{ config.relationship === 'married'
              ? 'Verheiratet: Bei einer Scheidung werden Vermögen und Rentenansprüche ohnehin geteilt. Ein Ausgleich schon während der Ehe stärkt trotzdem die eigene Absicherung.'
              : 'Unverheiratet: Es gibt keinen gesetzlichen Ausgleich. Am besten schriftlich vereinbaren, wer wem wie viel ausgleicht.' }}
          </span>
        </template>
        <span v-else class="text-muted-foreground text-sm">Die Einbußen sind bereits ungefähr gleich verteilt.</span>
      </div>
    </div>
  </div>
</template>
