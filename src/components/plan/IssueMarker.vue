<script setup lang="ts">
import { InfoIcon } from '@lucide/vue'
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Issue } from '@/engine/result'
import { SEVERITY_STYLE, strongestTone } from '@/lib/issues'
import IssueList from './IssueList.vue'

// Icon with the issues in a tooltip. With a text it is the info icon of a counter; while there are issues it takes
// their colour and shows them instead of the text, which their details already cover.
const props = defineProps<{ issues: Issue[]; text?: string }>()
const tone = computed(() => strongestTone(props.issues))
</script>

<template>
  <Tooltip v-if="tone || text">
    <TooltipTrigger as-child>
      <button
        type="button"
        class="inline-flex"
        :class="tone ? SEVERITY_STYLE[tone].className : 'text-muted-foreground hover:text-foreground'"
        :aria-label="tone ? 'Hinweise' : 'Info'"
      >
        <component :is="tone ? SEVERITY_STYLE[tone].icon : InfoIcon" class="size-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent class="max-w-sm leading-relaxed">
      <IssueList v-if="tone" :issues="issues" />
      <span v-else class="whitespace-pre-line">{{ text }}</span>
    </TooltipContent>
  </Tooltip>
</template>
