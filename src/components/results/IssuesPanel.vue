<script setup lang="ts">
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from '@lucide/vue'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import type { IssueSeverity } from '@/engine/result'
import { formatMonthList } from '@/engine/rules'
import { signedEuro } from '@/lib/format'
import { useVariants } from '@/stores/variants'

const { result } = useVariants()

const ORDER: IssueSeverity[] = ['error', 'warning', 'info', 'success']
const META: Record<IssueSeverity, { icon: typeof InfoIcon; className: string }> = {
  error: { icon: CircleAlertIcon, className: 'text-destructive' },
  warning: { icon: TriangleAlertIcon, className: 'text-amber-600 dark:text-amber-400' },
  info: { icon: InfoIcon, className: 'text-sky-600' },
  success: { icon: CircleCheckIcon, className: 'text-emerald-600 dark:text-emerald-400' },
}
const CATEGORY_LABELS: Record<string, string> = {
  allowance: 'Elterngeld',
  leave: 'Elternzeit',
  vacation: 'Urlaub',
  care: 'Betreuung',
  finance: 'Finanzen',
  general: 'Allgemein',
}

const issues = computed(() =>
  [...result.value.issues].sort(
    (x, y) => ORDER.indexOf(x.severity) - ORDER.indexOf(y.severity) || (y.impact ?? 0) - (x.impact ?? 0),
  ),
)
</script>

<template>
  <ul class="grid gap-2">
    <li v-for="issue in issues" :key="issue.id" class="flex gap-3 rounded-lg border p-3">
      <component :is="META[issue.severity].icon" class="mt-0.5 size-4 shrink-0" :class="META[issue.severity].className" />
      <div class="grid gap-1">
        <div class="flex flex-wrap items-center gap-2 text-sm font-medium">
          {{ issue.title }}
          <Badge variant="outline" class="font-normal">{{ CATEGORY_LABELS[issue.category] }}</Badge>
          <Badge v-if="issue.months?.length" variant="secondary" class="font-normal">{{ formatMonthList(issue.months) }}</Badge>
          <Badge
            v-if="issue.impact && Math.abs(issue.impact) >= 1"
            variant="outline"
            class="font-medium"
            :class="issue.impact > 0 ? 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400' : 'border-red-300 text-destructive dark:border-red-900'"
          >
            {{ issue.impact > 0 ? 'bis zu ' : '' }}{{ signedEuro(issue.impact) }}
          </Badge>
        </div>
        <p v-if="issue.detail" class="text-muted-foreground text-xs leading-relaxed">{{ issue.detail }}</p>
      </div>
    </li>
  </ul>
</template>
