<script setup lang="ts">
import { BabyIcon, HandCoinsIcon, SchoolIcon, UserIcon, UsersIcon } from '@lucide/vue'
import { computed } from 'vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import CostsSection from './CostsSection.vue'
import FamilySection from './FamilySection.vue'
import KitaSection from './KitaSection.vue'
import ParentSection from './ParentSection.vue'
import SupportSection from './SupportSection.vue'
import { useScenarios } from '@/stores/scenarios'

const { config } = useScenarios()
const parentKeys = computed(() => (config.value.relationship === 'single' ? (['a'] as const) : (['a', 'b'] as const)))
</script>

<template>
  <Accordion type="single" collapsible default-value="family" class="w-full">
    <AccordionItem value="family">
      <AccordionTrigger class="px-5 py-4 hover:no-underline">
        <span class="flex items-center gap-2.5"><BabyIcon class="size-4" /> Familie &amp; Termine</span>
      </AccordionTrigger>
      <AccordionContent class="px-5 pb-6"><FamilySection /></AccordionContent>
    </AccordionItem>
    <AccordionItem v-for="key in parentKeys" :key="key" :value="`parent-${key}`">
      <AccordionTrigger class="px-5 py-4 hover:no-underline">
        <span class="flex items-center gap-2.5"><UserIcon class="size-4" /> {{ config.parents[key].name }}: Job &amp; Gehalt</span>
      </AccordionTrigger>
      <AccordionContent class="px-5 pb-6"><ParentSection :parent-key="key" /></AccordionContent>
    </AccordionItem>
    <AccordionItem value="costs">
      <AccordionTrigger class="px-5 py-4 hover:no-underline">
        <span class="flex items-center gap-2.5"><HandCoinsIcon class="size-4" /> Kosten &amp; Rücklagen</span>
      </AccordionTrigger>
      <AccordionContent class="px-5 pb-6"><CostsSection /></AccordionContent>
    </AccordionItem>
    <AccordionItem value="kita">
      <AccordionTrigger class="px-5 py-4 hover:no-underline">
        <span class="flex items-center gap-2.5"><SchoolIcon class="size-4" /> Kita</span>
      </AccordionTrigger>
      <AccordionContent class="px-5 pb-6"><KitaSection /></AccordionContent>
    </AccordionItem>
    <AccordionItem value="support">
      <AccordionTrigger class="px-5 py-4 hover:no-underline">
        <span class="flex items-center gap-2.5"><UsersIcon class="size-4" /> Familie &amp; Freunde</span>
      </AccordionTrigger>
      <AccordionContent class="px-5 pb-6"><SupportSection /></AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
