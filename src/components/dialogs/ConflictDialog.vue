<script setup lang="ts">
import { ChevronRightIcon } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import ChoiceToggle from '@/components/fields/ChoiceToggle.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatTimestamp } from '@/engine/format'
import { applyMerge, isResolved, planMerge, VARIANT_SECTION, type MergeConflict, type Resolution, type Side } from '@/lib/planningMerge'
import type { MergeInput } from '@/stores/planning'
import type { Variant } from '@/stores/variants'

const props = defineProps<{ input: MergeInput }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ save: [variants: Variant[]] }>()

const SIDES: { value: Side; label: string }[] = [
  { value: 'local', label: 'meins' },
  { value: 'remote', label: 'Server' },
]

const plan = computed(() => planMerge(props.input.base, props.input.local, props.input.remote))
const resolution = ref<Resolution>({})
watch(
  () => props.input,
  () => (resolution.value = {}),
)

const description = computed(() => {
  const saved = `${props.input.current.savedBy || 'Jemand'} hat am ${formatTimestamp(props.input.current.savedAt)} gespeichert.`
  return plan.value.conflicts
    ? `${saved} Bitte bei jedem Konflikt auswählen, was gelten soll.`
    : `${saved} Die Änderungen werden beim Speichern zusammengeführt.`
})
const openConflicts = computed(
  () => plan.value.variants.filter((v) => v.conflict && !isResolved({ variants: [v], conflicts: 1 }, resolution.value)).length,
)

/** The choices a conflict needs: the sections of an edited variant, or keeping a deleted one. */
const choicesOf = (conflict: MergeConflict) => (conflict.kind === 'deleted' ? [VARIANT_SECTION] : conflict.sections.map((s) => s.id))

/** The pick for the whole variant, if all its choices agree. */
function variantPick(id: string, conflict: MergeConflict): Side | null {
  const picks = choicesOf(conflict).map((choice) => resolution.value[id]?.[choice])
  return picks.every((pick) => pick && pick === picks[0]) ? (picks[0] ?? null) : null
}

function pickVariant(id: string, conflict: MergeConflict, side: Side | null) {
  if (side) resolution.value[id] = Object.fromEntries(choicesOf(conflict).map((choice) => [choice, side]))
}

function pickSection(id: string, section: string, side: Side | null) {
  if (side) resolution.value[id] = { ...resolution.value[id], [section]: side }
}

function pickAll(side: Side) {
  for (const { id, conflict } of plan.value.variants) if (conflict) pickVariant(id, conflict, side)
}

const conflictText = (conflict: MergeConflict) =>
  conflict.kind === 'edited' ? 'geändert bei dir und auf dem Server' : conflict.by === 'remote' ? 'gelöscht auf dem Server' : 'gelöscht bei dir'

function save() {
  emit('save', applyMerge(props.input.base, props.input.local, props.input.remote, resolution.value))
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="grid max-h-[90vh] grid-rows-[auto_1fr_auto] sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>„{{ input.current.name }}“ wurde inzwischen geändert</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>

      <div class="-mx-6 grid min-h-0 content-start gap-3 overflow-y-auto px-6">
        <div v-if="plan.conflicts > 1" class="flex gap-2">
          <Button variant="outline" size="sm" @click="pickAll('local')">Überall meins</Button>
          <Button variant="outline" size="sm" @click="pickAll('remote')">Überall Server</Button>
        </div>

        <div v-for="item in plan.variants" :key="item.id" class="grid gap-2 rounded-lg border p-3 text-sm">
          <div class="flex items-center gap-2">
            <span class="truncate font-medium">„{{ item.name }}“</span>
            <Badge v-if="item.conflict" variant="destructive">Konflikt</Badge>
          </div>
          <ul v-if="item.notes.length" class="text-muted-foreground grid list-disc gap-0.5 pl-5">
            <li v-for="note in item.notes" :key="note">{{ note }}</li>
          </ul>

          <template v-if="item.conflict">
            <div class="flex items-center justify-between gap-3">
              <span class="text-muted-foreground">{{ conflictText(item.conflict) }}</span>
              <div class="w-40 shrink-0">
                <ChoiceToggle
                  :model-value="variantPick(item.id, item.conflict)"
                  :options="SIDES"
                  @update:model-value="(side) => pickVariant(item.id, item.conflict!, side)"
                />
              </div>
            </div>
            <Collapsible v-if="item.conflict.kind === 'edited' && item.conflict.sections.length > 1">
              <CollapsibleTrigger as-child>
                <Button variant="ghost" size="sm" class="group/trigger text-muted-foreground -ml-2">
                  <ChevronRightIcon class="transition-transform group-data-[state=open]/trigger:rotate-90" />
                  Einzeln auswählen
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent class="grid gap-2 pt-1 pl-6">
                <div v-for="section in item.conflict.sections" :key="section.id" class="flex items-center justify-between gap-3">
                  <span>{{ section.label }}</span>
                  <div class="w-40 shrink-0">
                    <ChoiceToggle
                      :model-value="resolution[item.id]?.[section.id] ?? null"
                      :options="SIDES"
                      @update:model-value="(side) => pickSection(item.id, section.id, side)"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </template>
        </div>
      </div>

      <DialogFooter class="items-center">
        <span v-if="openConflicts" class="text-muted-foreground mr-auto text-sm">
          {{ openConflicts === 1 ? '1 Konflikt offen' : `${openConflicts} Konflikte offen` }}
        </span>
        <DialogClose as-child><Button variant="outline">Abbrechen</Button></DialogClose>
        <Button :disabled="openConflicts > 0" @click="save">Speichern</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
