<script setup lang="ts" generic="T extends string | number">
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const model = defineModel<T>({ required: true })
defineProps<{ options: { value: T; label: string }[] }>()

function update(value: unknown) {
  // Single toggle groups emit an empty value when the active item is clicked again.
  if (value === undefined || value === null || value === '') return
  model.value = value as T
}
</script>

<template>
  <ToggleGroup
    type="single"
    variant="outline"
    orientation="horizontal"
    class="w-full"
    :model-value="model"
    @update:model-value="update"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="String(option.value)"
      :value="option.value"
      class="h-9 min-w-0 flex-1 px-2 text-xs"
    >
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroup>
</template>
