<script setup lang="ts">
import InfoTip from './InfoTip.vue'

defineProps<{ label: string; hint?: string }>()
</script>

<template>
  <div class="grid min-w-0 content-start gap-1.5">
    <div class="text-muted-foreground flex items-center gap-1 text-xs font-medium">
      <span>{{ label }}</span>
      <InfoTip v-if="hint" :text="hint" />
    </div>
    <slot />
  </div>
</template>
