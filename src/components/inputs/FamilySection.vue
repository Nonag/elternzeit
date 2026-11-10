<script setup lang="ts">
import ChoiceToggle from '@/components/fields/ChoiceToggle.vue'
import DateInput from '@/components/fields/DateInput.vue'
import FieldGroup from '@/components/fields/FieldGroup.vue'
import FormField from '@/components/fields/FormField.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import SwitchField from '@/components/fields/SwitchField.vue'
import type { RelationshipStatus } from '@/engine/types'
import { useScenarios } from '@/stores/scenarios'

const { config } = useScenarios()

const relationshipOptions: { value: RelationshipStatus; label: string }[] = [
  { value: 'married', label: 'Verheiratet' },
  { value: 'unmarried', label: 'Unverheiratet' },
  { value: 'single', label: 'Alleinerziehend' },
]

function onRelationshipChange(value: RelationshipStatus) {
  config.value.relationship = value
  const { a, b } = config.value.parents
  if (value === 'unmarried') {
    a.taxClass = 1
    b.taxClass = 1
  } else if (value === 'single') {
    a.taxClass = 2
  } else if (a.taxClass === 1 || a.taxClass === 2) {
    a.taxClass = 4
    b.taxClass = 4
  }
}
</script>

<template>
  <div class="grid gap-6">
    <FieldGroup title="Familie">
      <FormField label="Beziehungsstatus" hint="Bestimmt unter anderem, welche Steuerklassen möglich sind.">
        <ChoiceToggle :model-value="config.relationship" :options="relationshipOptions" @update:model-value="onRelationshipChange" />
      </FormField>
      <div class="grid grid-cols-2 gap-4">
        <FormField label="Anzahl Kinder" hint="Bei Zwillingen 2.">
          <NumberInput v-model="config.children" :min="1" :max="4" />
        </FormField>
      </div>
      <SwitchField
        v-model="config.siblingBonus"
        label="Geschwisterbonus"
        hint="Lebt schon ein Kind unter 3 Jahren (oder zwei unter 6) bei euch, gibt es 10 % mehr Elterngeld, mindestens 75 €."
      />
    </FieldGroup>

    <FieldGroup title="Termine">
      <div class="grid grid-cols-2 gap-4">
        <FormField label="Errechneter Termin">
          <DateInput :model-value="config.dueDate" @update:model-value="(v) => v && (config.dueDate = v)" />
        </FormField>
        <FormField label="Tatsächliche Geburt" hint="Nach der Geburt eintragen. Termine und Fristen werden dann neu berechnet.">
          <DateInput v-model="config.birthDate" placeholder="noch offen" clearable />
        </FormField>
      </div>
      <SwitchField
        v-model="config.extendedMaternity"
        label="12 statt 8 Wochen Mutterschutz"
        hint="Bei Frühgeburt, Mehrlingen oder Behinderung des Kindes."
      />
    </FieldGroup>

    <FieldGroup title="Darstellung">
      <FormField label="Planungszeitraum" hint="So viele Monate ab der Geburt zeigen Tabelle und Grafiken.">
        <NumberInput v-model="config.horizonMonths" :min="12" :max="72" :step="6" unit="Monate" />
      </FormField>
    </FieldGroup>
  </div>
</template>
