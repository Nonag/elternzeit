<script setup lang="ts">
import { computed } from 'vue'
import ChoiceToggle from '@/components/fields/ChoiceToggle.vue'
import FormField from '@/components/fields/FormField.vue'
import MonthInput from '@/components/fields/MonthInput.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import SwitchField from '@/components/fields/SwitchField.vue'
import { useScenarios } from '@/stores/scenarios'

const { config, result } = useScenarios()
const childcare = computed(() => config.value.childcare)
</script>

<template>
  <div class="grid gap-5">
    <SwitchField v-model="childcare.enabled" label="Kita oder Tagesmutter einplanen" />
    <template v-if="childcare.enabled">
      <div class="grid grid-cols-2 gap-4">
        <FormField label="Start" hint="Kita-Plätze werden meist zum 1. August vergeben. Ab dem 1. Geburtstag gibt es einen Rechtsanspruch auf einen Platz.">
          <MonthInput v-model="childcare.startMonth" />
        </FormField>
        <FormField label="Stunden pro Woche">
          <ChoiceToggle
            v-model="childcare.hoursPerWeek"
            :options="[
              { value: 25, label: '25' },
              { value: 35, label: '35' },
              { value: 45, label: '45' },
            ]"
          />
        </FormField>
      </div>
      <FormField
        label="Elternbeitrag"
        hint="Köln: Der Beitrag hängt vom Jahreseinkommen beider Eltern ab (Elterngeld über 300 € im Monat zählt mit) und wird ab dem 2. und 3. Geburtstag günstiger. Wird automatisch berechnet."
      >
        <ChoiceToggle
          v-model="childcare.feeMode"
          :options="[
            { value: 'cologne', label: 'Köln, nach Einkommen' },
            { value: 'manual', label: 'Fester Betrag' },
          ]"
        />
      </FormField>
      <div class="grid grid-cols-2 gap-4">
        <FormField v-if="childcare.feeMode === 'manual'" label="Beitrag pro Monat">
          <NumberInput v-model="childcare.manualFee" unit="€" :step="10" />
        </FormField>
        <FormField label="Mittagessen" hint="Städtische Kitas in Köln berechnen 14,10 € im Monat pro Wochentag, also 70,40 € bei fünf Tagen.">
          <NumberInput v-model="childcare.mealDaysPerWeek" :min="0" :max="5" unit="Tage/Woche" />
        </FormField>
      </div>
      <p v-if="!result.childcare.startMonthIndex" class="text-xs text-amber-700">
        Der Kita-Start liegt nach dem Ende des Planungszeitraums.
      </p>
    </template>
  </div>
</template>
