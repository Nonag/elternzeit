<script setup lang="ts">
import { BadgeEuroIcon, PiggyBankIcon, ShieldCheckIcon, TrendingDownIcon } from '@lucide/vue'
import { computed } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import InfoTip from '@/components/fields/InfoTip.vue'
import { euro, formatDate, signedEuro } from '@/lib/format'
import { useVariants } from '@/stores/variants'

const { result, deadlines } = useVariants()

const totals = computed(() => result.value.totals)
const errors = computed(() => result.value.issues.filter((i) => i.severity === 'error').length)
const warnings = computed(() => result.value.issues.filter((i) => i.severity === 'warning').length)
const nextDeadline = computed(() => deadlines.value.find((d) => !d.isEvent && (d.status === 'soon' || d.status === 'upcoming')))
const weakestMonth = computed(() =>
  result.value.months.reduce((min, row) => (row.delta < min.delta ? row : min), result.value.months[0]),
)
const allowanceSplit = computed(() =>
  result.value.activeParents.map((k) => `${result.value.parents[k].name} ${euro(result.value.parents[k].totals.parentalAllowance)}`).join(' · '),
)
</script>

<template>
  <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
    <Card class="py-4">
      <CardContent class="grid gap-1 px-5">
        <div class="text-muted-foreground flex items-center gap-1.5 truncate text-xs"><BadgeEuroIcon class="size-3.5 shrink-0" /> Elterngeld gesamt</div>
        <div class="text-2xl font-semibold tabular-nums">{{ euro(totals.parentalAllowance) }}</div>
        <div class="text-muted-foreground truncate text-xs">{{ allowanceSplit }}</div>
        <div class="text-muted-foreground truncate text-xs">
          {{ totals.maternityBenefit > 0 ? `dazu Mutterschaftsgeld ${euro(totals.maternityBenefit)}` : '\u00a0' }}
        </div>
      </CardContent>
    </Card>
    <Card class="py-4">
      <CardContent class="grid gap-1 px-5">
        <div class="text-muted-foreground flex items-center gap-1.5 text-xs">
          <TrendingDownIcon class="size-3.5 shrink-0" />
          <span class="truncate">Einkommen vs. vorher</span>
          <InfoTip text="Alle Einnahmen (Gehalt, Elterngeld, Mutterschaftsgeld, Kindergeld) minus euer gemeinsames Netto vor der Geburt." />
        </div>
        <div class="text-2xl font-semibold tabular-nums" :class="totals.delta < 0 ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400'">
          {{ signedEuro(totals.delta) }}
        </div>
        <div class="text-muted-foreground truncate text-xs">zusammen über {{ result.horizon }} Monate</div>
        <div class="text-muted-foreground truncate text-xs" :title="`Monat ${weakestMonth.index}`">
          schwächster Monat: {{ signedEuro(weakestMonth.delta) }}
        </div>
      </CardContent>
    </Card>
    <Card class="py-4">
      <CardContent class="grid gap-1 px-5">
        <div class="text-muted-foreground flex items-center gap-1.5 truncate text-xs"><PiggyBankIcon class="size-3.5 shrink-0" /> Kontostand</div>
        <div class="text-2xl font-semibold tabular-nums" :class="totals.minBalance < 0 ? 'text-destructive' : ''">
          {{ euro(totals.minBalance) }}
        </div>
        <div class="text-muted-foreground truncate text-xs">
          tiefster Stand {{ totals.minBalanceMonth ? `in Monat ${totals.minBalanceMonth}` : 'zur Geburt' }}
        </div>
        <div class="text-muted-foreground truncate text-xs">am Ende: {{ euro(totals.finalBalance) }}</div>
      </CardContent>
    </Card>
    <Card class="py-4">
      <CardContent class="grid gap-1 px-5">
        <div class="text-muted-foreground flex items-center gap-1.5 truncate text-xs"><ShieldCheckIcon class="size-3.5 shrink-0" /> Prüfung</div>
        <div class="text-2xl font-semibold" :class="errors ? 'text-destructive' : warnings ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
          {{ errors ? `${errors} Fehler` : warnings ? `${warnings} Warnungen` : 'Alles ok' }}
        </div>
        <div class="text-muted-foreground truncate text-xs">{{ errors }} Fehler · {{ warnings }} Warnungen</div>
        <div class="text-muted-foreground truncate text-xs" :title="nextDeadline?.title">
          <template v-if="nextDeadline">
            nächste Frist: <span :class="nextDeadline.status === 'soon' ? 'font-medium text-amber-700 dark:text-amber-400' : ''">{{ formatDate(nextDeadline.date) }}</span>
          </template>
          <template v-else>keine offenen Fristen</template>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
