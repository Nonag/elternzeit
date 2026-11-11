<script setup lang="ts">
import {
  createColumnHelper,
  FlexRender,
  getCoreRowModel,
  useVueTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/vue-table'
import { DownloadIcon } from '@lucide/vue'
import { computed, h, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import ChoiceToggle from '@/components/fields/ChoiceToggle.vue'
import { monthStyle } from '@/components/plan/planStyle'
import { formatDate, formatMonthKey, formatShortDate } from '@/engine/dates'
import type { MonthRow, ParentMonth } from '@/engine/result'
import type { ParentKey } from '@/engine/types'
import { hoursWorked } from '@/engine/vacation'
import { count, euro, num, signedEuro } from '@/lib/format'
import { useVariants } from '@/stores/variants'

const { result, config } = useVariants()

type View = 'compact' | 'details'
const view = ref<View>('compact')
const showCare = ref(true)
const showExpenses = ref(false)

const column = createColumnHelper<MonthRow>()

interface ColumnMeta {
  align?: 'left' | 'right' | 'center'
  sticky?: boolean
  csv?: (row: MonthRow) => string | number
  csvHeader?: string
}

function money(value: number, className = '') {
  return h('span', { class: `tabular-nums ${className}` }, Math.abs(value) < 0.005 ? '–' : euro(value))
}

function sum(pick: (row: MonthRow) => number): number {
  return result.value.months.reduce((s, row) => s + pick(row), 0)
}

function moneyColumn(
  id: string,
  header: string,
  pick: (row: MonthRow) => number,
  options: { csvHeader?: string; className?: (row: MonthRow) => string; footer?: boolean; signed?: boolean } = {},
) {
  return column.display({
    id,
    header,
    cell: ({ row }) => {
      const value = pick(row.original)
      const className = options.className?.(row.original) ?? ''
      return options.signed ? h('span', { class: `tabular-nums ${className}` }, signedEuro(value)) : money(value, className)
    },
    footer: options.footer === false ? undefined : () => h('span', { class: 'tabular-nums font-medium' }, options.signed ? signedEuro(sum(pick)) : euro(sum(pick))),
    meta: { align: 'right', csv: (row: MonthRow) => pick(row).toFixed(2).replace('.', ','), csvHeader: options.csvHeader ?? header } satisfies ColumnMeta,
  })
}

function modelCell(month: ParentMonth) {
  const style = monthStyle(month)
  const chip = h(
    'span',
    {
      class: `inline-flex rounded px-1.5 py-0.5 text-[0.7rem] font-medium whitespace-nowrap ${style.textClass} ${style.striped ? 'plan-stripes' : ''} ${style.borderClass ?? ''}`,
      style: { backgroundColor: style.color },
    },
    style.short,
  )
  const note = [month.allowanceNote, month.vacationDays > 0 ? `Urlaub: ${count(month.vacationDays, 'Tag', 'Tage')}` : ''].filter(Boolean).join('\n')
  if (!note) return chip
  return h(Tooltip, null, {
    default: () => [
      h(TooltipTrigger, { asChild: true }, () => chip),
      h(TooltipContent, { class: 'max-w-sm whitespace-pre-line' }, () => note),
    ],
  })
}

function oneTimeCell(row: MonthRow, key: ParentKey) {
  const payments = result.value.oneTimePayments.filter((p) => p.parent === key && p.lifeMonth === row.index)
  if (!payments.length) return money(0)
  return h(Tooltip, null, {
    default: () => [
      h(TooltipTrigger, { asChild: true }, () => money(row[key].oneTimePayments, 'cursor-default underline decoration-dotted underline-offset-2')),
      h(TooltipContent, { class: 'max-w-sm whitespace-pre-line' }, () =>
        payments.map((p) => `${p.label}: ${euro(p.gross)} brutto, ${euro(p.net)} netto`).join('\n'),
      ),
    ],
  })
}

function parentColumns(key: ParentKey): ColumnDef<MonthRow, unknown>[] {
  const name = result.value.parents[key].name
  const cols: ColumnDef<MonthRow, unknown>[] = [
    column.display({
      id: `${key}-model`,
      header: 'Modell',
      cell: ({ row }) => modelCell(row.original[key]),
      meta: { csv: (row: MonthRow) => monthStyle(row[key]).short, csvHeader: `${name} Modell` } satisfies ColumnMeta,
    }),
    column.display({
      id: `${key}-hours`,
      header: 'Std.',
      cell: ({ row }) => h('span', { class: 'tabular-nums' }, hoursWorked(row.original[key]) ? num(hoursWorked(row.original[key])) : '–'),
      meta: { align: 'right', csv: (row: MonthRow) => num(hoursWorked(row[key])), csvHeader: `${name} Stunden` } satisfies ColumnMeta,
    }),
    moneyColumn(`${key}-net`, 'Netto-Lohn', (row) => row[key].netSalary, { csvHeader: `${name} Netto-Lohn` }),
    {
      ...moneyColumn(`${key}-once`, 'Einmal&shy;zahlung', (row) => row[key].oneTimePayments, { csvHeader: `${name} Einmalzahlung (netto)` }),
      cell: ({ row }) => oneTimeCell(row.original, key),
    },
  ]
  if (key === 'a') {
    cols.push(moneyColumn('a-maternity', 'Mutter&shy;schaftsl.', (row) => row.a.maternityBenefit, { csvHeader: `${name} Mutterschaftsleistungen` }))
  }
  cols.push(
    moneyColumn(`${key}-allowance`, 'Elterngeld', (row) => row[key].parentalAllowance, { csvHeader: `${name} Elterngeld` }),
    moneyColumn(`${key}-total`, 'Summe', (row) => row[key].total, { csvHeader: `${name} Summe` }),
  )
  return cols
}

const columns = computed<ColumnDef<MonthRow, unknown>[]>(() => [
  column.group({
    id: 'period',
    header: 'Zeitraum',
    columns: [
      column.display({
        id: 'index',
        header: 'Monat',
        cell: ({ row }) => h('span', { class: 'font-medium tabular-nums' }, String(row.original.index)),
        footer: () => h('span', { class: 'font-medium' }, 'Summe'),
        meta: { sticky: true, csv: (row: MonthRow) => row.index, csvHeader: 'Lebensmonat' } satisfies ColumnMeta,
      }),
      column.display({
        id: 'dates',
        header: 'Zeitraum',
        cell: ({ row }) =>
          h('span', { class: 'text-muted-foreground whitespace-nowrap', title: formatMonthKey(row.original.calendarMonth, true) }, [
            `${formatShortDate(row.original.start)}–${formatDate(row.original.end).slice(0, 6)}${row.original.end.slice(2, 4)}`,
          ]),
        meta: { csv: (row: MonthRow) => `${formatDate(row.start)} - ${formatDate(row.end)}`, csvHeader: 'Zeitraum' } satisfies ColumnMeta,
      }),
    ],
  }),
  ...result.value.activeParents.map((key) =>
    column.group({ id: `parent-${key}`, header: result.value.parents[key].name, columns: parentColumns(key) }),
  ),
  column.group({
    id: 'care',
    header: 'Betreuung (h/Woche)',
    columns: [
      column.display({
        id: 'care-need',
        header: 'Bedarf',
        cell: ({ row }) => h('span', { class: 'tabular-nums' }, row.original.care.need ? num(row.original.care.need) : '–'),
        meta: { align: 'right', csv: (row: MonthRow) => num(row.care.need), csvHeader: 'Betreuungsbedarf h/Woche' } satisfies ColumnMeta,
      }),
      column.display({
        id: 'care-family',
        header: 'Familie',
        cell: ({ row }) => h('span', { class: 'tabular-nums' }, row.original.care.familyCovered ? num(row.original.care.familyCovered) : '–'),
        meta: { align: 'right', csv: (row: MonthRow) => num(row.care.familyCovered), csvHeader: 'Familie h/Woche' } satisfies ColumnMeta,
      }),
      column.display({
        id: 'care-childcare',
        header: 'Kita',
        cell: ({ row }) => h('span', { class: 'tabular-nums' }, row.original.care.childcareCovered ? num(row.original.care.childcareCovered) : '–'),
        meta: { align: 'right', csv: (row: MonthRow) => num(row.care.childcareCovered), csvHeader: 'Kita h/Woche' } satisfies ColumnMeta,
      }),
      column.display({
        id: 'care-gap',
        header: 'Lücke',
        cell: ({ row }) =>
          h(
            'span',
            { class: `tabular-nums ${row.original.care.gap > 0.5 ? 'font-medium text-destructive' : ''}` },
            row.original.care.gap > 0.5 ? num(row.original.care.gap) : '–',
          ),
        meta: { align: 'right', csv: (row: MonthRow) => num(row.care.gap), csvHeader: 'Betreuungslücke h/Woche' } satisfies ColumnMeta,
      }),
    ],
  }),
  column.group({
    id: 'expenses',
    header: 'Ausgaben',
    columns: [
      moneyColumn('exp-fixed', 'Fix', (row) => row.fixedCosts, { csvHeader: 'Fixkosten' }),
      moneyColumn('exp-child', 'Kind', (row) => row.childCosts, { csvHeader: 'Kosten Kind' }),
      moneyColumn('exp-childcare', 'Kita', (row) => row.childcareFee, { csvHeader: 'Kita-Beitrag' }),
      moneyColumn('exp-health', 'KV', (row) => row.healthCosts, { csvHeader: 'Krankenversicherung (ohne Gehalt)' }),
      moneyColumn('exp-once', 'Einmalig', (row) => row.oneTimeCosts, { csvHeader: 'Einmalkosten' }),
    ],
  }),
  column.group({
    id: 'household',
    header: 'Haushalt',
    columns: [
      moneyColumn('childBenefit', 'Kinder&shy;geld', (row) => row.childBenefit, { csvHeader: 'Kindergeld' }),
      moneyColumn('income', 'Einnahmen', (row) => row.income, { className: () => 'font-medium' }),
      moneyColumn('reference', 'vor Geburt', (row) => row.preBirthIncome, {
        csvHeader: 'Netto vor der Geburt',
        className: () => 'text-muted-foreground',
      }),
      moneyColumn('delta', 'Differenz', (row) => row.delta, {
        signed: true,
        className: (row) => (row.delta < -0.5 ? 'text-destructive' : row.delta > 0.5 ? 'text-emerald-700 dark:text-emerald-400' : ''),
      }),
      moneyColumn('expenses', 'Ausgaben', (row) => row.expenses),
      moneyColumn('saldo', 'Saldo', (row) => row.balanceChange, {
        signed: true,
        className: (row) => (row.balanceChange < -0.5 ? 'text-destructive' : ''),
      }),
      moneyColumn('balance', 'Kontostand', (row) => row.balance, {
        footer: false,
        className: (row) => (row.balance < 0 ? 'font-medium text-destructive' : row.balance < config.value.minReserve ? 'text-amber-700 dark:text-amber-400' : ''),
      }),
    ],
  }),
])

/** Two header rows, twelve months and the totals row fit without scrolling. */
const TABLE_HEIGHT = `${2 * 37 + 12 * 41 + 40 + 2}px`

const DETAIL_COLUMNS = ['a-hours', 'a-net', 'a-maternity', 'a-allowance', 'b-hours', 'b-net', 'b-allowance', 'reference', 'childBenefit']
const CARE_COLUMNS = ['care-need', 'care-family', 'care-childcare', 'care-gap']
const EXPENSE_COLUMNS = ['exp-fixed', 'exp-child', 'exp-childcare', 'exp-health', 'exp-once']

const columnVisibility = computed<VisibilityState>(() => {
  const visibility: VisibilityState = {}
  for (const id of DETAIL_COLUMNS) visibility[id] = view.value === 'details'
  for (const id of CARE_COLUMNS) visibility[id] = showCare.value
  for (const id of EXPENSE_COLUMNS) visibility[id] = showExpenses.value
  // One-time payments only in the full view and only for parents who have some in the planning period.
  for (const key of ['a', 'b'] as ParentKey[]) {
    visibility[`${key}-once`] =
      view.value === 'details' &&
      result.value.oneTimePayments.some((p) => p.parent === key && p.lifeMonth >= 1 && p.lifeMonth <= result.value.horizon)
  }
  return visibility
})

const table = useVueTable({
  get data() {
    return result.value.months
  },
  get columns() {
    return columns.value
  },
  state: {
    get columnVisibility() {
      return columnVisibility.value
    },
  },
  getCoreRowModel: getCoreRowModel(),
})

function meta(def: unknown): ColumnMeta {
  return ((def as { meta?: ColumnMeta }).meta ?? {}) as ColumnMeta
}

function alignClass(def: unknown): string {
  const align = meta(def).align
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
}

function rowClass(row: MonthRow): string {
  if (row.a.maternityDays > 0) return 'bg-[color-mix(in_oklch,var(--plan-maternity)_8%,transparent)]'
  if (row.markers.includes('childcareStart')) return 'bg-[color-mix(in_oklch,var(--plan-childcare)_12%,transparent)]'
  return ''
}

function exportCsv() {
  const leafColumns = table.getVisibleLeafColumns()
  const groupName = (id: string) => {
    if (id.startsWith('a-')) return result.value.parents.a.name
    if (id.startsWith('b-')) return result.value.parents.b.name
    return ''
  }
  const header = leafColumns.map((c) => {
    const m = meta(c.columnDef)
    return m.csvHeader ?? `${groupName(c.id)} ${String(c.columnDef.header ?? c.id)}`.trim()
  })
  const lines = result.value.months.map((row) =>
    leafColumns.map((c) => {
      const value = meta(c.columnDef).csv?.(row) ?? ''
      return `"${String(value).replace(/"/g, '""')}"`
    }),
  )
  const csv = '\uFEFF' + [header.map((h) => `"${h}"`), ...lines].map((cells) => cells.join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'elternzeit-monatsplan.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <div class="grid gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <div class="w-56">
        <ChoiceToggle
          v-model="view"
          :options="[
            { value: 'compact', label: 'Kompakt' },
            { value: 'details', label: 'Alle Beträge' },
          ]"
        />
      </div>
      <label class="flex items-center gap-2 text-sm"><Checkbox v-model="showCare" /> Betreuung</label>
      <label class="flex items-center gap-2 text-sm"><Checkbox v-model="showExpenses" /> Ausgaben im Detail</label>
      <Button variant="outline" size="sm" class="ml-auto" @click="exportCsv"><DownloadIcon /> CSV</Button>
    </div>
    <!-- Separate borders: collapsed borders would let rows shine through the sticky header. -->
    <div class="max-h-[var(--table-height)] overflow-auto rounded-lg border" :style="{ '--table-height': TABLE_HEIGHT }">
      <table class="w-full border-separate border-spacing-0 caption-bottom text-xs">
        <TableHeader class="sticky top-0 z-20">
          <TableRow v-for="group in table.getHeaderGroups()" :key="group.id" class="hover:bg-transparent">
            <TableHead
              v-for="(header, headerIndex) in group.headers"
              :key="header.id"
              :colspan="header.colSpan"
              class="bg-card h-9 border-b px-2"
              :class="[
                header.subHeaders.length ? 'text-center font-semibold' : alignClass(header.column.columnDef),
                header.subHeaders.length && headerIndex > 0 ? 'border-l' : '',
                meta(header.column.columnDef).sticky ? 'sticky left-0 z-30' : '',
              ]"
            >
              <span v-if="!header.isPlaceholder" class="whitespace-nowrap" v-html="String(header.column.columnDef.header ?? '')" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in table.getRowModel().rows" :key="row.id" :class="rowClass(row.original)">
            <TableCell
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="h-10 border-b px-2 py-1.5"
              :class="[alignClass(cell.column.columnDef), meta(cell.column.columnDef).sticky ? 'bg-card sticky left-0 z-10' : '']"
            >
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </TableCell>
          </TableRow>
        </TableBody>
        <TableFooter class="sticky bottom-0 z-20 border-t-0">
          <TableRow v-for="group in table.getFooterGroups().slice(0, 1)" :key="group.id" class="hover:bg-transparent">
            <TableCell
              v-for="footer in group.headers"
              :key="footer.id"
              class="bg-muted h-10 px-2 py-1.5"
              :class="[alignClass(footer.column.columnDef), meta(footer.column.columnDef).sticky ? 'sticky left-0 z-10' : '']"
            >
              <FlexRender v-if="!footer.isPlaceholder" :render="footer.column.columnDef.footer" :props="footer.getContext()" />
            </TableCell>
          </TableRow>
        </TableFooter>
      </table>
    </div>
    <p class="text-muted-foreground text-xs leading-relaxed">
      Eine Zeile entspricht einem Lebensmonat. „vor Geburt“ ist euer gemeinsames Netto vor der Geburt, „Differenz“ die
      Einnahmen des Monats minus dieses Netto.
    </p>
  </div>
</template>
