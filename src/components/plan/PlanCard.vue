<script setup lang="ts">
import { WandSparklesIcon } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import InfoTip from '@/components/fields/InfoTip.vue'
import { confirmDialog } from '@/lib/dialogs'
import { createId, periodsFromOutline, normalizePeriods, PLAN_PRESETS, type PlanPreset } from '@/engine/plan'
import type { ParentKey } from '@/engine/types'
import { num } from '@/lib/format'
import { useVariants } from '@/stores/variants'
import PeriodEditor from './PeriodEditor.vue'
import PlanTimeline from './PlanTimeline.vue'

const { config, result } = useVariants()
const selectedPeriod = ref<string | null>(null)

function onSelect(parent: ParentKey, from: number, to: number, periodId: string | null) {
  if (periodId) {
    selectedPeriod.value = periodId
    return
  }
  const period = { id: createId('period'), from, to, kind: 'leave' as const, hours: 0, allowance: 'none' as const }
  config.value.periods[parent] = normalizePeriods([...config.value.periods[parent], period])
  selectedPeriod.value = period.id
}

// Replacing an existing plan asks for confirmation first, hence the "…" on the presets.
const hasPlan = computed(() => config.value.periods.a.length + config.value.periods.b.length > 0)

async function applyPreset(preset: PlanPreset) {
  if (hasPlan.value && !(await confirmDialog({ title: 'Plan ersetzen?', description: `Der aktuelle Plan wird durch „${preset.label}“ ersetzt.`, confirmLabel: 'Ersetzen' }))) return
  config.value.periods = periodsFromOutline(preset.outline, config.value.relationship)
  selectedPeriod.value = null
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Plan</CardTitle>
      <div class="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span class="flex items-center gap-1">
          Elterngeld
          <strong :class="result.entitlement.used > result.entitlement.available ? 'text-destructive' : 'text-foreground'">
            {{ num(result.entitlement.used) }}/{{ result.entitlement.available }} Monate
          </strong>
          <InfoTip text="Basiselterngeld zählt voll, ElterngeldPlus halb. Zusammen gibt es 14 Monate, wenn beide Elterngeld beziehen." />
        </span>
        <span class="flex items-center gap-1">
          Partnerschaftsbonus <strong class="text-foreground">{{ result.parents.a.counts.bonus }}/4</strong>
          <InfoTip text="Bis zu 4 zusätzliche Monate ElterngeldPlus für jeden Elternteil – wenn ihr beide 2 bis 4 Monate am Stück gleichzeitig 24 bis 32 Stunden pro Woche arbeitet." />
        </span>
        <span>
          Elternzeit
          <strong class="text-foreground">{{ result.activeParents.map((k) => `${result.parents[k].name} ${result.parents[k].counts.leaveMonths}`).join(' · ') }}</strong>
          Monate
        </span>
      </div>
      <CardAction>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline"><WandSparklesIcon /> Vorlage</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-80">
            <DropdownMenuLabel>Plan aus Vorlage erstellen</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem v-for="preset in PLAN_PRESETS" :key="preset.id" class="flex flex-col items-start gap-0.5" @click="applyPreset(preset)">
              <span class="font-medium">{{ preset.label }}{{ hasPlan ? ' …' : '' }}</span>
              <span class="text-muted-foreground text-xs">{{ preset.description }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardAction>
    </CardHeader>
    <CardContent class="grid gap-6">
      <PlanTimeline :selected-period-id="selectedPeriod" @select="onSelect" />
      <div class="grid gap-4 border-t pt-5">
        <p class="text-muted-foreground text-xs">
          Außerhalb der Zeiträume wird normal gearbeitet. Ein Klick in den Zeitstrahl legt dort einen neuen Zeitraum an.
        </p>
        <PeriodEditor v-model:selected="selectedPeriod" />
      </div>
    </CardContent>
  </Card>
</template>
