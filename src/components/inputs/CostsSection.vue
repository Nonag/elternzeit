<script setup lang="ts">
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FieldGroup from '@/components/fields/FieldGroup.vue'
import FormField from '@/components/fields/FormField.vue'
import NumberInput from '@/components/fields/NumberInput.vue'
import SelectField from '@/components/fields/SelectField.vue'
import { createId } from '@/engine/plan'
import { useScenarios } from '@/stores/scenarios'

const { config, result } = useScenarios()

const whenOptions = computed(() => [
  { value: 0, label: 'vor der Geburt' },
  ...Array.from({ length: result.value.horizon }, (_, i) => ({ value: i + 1, label: `im ${i + 1}. Lebensmonat` })),
])

function addChildCost() {
  config.value.childCosts.push({ id: createId('cost'), label: 'Neuer Posten', monthly: 50, fromMonth: 1, toMonth: null })
}

function addOneTime() {
  config.value.oneTimeCosts.push({ id: createId('once'), label: 'Neue Ausgabe', amount: 500, month: 0 })
}
</script>

<template>
  <div class="grid gap-6">
    <FieldGroup title="Haushalt">
      <FormField label="Fixkosten pro Monat" hint="Alle regelmäßigen Ausgaben ohne Kind, z. B. Miete, Lebensmittel, Versicherungen.">
        <NumberInput v-model="config.fixedCostsBefore" unit="€" :step="50" />
      </FormField>
      <div class="grid grid-cols-2 gap-4">
        <FormField label="Kontostand zur Geburt" hint="Startwert für die Kontostand-Grafik.">
          <NumberInput v-model="config.startBalance" unit="€" :step="500" />
        </FormField>
        <FormField label="Mindestreserve" hint="Fällt der Kontostand darunter, gibt es eine Warnung.">
          <NumberInput v-model="config.minReserve" unit="€" :step="500" />
        </FormField>
      </div>
    </FieldGroup>

    <FieldGroup title="Laufende Kosten fürs Kind">
      <p class="text-muted-foreground -mt-1 text-xs leading-relaxed">
        Zum Beispiel Windeln, Nahrung oder Kleidung, ohne Kita. Monat 1 ist der erste Lebensmonat.
      </p>
      <div v-for="(item, i) in config.childCosts" :key="item.id" class="grid gap-3 rounded-lg border p-3">
        <div class="flex items-center gap-2">
          <Input v-model="item.label" class="h-9 flex-1" aria-label="Bezeichnung" />
          <Button variant="ghost" size="icon" aria-label="Posten entfernen" @click="config.childCosts.splice(i, 1)"><Trash2Icon /></Button>
        </div>
        <div class="grid grid-cols-[1.3fr_1fr_1fr] gap-3">
          <FormField label="pro Monat">
            <NumberInput v-model="item.monthly" unit="€" :step="10" />
          </FormField>
          <FormField label="ab Monat">
            <NumberInput v-model="item.fromMonth" :min="1" :max="96" />
          </FormField>
          <FormField label="bis Monat">
            <NumberInput v-model="item.toMonth" nullable placeholder="laufend" :min="1" :max="96" />
          </FormField>
        </div>
      </div>
      <Button variant="outline" class="h-9 w-full" @click="addChildCost"><PlusIcon /> Posten hinzufügen</Button>
    </FieldGroup>

    <FieldGroup title="Einmalige Kosten">
      <p class="text-muted-foreground -mt-1 text-xs leading-relaxed">Zum Beispiel Kinderwagen, Babybett, Autositz.</p>
      <div v-for="(item, i) in config.oneTimeCosts" :key="item.id" class="grid gap-3 rounded-lg border p-3">
        <div class="flex items-center gap-2">
          <Input v-model="item.label" class="h-9 flex-1" aria-label="Bezeichnung" />
          <Button variant="ghost" size="icon" aria-label="Ausgabe entfernen" @click="config.oneTimeCosts.splice(i, 1)"><Trash2Icon /></Button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <FormField label="Betrag">
            <NumberInput v-model="item.amount" unit="€" :step="100" />
          </FormField>
          <FormField label="Wann">
            <SelectField v-model="item.month" :options="whenOptions" />
          </FormField>
        </div>
      </div>
      <Button variant="outline" class="h-9 w-full" @click="addOneTime"><PlusIcon /> Ausgabe hinzufügen</Button>
    </FieldGroup>
  </div>
</template>
