<script setup lang="ts">
import { computed } from 'vue'
import type { Issue } from '@/engine/result'
import { SEVERITY_STYLE, sortBySeverity } from '@/lib/issues'

const props = defineProps<{ issues: Issue[] }>()
const sorted = computed(() => sortBySeverity(props.issues))
</script>

<template>
  <ul class="grid gap-2">
    <li v-for="issue in sorted" :key="issue.id" class="flex gap-2">
      <component :is="SEVERITY_STYLE[issue.severity].icon" class="mt-0.5 size-3.5 shrink-0" :class="SEVERITY_STYLE[issue.severity].tooltipClassName" />
      <div class="grid gap-0.5">
        <span class="font-medium">{{ issue.title }}</span>
        <span v-if="issue.detail" class="opacity-80">{{ issue.detail }}</span>
      </div>
    </li>
  </ul>
</template>
