<script setup lang="ts">
import { PuzzleIcon, WandSparklesIcon } from '@lucide/vue'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { confirmDialog } from '@/lib/dialogs'
import { notify } from '@/lib/toasts'
import { closeGaps, hasCareGaps, unclosedText } from '@/engine/gaps'
import { periodsFromPreset, presetsFor, type PlanPreset } from '@/engine/plan'
import { num } from '@/engine/format'
import { useVariants } from '@/stores/variants'
import IssueMarker from './IssueMarker.vue'
import PeriodEditor from './PeriodEditor.vue'
import { planIssues } from './planIssues'
import PlanTimeline from './PlanTimeline.vue'

const { config, result } = useVariants()
const selectedPeriod = ref<string | null>(null)
const counters = computed(() => planIssues(result.value, config.value).counters)

// Replacing an existing plan asks for confirmation first, hence the "…" on the presets.
const hasPlan = computed(() => config.value.periods.a.length + config.value.periods.b.length > 0)

async function applyPreset(preset: PlanPreset) {
  if (hasPlan.value && !(await confirmDialog({ title: 'Plan ersetzen?', description: `Der aktuelle Plan wird durch „${preset.label}“ ersetzt.`, confirmLabel: 'Ersetzen' }))) return
  config.value.periods = periodsFromPreset(preset)
  selectedPeriod.value = null
  if (hasCareGaps(result.value)) {
    notify(`„${preset.label}“ übernommen`, { description: 'Der Plan hat Lücken in der Betreuung.' })
  }
}

const gapsOpen = computed(() => hasCareGaps(result.value))

/**
 * Adjusts the plan so that the care gaps close, as one undo step. The toast lists what changed and stays until it is
 * closed, since it is long.
 */
function fillGaps() {
  const proposal = closeGaps(config.value)
  const unclosed = proposal.remaining.length ? unclosedText(proposal.remaining) : null
  if (!proposal.changes.length) {
    notify('Keine Änderung', { description: unclosed ?? undefined, persistent: true })
    return
  }
  config.value.periods = proposal.periods
  config.value.vacation = proposal.vacation
  selectedPeriod.value = null
  const lines = unclosed ? [...proposal.changes, unclosed] : proposal.changes
  notify(unclosed ? 'Lücken verkleinert' : 'Lücken geschlossen', { type: 'success', description: lines.join('\n'), persistent: true })
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Elternzeit & Elterngeld</CardTitle>
      <div class="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span class="flex items-center gap-1">
          Elterngeld
          <strong :class="result.entitlement.used > result.entitlement.available ? 'text-destructive' : 'text-foreground'">
            {{ num(result.entitlement.used) }}/{{ result.entitlement.available }} Monate
          </strong>
          <IssueMarker
            :issues="counters.allowance"
            text="Basiselterngeld zählt voll, ElterngeldPlus halb. Zusammen gibt es 14 Monate, wenn beide Elterngeld beziehen."
          />
        </span>
        <span class="flex items-center gap-1">
          Partnerschaftsbonus <strong class="text-foreground">{{ result.parents.a.counts.bonus }}/4</strong>
          <IssueMarker
            :issues="counters.bonus"
            text="Bis zu 4 zusätzliche Monate ElterngeldPlus für jeden Elternteil, wenn beide Eltern 2 bis 4 Monate am Stück gleichzeitig 24 bis 32 Stunden pro Woche arbeiten."
          />
        </span>
        <span class="flex items-center gap-1">
          Elternzeit
          <strong class="text-foreground">{{ result.activeParents.map((k) => `${result.parents[k].name} ${result.parents[k].counts.leaveMonths}`).join(' · ') }}</strong>
          Monate
          <IssueMarker :issues="counters.leave" />
        </span>
      </div>
      <CardAction class="flex gap-2">
        <!-- The span keeps the tooltip working on the disabled button. -->
        <Tooltip :disabled="gapsOpen">
          <TooltipTrigger as-child>
            <span>
              <Button variant="outline" :disabled="!gapsOpen" @click="fillGaps"><PuzzleIcon /> Lücken schließen</Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Keine Lücken</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline"><WandSparklesIcon /> Vorlage</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-80">
            <DropdownMenuLabel>Plan aus Vorlage erstellen</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem v-for="preset in presetsFor(config.relationship)" :key="preset.id" class="flex flex-col items-start gap-0.5" @click="applyPreset(preset)">
              <span class="font-medium">{{ preset.label }}{{ hasPlan ? ' …' : '' }}</span>
              <span class="text-muted-foreground text-xs">{{ preset.description }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardAction>
    </CardHeader>
    <CardContent class="grid gap-6">
      <PlanTimeline :selected-period-id="selectedPeriod" @select="(id) => (selectedPeriod = id)" />
      <div class="grid gap-4 border-t pt-5">
        <p class="text-muted-foreground text-xs">
          Außerhalb der Zeiträume wird normal gearbeitet.
        </p>
        <PeriodEditor v-model:selected="selectedPeriod" />
      </div>
    </CardContent>
  </Card>
</template>
