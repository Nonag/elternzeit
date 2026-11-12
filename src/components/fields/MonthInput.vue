<script setup lang="ts">
import { CalendarRangeIcon, ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue'
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatMonthKey } from '@/engine/dates'

const model = defineModel<string>({ required: true })
/** Earliest and latest selectable month ('YYYY-MM'). */
const props = defineProps<{ min?: string; max?: string }>()

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const year = ref(Number(model.value?.slice(0, 4)) || Number(props.min?.slice(0, 4)) || new Date().getFullYear())
watch(model, (value) => {
  if (value) year.value = Number(value.slice(0, 4))
})

function key(month: number): string {
  return `${year.value}-${String(month).padStart(2, '0')}`
}

function outOfRange(month: number): boolean {
  return (!!props.min && key(month) < props.min) || (!!props.max && key(month) > props.max)
}

function pick(month: number) {
  model.value = `${year.value}-${String(month).padStart(2, '0')}`
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline" class="h-9 w-full justify-start font-normal">
        <CalendarRangeIcon class="text-muted-foreground" />
        {{ model ? formatMonthKey(model, true) : 'Monat wählen' }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-64 p-3" align="start">
      <div class="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" aria-label="Vorheriges Jahr" :disabled="!!min && year <= Number(min.slice(0, 4))" @click="year--"><ChevronLeftIcon /></Button>
        <span class="text-sm font-medium">{{ year }}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Nächstes Jahr" :disabled="!!max && year >= Number(max.slice(0, 4))" @click="year++"><ChevronRightIcon /></Button>
      </div>
      <div class="grid grid-cols-4 gap-1">
        <Button
          v-for="(name, i) in MONTHS"
          :key="name"
          size="sm"
          :variant="model === key(i + 1) ? 'default' : 'ghost'"
          :disabled="outOfRange(i + 1)"
          @click="pick(i + 1)"
        >
          {{ name }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
