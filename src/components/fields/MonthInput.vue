<script setup lang="ts">
import { CalendarRangeIcon, ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue'
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatMonthKey } from '@/engine/dates'

const model = defineModel<string>({ required: true })

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const year = ref(Number(model.value?.slice(0, 4)) || new Date().getFullYear())
watch(model, (value) => {
  if (value) year.value = Number(value.slice(0, 4))
})

function pick(month: number, close: () => void) {
  model.value = `${year.value}-${String(month).padStart(2, '0')}`
  close()
}
</script>

<template>
  <Popover v-slot="{ close }">
    <PopoverTrigger as-child>
      <Button variant="outline" class="h-9 w-full justify-start font-normal">
        <CalendarRangeIcon class="text-muted-foreground" />
        {{ model ? formatMonthKey(model, true) : 'Monat wählen' }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-64 p-3" align="start">
      <div class="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" aria-label="Vorheriges Jahr" @click="year--"><ChevronLeftIcon /></Button>
        <span class="text-sm font-medium">{{ year }}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Nächstes Jahr" @click="year++"><ChevronRightIcon /></Button>
      </div>
      <div class="grid grid-cols-4 gap-1">
        <Button
          v-for="(name, i) in MONTHS"
          :key="name"
          size="sm"
          :variant="model === `${year}-${String(i + 1).padStart(2, '0')}` ? 'default' : 'ghost'"
          @click="pick(i + 1, close)"
        >
          {{ name }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
