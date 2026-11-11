<script setup lang="ts">
import { WandSparklesIcon } from '@lucide/vue'
import { ref } from 'vue'
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
import { createId, generateQuickPlan, normalizeBlocks, PLAN_PRESETS, type PlanPreset } from '@/engine/plan'
import type { ParentKey } from '@/engine/types'
import { num } from '@/lib/format'
import { useScenarios } from '@/stores/scenarios'
import BlockEditor from './BlockEditor.vue'
import PlanTimeline from './PlanTimeline.vue'

const { config, result } = useScenarios()
const selectedBlock = ref<string | null>(null)

function onSelect(parent: ParentKey, from: number, to: number, blockId: string | null) {
  if (blockId) {
    selectedBlock.value = blockId
    return
  }
  const block = { id: createId('block'), from, to, leave: true, hours: 0, allowance: 'none' as const }
  config.value.blocks[parent] = normalizeBlocks([...config.value.blocks[parent], block])
  selectedBlock.value = block.id
}

async function applyPreset(preset: PlanPreset) {
  const hasPlan = config.value.blocks.a.length + config.value.blocks.b.length > 0
  if (hasPlan && !(await confirmDialog({ title: 'Plan ersetzen?', description: `Der aktuelle Plan wird durch „${preset.label}“ ersetzt.`, confirmLabel: 'Ersetzen' }))) return
  config.value.blocks = generateQuickPlan(preset.quick, config.value.relationship)
  selectedBlock.value = null
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
              <span class="font-medium">{{ preset.label }}</span>
              <span class="text-muted-foreground text-xs">{{ preset.description }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardAction>
    </CardHeader>
    <CardContent class="grid gap-6">
      <PlanTimeline :selected-block-id="selectedBlock" @select="onSelect" />
      <div class="grid gap-4 border-t pt-5">
        <p class="text-muted-foreground text-xs">
          Außerhalb der Zeiträume wird normal gearbeitet. Ein Klick in den Zeitstrahl legt dort einen neuen Zeitraum an.
        </p>
        <BlockEditor v-model:selected="selectedBlock" />
      </div>
    </CardContent>
  </Card>
</template>
