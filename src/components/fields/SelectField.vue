<script setup lang="ts" generic="T extends string | number | null">
import { computed } from 'vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const model = defineModel<T>({ required: true })
const props = defineProps<{ options: { value: T; label: string }[]; placeholder?: string; triggerClass?: string }>()

const NULL_KEY = '__null__'
const key = (value: T) => (value === null ? NULL_KEY : String(value))
const selected = computed(() => key(model.value))

function update(value: unknown) {
  const option = props.options.find((o) => key(o.value) === value)
  if (option) model.value = option.value
}
</script>

<template>
  <Select :model-value="selected" @update:model-value="update">
    <SelectTrigger size="default" :class="['h-9 w-full min-w-0 data-[size=default]:h-9', triggerClass]">
      <SelectValue :placeholder="placeholder" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="option in options" :key="key(option.value)" :value="key(option.value)">
        {{ option.label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
