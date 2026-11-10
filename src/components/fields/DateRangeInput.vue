<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import { CalendarRangeIcon } from '@lucide/vue'
import type { DateRange } from 'reka-ui'
import { ref, shallowRef, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RangeCalendar } from '@/components/ui/range-calendar'
import { formatDate } from '@/engine/dates'

const from = defineModel<string>('from', { required: true })
const to = defineModel<string>('to', { required: true })

const open = ref(false)
// The calendar works on a local draft; the range is only saved once start and end are picked.
const draft = shallowRef<DateRange>({ start: undefined, end: undefined })

watch(open, (isOpen) => {
  if (isOpen) {
    draft.value = {
      start: from.value ? parseDate(from.value) : undefined,
      end: to.value ? parseDate(to.value) : undefined,
    }
  }
})

// Saves every complete range; the popover stays open until the user clicks outside.
function update(range: DateRange) {
  draft.value = range
  if (range.start && range.end) {
    from.value = range.start.toString()
    to.value = range.end.toString()
  }
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" class="h-9 w-full justify-start font-normal">
        <CalendarRangeIcon class="text-muted-foreground" />
        <span v-if="from && to">{{ formatDate(from) }} – {{ formatDate(to) }}</span>
        <span v-else class="text-muted-foreground">Zeitraum wählen</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <RangeCalendar
        :model-value="draft"
        :default-placeholder="draft.start"
        locale="de-DE"
        :week-starts-on="1"
        :number-of-months="2"
        @update:model-value="update"
      />
      <p class="text-muted-foreground border-t px-3 py-2 text-xs">Ersten und letzten Tag anklicken. Zum Schließen daneben klicken.</p>
    </PopoverContent>
  </Popover>
</template>
