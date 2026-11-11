<script setup lang="ts">
import { useId } from 'vue'
import { Switch } from '@/components/ui/switch'
import InfoTip from './InfoTip.vue'

const model = defineModel<boolean>({ required: true })
defineProps<{ label: string; hint?: string }>()
const id = useId()
</script>

<template>
  <div class="flex min-h-9 items-center justify-between gap-3 text-sm">
    <span class="flex items-center gap-1.5">
      <label :for="id">{{ label }}</label>
      <InfoTip v-if="hint" :text="hint" />
    </span>
    <Switch :id="id" v-model="model" />
  </div>
</template>
