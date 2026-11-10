<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'
import { CalendarIcon, XIcon } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate } from '@/engine/dates'

const model = defineModel<string | null>({ required: true })
defineProps<{ placeholder?: string; clearable?: boolean }>()

const value = computed(() => (model.value ? parseDate(model.value) : undefined))

function update(date: DateValue | undefined) {
  if (date) model.value = date.toString()
}
</script>

<template>
  <div class="flex items-center gap-1">
    <Popover>
      <PopoverTrigger as-child>
        <Button variant="outline" class="h-9 flex-1 justify-start font-normal">
          <CalendarIcon class="text-muted-foreground" />
          <span :class="model ? '' : 'text-muted-foreground'">{{ model ? formatDate(model) : placeholder ?? 'Datum wählen' }}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0" align="start">
        <Calendar
          :model-value="value"
          :default-placeholder="value"
          locale="de-DE"
          :week-starts-on="1"
          layout="month-and-year"
          @update:model-value="(d) => update(d as DateValue | undefined)"
        />
      </PopoverContent>
    </Popover>
    <Button v-if="clearable && model" variant="ghost" size="icon" aria-label="Zurücksetzen" @click="model = null">
      <XIcon />
    </Button>
  </div>
</template>
