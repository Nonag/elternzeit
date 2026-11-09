<script setup lang="ts">
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DateRangeInput from '@/components/fields/DateRangeInput.vue'
import FormField from '@/components/fields/FormField.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import { addMonths } from '@/engine/dates'
import { createId } from '@/engine/plan'
import { useScenarios } from '@/stores/scenarios'

const { config, result } = useScenarios()

function addSupport() {
  const birth = result.value.birth
  config.value.support.push({
    id: createId('support'),
    label: 'Großeltern',
    from: addMonths(birth, 12).date,
    to: addMonths(birth, 18).date,
    daysPerWeek: 2,
    hoursPerDay: 8,
  })
}
</script>

<template>
  <div class="grid gap-5">
    <p class="text-muted-foreground text-xs leading-relaxed">
      Zeiten, in denen Großeltern oder Freunde das Kind betreuen, damit ihr beide arbeiten könnt. Sie füllen Lücken, in
      denen sonst niemand für das Kind da wäre.
    </p>
    <div v-for="(period, i) in config.support" :key="period.id" class="grid gap-3 rounded-lg border p-3">
      <div class="flex items-center gap-2">
        <Input v-model="period.label" class="h-9 flex-1" aria-label="Wer betreut?" />
        <Button variant="ghost" size="icon" aria-label="Zeitraum entfernen" @click="config.support.splice(i, 1)"><Trash2Icon /></Button>
      </div>
      <FormField label="Zeitraum">
        <DateRangeInput v-model:from="period.from" v-model:to="period.to" />
      </FormField>
      <div class="grid grid-cols-2 gap-3">
        <FormField label="Tage pro Woche">
          <NumberInput v-model="period.daysPerWeek" :min="0" :max="7" :step="0.5" :decimals="1" />
        </FormField>
        <FormField label="Stunden pro Tag">
          <NumberInput v-model="period.hoursPerDay" :min="0" :max="12" :step="0.5" :decimals="2" unit="h" />
        </FormField>
      </div>
    </div>
    <Button variant="outline" class="h-9 w-full" @click="addSupport"><PlusIcon /> Zeitraum hinzufügen</Button>
  </div>
</template>
