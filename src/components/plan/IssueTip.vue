<script setup lang="ts">
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Issue } from '@/engine/result'
import { strongestTone } from '@/lib/issues'
import IssueList from './IssueList.vue'

const props = defineProps<{ issues: Issue[] }>()
const tone = computed(() => strongestTone(props.issues))
</script>

<template>
  <!-- Always rendered, so the field inside is not recreated (and does not lose focus) when an issue appears. -->
  <Tooltip :disabled="!tone">
    <TooltipTrigger as-child>
      <div class="min-w-0"><slot :tone="tone" /></div>
    </TooltipTrigger>
    <TooltipContent v-if="tone" class="max-w-sm leading-relaxed">
      <IssueList :issues="issues" />
    </TooltipContent>
  </Tooltip>
</template>
