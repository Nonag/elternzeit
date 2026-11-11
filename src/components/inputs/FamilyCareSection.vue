<script setup lang="ts">
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DateRangeInput from '@/components/fields/DateRangeInput.vue'
import FormField from '@/components/fields/FormField.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import { addMonths } from '@/engine/dates'
import { createId } from '@/engine/plan'
import { useVariants } from '@/stores/variants'

const { config, result } = useVariants()

// The calendar is limited to the planning period and marks where each life month starts.
const lifeMonthStarts = computed(() => result.value.months.map((m) => m.start))
const planEnd = computed(() => result.value.months[result.value.months.length - 1].end)

function addFamilyCare() {
  const birth = result.value.birth
  config.value.familyCare.push({
    id: createId('care'),
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
      Zeiten, in denen Großeltern oder Freunde das Kind betreuen, während ihr beide arbeitet.
    </p>
    <div v-for="(period, i) in config.familyCare" :key="period.id" class="grid gap-3 rounded-lg border p-3">
      <div class="flex items-center gap-2">
        <Input v-model="period.label" class="h-9 flex-1" aria-label="Wer betreut?" />
        <Button variant="ghost" size="icon" aria-label="Zeitraum entfernen" @click="config.familyCare.splice(i, 1)"><Trash2Icon /></Button>
      </div>
      <FormField label="Zeitraum">
        <DateRangeInput
          v-model:from="period.from"
          v-model:to="period.to"
          :min="result.birth"
          :max="planEnd"
          :marked-dates="lifeMonthStarts"
        />
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
    <Button variant="outline" class="h-9 w-full" @click="addFamilyCare"><PlusIcon /> Zeitraum hinzufügen</Button>
  </div>
</template>
