<script setup lang="ts" generic="T extends string | number | null">
import { computed } from 'vue'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'

const model = defineModel<T>({ required: true })
const props = defineProps<{
  /** `short` replaces the label in the closed field, e.g. in narrow table columns. */
  options: { value: T; label: string; short?: string }[]
  placeholder?: string
  triggerClass?: string
  /** Heading above the options in the opened list. */
  label?: string
}>()

const NULL_KEY = '__null__'
const key = (value: T) => (value === null ? NULL_KEY : String(value))
const selected = computed(() => key(model.value))
// Rendered explicitly, so renamed options (e.g. variants) update the trigger immediately.
const selectedLabel = computed(() => {
  const option = props.options.find((o) => key(o.value) === selected.value)
  return option?.short ?? option?.label
})

function update(value: unknown) {
  const option = props.options.find((o) => key(o.value) === value)
  if (option) model.value = option.value
}
</script>

<template>
  <Select :model-value="selected" @update:model-value="update">
    <SelectTrigger size="default" :class="['h-9 w-full min-w-0 data-[size=default]:h-9', triggerClass]">
      <SelectValue :placeholder="placeholder">{{ selectedLabel }}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel v-if="label">{{ label }}</SelectLabel>
        <SelectItem v-for="option in options" :key="key(option.value)" :value="key(option.value)">
          {{ option.label }}
        </SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
</template>
