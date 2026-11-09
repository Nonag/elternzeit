<script setup lang="ts">
import { InfoIcon } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

defineProps<{ text: string }>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <button type="button" class="text-muted-foreground hover:text-foreground inline-flex" aria-label="Info">
        <InfoIcon class="size-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent class="max-w-sm leading-relaxed whitespace-pre-line">{{ text }}</TooltipContent>
  </Tooltip>
</template>
