<script setup lang="ts">
import { computed } from 'vue'
import ChoiceToggle from '@/components/fields/ChoiceToggle.vue'
import FormField from '@/components/fields/FormField.vue'
import MonthInput from '@/components/fields/MonthInput.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import SwitchField from '@/components/fields/SwitchField.vue'
import { useVariants } from '@/stores/variants'

const { config, result } = useVariants()
const childcare = computed(() => config.value.childcare)
</script>

<template>
  <div class="grid gap-5">
    <SwitchField v-model="childcare.enabled" label="Kita oder Tagesmutter einplanen" />
    <template v-if="childcare.enabled">
      <div class="grid grid-cols-2 gap-4">
        <FormField label="Start" hint="Plätze gibt es meist ab 1. August. Ab dem 1. Geburtstag besteht ein Rechtsanspruch.">
          <MonthInput v-model="childcare.startMonth" :min="result.months[0].calendarMonth" :max="result.months[result.months.length - 1].calendarMonth" />
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
        hint="In Köln hängt der Beitrag vom Einkommen beider Eltern und vom Alter des Kindes ab. Er wird automatisch berechnet."
      >
        <ChoiceToggle
          v-model="childcare.feeMode"
          :options="[
            { value: 'cologne', label: 'Köln (nach Einkommen)' },
            { value: 'manual', label: 'Fester Betrag' },
          ]"
        />
      </FormField>
      <div class="grid grid-cols-2 gap-4">
        <FormField v-if="childcare.feeMode === 'manual'" label="Beitrag pro Monat">
          <NumberInput v-model="childcare.manualFee" unit="€" :step="10" />
        </FormField>
        <FormField label="Mittagessen" hint="Städtische Kitas in Köln: 70,40 € im Monat bei fünf Tagen.">
          <NumberInput v-model="childcare.mealDaysPerWeek" :min="0" :max="5" unit="Tage/Woche" />
        </FormField>
      </div>
      <p v-if="childcare.startMonth && childcare.hoursPerWeek && !result.childcare.startMonthIndex" class="text-xs text-amber-700 dark:text-amber-400">
        Der Kita-Start liegt nach dem Ende des Planungszeitraums.
      </p>
    </template>
  </div>
</template>
