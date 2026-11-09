<script setup lang="ts">
import { Switch } from '@/components/ui/switch'
import InfoTip from './InfoTip.vue'

const model = defineModel<boolean>({ required: true })
defineProps<{ label: string; hint?: string }>()
</script>

<template>
  <label class="flex min-h-9 cursor-pointer items-center justify-between gap-3 text-sm">
    <span class="flex items-center gap-1.5">
      {{ label }}
      <InfoTip v-if="hint" :text="hint" />
    </span>
    <Switch v-model="model" />
  </label>
</template>
