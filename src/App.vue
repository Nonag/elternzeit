<script setup lang="ts">
import { CalculatorIcon } from '@lucide/vue'
import { useColorMode } from '@vueuse/core'
import { computed } from 'vue'
import 'vue-sonner/style.css'
import AppHeader from '@/components/header/AppHeader.vue'
import AdminSetupDialog from '@/components/dialogs/AdminSetupDialog.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import PromptDialog from '@/components/dialogs/PromptDialog.vue'
import InputPanel from '@/components/inputs/InputPanel.vue'
import PlanCard from '@/components/plan/PlanCard.vue'
import LegalBasisPanel from '@/components/results/LegalBasisPanel.vue'
import BalanceChart from '@/components/results/BalanceChart.vue'
import ComparePanel from '@/components/results/ComparePanel.vue'
import DeadlinesPanel from '@/components/results/DeadlinesPanel.vue'
import IncomeChart from '@/components/results/IncomeChart.vue'
import IssuesPanel from '@/components/results/IssuesPanel.vue'
import KpiCards from '@/components/results/KpiCards.vue'
import LongTermPanel from '@/components/results/LongTermPanel.vue'
import MonthlyTable from '@/components/results/MonthlyTable.vue'
import VacationPanel from '@/components/results/VacationPanel.vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useVariants } from '@/stores/variants'

const { result, deadlines, missing, loads } = useVariants()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.state.value === 'dark')
const openIssues = computed(() => result.value.issues.filter((i) => i.severity === 'error' || i.severity === 'warning').length)
const dueDeadlines = computed(() => deadlines.value.filter((d) => d.status === 'soon' || d.status === 'missed').length)
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <div class="bg-muted/30 min-h-screen">
      <AppHeader />
      <div class="grid lg:grid-cols-[25rem_minmax(0,1fr)]">
        <aside class="bg-card border-r lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:overflow-y-auto lg:overscroll-contain">
          <InputPanel />
        </aside>
        <main v-if="missing.length" class="p-5">
          <Empty class="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalculatorIcon /></EmptyMedia>
              <EmptyTitle>Noch keine Berechnung</EmptyTitle>
              <EmptyDescription>Dafür fehlen noch diese Angaben:</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <ul class="grid gap-1 text-sm">
                <li v-for="label in missing" :key="label">{{ label }}</li>
              </ul>
            </EmptyContent>
          </Empty>
        </main>
        <!-- A newly loaded planning fades in. -->
        <main v-else :key="loads" class="grid min-w-0 content-start gap-5 p-5" :class="loads ? 'animate-in fade-in duration-500' : ''">
          <KpiCards />
          <PlanCard />
          <Card>
            <CardHeader>
              <CardTitle>Monatsübersicht</CardTitle>
              <CardDescription>Einnahmen, Ausgaben und Betreuung für jeden Lebensmonat des Kindes.</CardDescription>
            </CardHeader>
            <CardContent><MonthlyTable /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Haushaltseinkommen</CardTitle>
              <CardDescription>Einnahmen pro Monat nach Quelle. Gestrichelt: das gemeinsame Netto vor der Geburt. Rot: Ausgaben.</CardDescription>
            </CardHeader>
            <CardContent><IncomeChart /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Kontostand</CardTitle>
              <CardDescription>Guthaben zur Geburt plus Einnahmen minus Ausgaben, Monat für Monat.</CardDescription>
            </CardHeader>
            <CardContent><BalanceChart /></CardContent>
          </Card>
          <Card>
            <CardContent>
              <Tabs default-value="issues">
                <TabsList class="flex-wrap">
                  <TabsTrigger value="issues">
                    Hinweise &amp; Tipps
                    <span v-if="openIssues" class="bg-destructive/10 text-destructive ml-1 rounded-full px-1.5 text-[0.65rem]">{{ openIssues }}</span>
                  </TabsTrigger>
                  <TabsTrigger value="deadlines">
                    Fristen
                    <span v-if="dueDeadlines" class="ml-1 rounded-full bg-amber-100 px-1.5 text-[0.65rem] text-amber-800">{{ dueDeadlines }}</span>
                  </TabsTrigger>
                  <TabsTrigger value="vacation">Urlaub</TabsTrigger>
                  <TabsTrigger value="longterm">Rente &amp; Vermögen</TabsTrigger>
                  <TabsTrigger value="compare">Vergleich</TabsTrigger>
                  <TabsTrigger value="legal-basis">Rechtsstand</TabsTrigger>
                </TabsList>
                <TabsContent value="issues" class="pt-4"><IssuesPanel /></TabsContent>
                <TabsContent value="deadlines" class="pt-4"><DeadlinesPanel /></TabsContent>
                <TabsContent value="vacation" class="pt-4"><VacationPanel /></TabsContent>
                <TabsContent value="longterm" class="pt-4"><LongTermPanel /></TabsContent>
                <TabsContent value="compare" class="pt-4"><ComparePanel /></TabsContent>
                <TabsContent value="legal-basis" class="pt-4"><LegalBasisPanel /></TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
    <ConfirmDialog />
    <PromptDialog />
    <!-- Toasts are shown with notify() from lib/toasts.ts. The card is the list item, whose height Sonner sets while
         stacking, so a long toast behind a short one does not stick out. -->
    <Toaster
      :theme="isDark ? 'dark' : 'light'"
      :toast-options="{ class: 'w-(--width) overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-lg' }"
    />
    <AdminSetupDialog />
  </TooltipProvider>
</template>
