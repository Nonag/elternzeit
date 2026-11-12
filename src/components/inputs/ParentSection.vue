<script setup lang="ts">
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ChoiceToggle from '@/components/fields/ChoiceToggle.vue'
import FieldGroup from '@/components/fields/FieldGroup.vue'
import FormField from '@/components/fields/FormField.vue'
import InfoTip from '@/components/fields/InfoTip.vue'
import MonthInput from '@/components/fields/MonthInput.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import SelectField from '@/components/fields/SelectField.vue'
import SwitchField from '@/components/fields/SwitchField.vue'
import { addMonthsToKey, monthKey } from '@/engine/dates'
import { createId } from '@/engine/plan'
import type { OneTimePaymentResult } from '@/engine/result'
import type { HealthInsurance, ParentKey, TaxClass } from '@/engine/types'
import { euro, percent } from '@/engine/format'
import { useVariants } from '@/stores/variants'

const props = defineProps<{ parentKey: ParentKey }>()
const { config, result } = useVariants()

const parent = computed(() => config.value.parents[props.parentKey])
const summary = computed(() => result.value.parents[props.parentKey])
const payments = computed(() => new Map(result.value.oneTimePayments.map((p) => [p.id, p])))
// Payouts up to a year before the birth still change the balance at the birth.
const paymentMonths = computed(() => ({
  min: addMonthsToKey(monthKey(result.value.birth), -12),
  max: result.value.months[result.value.months.length - 1].calendarMonth,
}))

const PAYMENT_HINT =
  'Weihnachts- und Urlaubsgeld, Boni oder Prämien trägst du brutto im Monat der Auszahlung ein. Auf der Gehaltsabrechnung stehen sie als eigene Zeile, oft als „Einmalzahlung“ oder „Sonderzahlung“. Kommt das Geld in monatlichen Raten, zählt es zum normalen Monatsgehalt.\nDas Elterngeld ändert sich durch Einmalzahlungen nicht.'

function addPayment() {
  parent.value.oneTimePayments.push({ id: createId('payment'), label: '', gross: null, month: '' })
}

function paymentNote(payment: OneTimePaymentResult): string {
  const year = Number(payment.month.slice(0, 4))
  const lines = [`Abzüge: ${euro(payment.tax)} Steuern, ${euro(payment.contributions)} Sozialabgaben.`]
  const insured = parent.value.pensionInsured || parent.value.healthInsurance !== 'private'
  if (payment.contributionYear < year) {
    const free = payment.contributions === 0 && payment.insuredMonths === 0
    lines.push(
      'Zahlungen im Januar bis März zählen für die Sozialabgaben zum Vorjahr, wenn im selben Jahr bis dahin kein oder wenig Gehalt geflossen ist. ' +
        `Diese Zahlung zählt deshalb zu ${payment.contributionYear}.` +
        (free ? ' Da gab es kein Gehalt, also fallen keine Sozialabgaben an.' : ''),
    )
  } else if (insured && payment.contributions === 0) {
    lines.push(
      payment.insuredMonths === 0
        ? `Keine Sozialabgaben, weil ${year} bis zur Auszahlung kein Gehalt geflossen ist.`
        : 'Keine Sozialabgaben, weil die Beitragsgrenze schon erreicht ist.',
    )
  }
  if (payment.lifeMonth === 0) lines.push('Die Zahlung kommt vor der Geburt und wird zum Kontostand zur Geburt addiert.')
  else if (payment.lifeMonth > result.value.horizon) lines.push('Die Zahlung liegt nach dem Planungszeitraum.')
  return lines.join('\n')
}

const taxClassOptions = computed(() => {
  const all: { value: TaxClass; label: string }[] = [
    { value: 1, label: 'I' },
    { value: 2, label: 'II' },
    { value: 3, label: 'III' },
    { value: 4, label: 'IV' },
    { value: 5, label: 'V' },
    { value: 6, label: 'VI' },
  ]
  const allowed: Record<string, TaxClass[]> = { married: [3, 4, 5], unmarried: [1], single: [2, 1] }
  return all.filter((o) => allowed[config.value.relationship ?? 'married'].includes(o.value) || o.value === parent.value.taxClass)
})

const taxClassAfterOptions = computed(() => [
  { value: null as TaxClass | null, label: 'unverändert' },
  ...taxClassOptions.value.map((o) => ({ value: o.value as TaxClass | null, label: o.label })),
])

const insuranceOptions: { value: HealthInsurance; label: string }[] = [
  { value: 'statutory', label: 'Gesetzlich' },
  { value: 'statutoryVoluntary', label: 'Gesetzlich (freiwillig)' },
  { value: 'private', label: 'Privat' },
]

const churchRateOptions = [
  { value: 0.09, label: '9 %' },
  { value: 0.08, label: '8 %' },
]
</script>

<template>
  <div class="grid gap-6">
    <FormField label="Name">
      <Input v-model="parent.name" class="h-9" />
    </FormField>

    <FieldGroup title="Gehalt">
      <div class="grid grid-cols-2 gap-4">
        <FormField
          label="Brutto pro Monat"
          hint="Auf der Gehaltsabrechnung meist „Steuerbrutto“ – aus einem Monat ohne Weihnachts- oder Urlaubsgeld. Beispiel: 4.200 € Bruttogehalt, davon 200 € für die Betriebsrente → 4.000 €."
        >
          <NumberInput v-model="parent.grossMonthly" unit="€" :step="100" />
        </FormField>
        <FormField label="Wochenstunden">
          <NumberInput v-model="parent.weeklyHours" :min="1" :max="60" :step="0.5" :decimals="2" unit="h" />
        </FormField>
      </div>
    </FieldGroup>

    <FieldGroup title="Einmalzahlungen" :hint="PAYMENT_HINT">
      <div v-for="(item, i) in parent.oneTimePayments" :key="item.id" class="grid gap-3 rounded-lg border p-3">
        <div class="flex items-center gap-2">
          <Input v-model="item.label" class="h-9 flex-1" placeholder="Bezeichnung" aria-label="Bezeichnung" />
          <Button variant="ghost" size="icon" aria-label="Einmalzahlung entfernen" @click="parent.oneTimePayments.splice(i, 1)">
            <Trash2Icon />
          </Button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <FormField label="Brutto">
            <NumberInput v-model="item.gross" nullable :min="0" unit="€" :step="100" />
          </FormField>
          <FormField label="Monat">
            <MonthInput v-model="item.month" :min="paymentMonths.min" :max="paymentMonths.max" />
          </FormField>
        </div>
        <p v-if="payments.get(item.id)" class="text-muted-foreground flex items-center gap-1 text-xs">
          Netto etwa {{ euro(payments.get(item.id)!.net) }}
          <InfoTip :text="paymentNote(payments.get(item.id)!)" />
        </p>
      </div>
      <Button variant="outline" class="h-9 w-full" @click="addPayment"><PlusIcon /> Einmalzahlung hinzufügen</Button>
    </FieldGroup>

    <FieldGroup title="Steuern">
      <div class="grid grid-cols-2 gap-4">
        <FormField label="Steuerklasse" hint="Die Steuerklasse im Jahr vor der Geburt. Sie bestimmt das Elterngeld.">
          <SelectField v-model="parent.taxClass" :options="taxClassOptions" />
        </FormField>
        <FormField label="Ab der Geburt" hint="Optional: neue Steuerklasse nach der Geburt. Ändert nur das monatliche Netto, nicht das Elterngeld.">
          <SelectField v-model="parent.taxClassAfterBirth" :options="taxClassAfterOptions" />
        </FormField>
      </div>
      <FormField
        v-if="parent.taxClass === 4 && config.relationship === 'married'"
        label="Faktor"
        hint="Nur beim Faktorverfahren, steht dann auf der Gehaltsabrechnung (z. B. 0,950)."
      >
        <NumberInput v-model="parent.taxFactor" nullable placeholder="keiner" :min="0.001" :max="0.999" :step="0.001" :decimals="3" />
      </FormField>
      <SwitchField v-model="parent.churchTax" label="Kirchensteuer" hint="Für Mitglieder der katholischen oder evangelischen Kirche." />
      <FormField v-if="parent.churchTax" label="Kirchensteuersatz" hint="8 % in Bayern und Baden-Württemberg, 9 % in allen anderen Bundesländern.">
        <ChoiceToggle v-model="config.churchTaxRate" :options="churchRateOptions" />
      </FormField>
    </FieldGroup>

    <FieldGroup title="Versicherung">
      <FormField label="Krankenversicherung" hint="Wer mehr als 77.400 € im Jahr verdient (2026), ist freiwillig gesetzlich oder privat versichert.">
        <SelectField v-model="parent.healthInsurance" :options="insuranceOptions" />
      </FormField>
      <FormField v-if="parent.healthInsurance !== 'private'" label="Zusatzbeitrag" hint="Steht auf der Website der Krankenkasse, im Schnitt 2,9 %.">
        <NumberInput v-model="parent.healthAdditionalRate" :min="0" :max="6" :step="0.1" :decimals="2" unit="%" />
      </FormField>
      <FormField v-else label="Beitrag pro Monat" hint="Kranken- und Pflegeversicherung zusammen. In der Elternzeit zahlt der Arbeitgeber nichts dazu.">
        <NumberInput v-model="parent.privatePremium" unit="€" :step="10" />
      </FormField>
      <SwitchField v-model="parent.pensionInsured" label="Rentenversichert" hint="Aus bei Beamten." />
    </FieldGroup>

    <FieldGroup title="Arbeitgeber & Urlaub">
      <div class="grid grid-cols-2 gap-4">
        <FormField label="Urlaubstage">
          <NumberInput v-model="parent.vacationDaysPerYear" :min="0" :max="60" :step="0.5" :decimals="1" unit="pro Jahr" />
        </FormField>
        <FormField label="Arbeitstage">
          <NumberInput v-model="parent.workDaysPerWeek" :min="1" :max="7" unit="pro Woche" />
        </FormField>
      </div>
      <SwitchField v-model="parent.employerOver15" label="Mehr als 15 Beschäftigte" hint="Voraussetzung für Teilzeit in der Elternzeit." />
      <SwitchField v-model="parent.employedOver6Months" label="Länger als 6 Monate dabei" hint="Ebenfalls Voraussetzung für Teilzeit in der Elternzeit." />
    </FieldGroup>

    <FieldGroup v-if="summary.active" title="Elterngeld">
      <dl class="bg-muted/60 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-lg p-3 text-sm">
        <dt class="text-muted-foreground">Netto heute</dt>
        <dd class="text-right tabular-nums">{{ euro(summary.realNetBefore) }}</dd>
        <dt class="text-muted-foreground">Basiselterngeld</dt>
        <dd class="text-right font-medium tabular-nums">{{ euro(summary.base.basicFull) }}</dd>
        <dt class="text-muted-foreground">ElterngeldPlus</dt>
        <dd class="text-right font-medium tabular-nums">{{ euro(summary.base.plusFull) }}</dd>
      </dl>
      <p class="text-muted-foreground -mt-1 text-xs leading-relaxed">
        Pro Monat ohne Job: {{ percent(summary.base.rate) }} von {{ euro(summary.allowanceNet.net) }}. Das ist ein pauschal
        berechnetes Netto, daher reichen Brutto und Steuerklasse.
      </p>
    </FieldGroup>
  </div>
</template>
