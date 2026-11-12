import type { AllowanceType, ParentKey, PlanPeriod, ParentPlanOutline, PlanOutline, RelationshipStatus } from './types'

let idCounter = 0
export function createId(prefix = 'id'): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

export function sortPeriods(periods: PlanPeriod[]): PlanPeriod[] {
  return [...periods].sort((x, y) => x.from - y.from || x.to - y.to)
}

/** Inserts a period and trims or splits existing periods it overlaps ("painting"). */
export function paintPeriod(periods: PlanPeriod[], period: PlanPeriod): PlanPeriod[] {
  const result: PlanPeriod[] = []
  for (const existing of periods) {
    if (existing.id === period.id) continue
    if (existing.to < period.from || existing.from > period.to) {
      result.push(existing)
      continue
    }
    if (existing.from < period.from) result.push({ ...existing, to: period.from - 1 })
    if (existing.to > period.to) {
      result.push({ ...existing, id: existing.from < period.from ? createId('period') : existing.id, from: period.to + 1 })
    }
  }
  result.push(period)
  return sortPeriods(result)
}

/** Removes overlaps (later periods in the list win) and invalid ranges. */
export function normalizePeriods(periods: PlanPeriod[]): PlanPeriod[] {
  let result: PlanPeriod[] = []
  for (const period of periods) {
    const from = Math.max(1, Math.round(period.from))
    const to = Math.max(from, Math.round(period.to))
    result = paintPeriod(result, { ...period, from, to })
  }
  return result
}

function parentPeriodsFromOutline(plan: ParentPlanOutline): PlanPeriod[] {
  const periods: PlanPeriod[] = []
  let cursor = Math.max(1, plan.start)
  if (plan.leaveMonths > 0) {
    periods.push({
      id: createId('period'),
      from: cursor,
      to: cursor + plan.leaveMonths - 1,
      kind: 'leave',
      workDays: null,
      hours: 0,
      allowance: plan.leaveAllowance,
    })
    cursor += plan.leaveMonths
  }
  if (plan.partTimeMonths > 0) {
    periods.push({
      id: createId('period'),
      from: cursor,
      to: cursor + plan.partTimeMonths - 1,
      kind: 'leave',
      workDays: null,
      hours: plan.partTimeHours,
      allowance: plan.partTimeAllowance,
    })
  }
  return periods
}

function fullLeaveEnd(plan: ParentPlanOutline): number {
  return plan.leaveMonths > 0 ? Math.max(1, plan.start) + plan.leaveMonths - 1 : 0
}

/** Builds periods from the key figures the first version stored ("quickPlan"). */
export function periodsFromOutline(outline: PlanOutline, relationship: RelationshipStatus): Record<ParentKey, PlanPeriod[]> {
  let a = parentPeriodsFromOutline(outline.a)
  let b = relationship === 'single' ? [] : parentPeriodsFromOutline(outline.b)
  if (outline.bonusMonths >= 2) {
    const start = outline.bonusStart ?? Math.max(fullLeaveEnd(outline.a), fullLeaveEnd(outline.b)) + 1
    const bonus = (): PlanPeriod => ({
      id: createId('period'),
      from: start,
      to: start + outline.bonusMonths - 1,
      kind: 'leave',
      workDays: null,
      hours: outline.bonusHours,
      allowance: 'bonus',
    })
    a = paintPeriod(a, bonus())
    if (relationship !== 'single') b = paintPeriod(b, bonus())
  }
  return { a, b }
}

export interface MonthPlan {
  leave: boolean
  hours: number
  /** Working days per week set for the period (null = as in the contract). */
  workDays: number | null
  hoursMissing: boolean
  allowance: AllowanceType
  periodId: string | null
}

export function expandPeriods(periods: PlanPeriod[], horizon: number, contractHours: number): MonthPlan[] {
  const months: MonthPlan[] = Array.from({ length: horizon }, () => ({
    leave: false,
    hours: contractHours,
    workDays: null,
    hoursMissing: false,
    allowance: 'none' as AllowanceType,
    periodId: null,
  }))
  for (const period of periods) {
    for (let m = Math.max(1, period.from); m <= Math.min(horizon, period.to); m++) {
      months[m - 1] = {
        leave: period.kind === 'leave',
        hours: period.hours ?? 0,
        workDays: period.workDays,
        hoursMissing: period.hours === null,
        allowance: period.allowance,
        periodId: period.id,
      }
    }
  }
  return months
}

/** A period of a preset in life months, in Elternzeit; hours are the weekly working hours (0 = not working). */
interface PresetPeriod {
  from: number
  to: number
  allowance: AllowanceType
  hours: number
}

export interface PlanPreset {
  id: string
  label: string
  description: string
  /** Presets for two parents or for a single parent. */
  parents: 'two' | 'one'
  periods: { a: PresetPeriod[]; b?: PresetPeriod[] }
}

const leave = (from: number, to: number, allowance: AllowanceType, hours = 0): PresetPeriod => ({ from, to, allowance, hours })

export const PLAN_PRESETS: PlanPreset[] = [
  {
    id: 'classic',
    label: 'Klassisch 12 + 2',
    description: 'Mutter 12 Monate Basiselterngeld, danach Vater 2 Monate.',
    parents: 'two',
    periods: { a: [leave(1, 12, 'basic')], b: [leave(13, 14, 'basic')] },
  },
  {
    id: 'start-together',
    label: 'Start zu zweit',
    description: 'Mutter 12 Monate Basiselterngeld, Vater die ersten 4 Monate mit ElterngeldPlus zu Hause.',
    parents: 'two',
    periods: { a: [leave(1, 12, 'basic')], b: [leave(1, 4, 'plus')] },
  },
  {
    // Parallel Basiselterngeld is allowed in one month only, which the first month uses; hence Plus in month 12.
    id: 'first-and-twelfth',
    label: 'Vater im 1. und 12. Monat',
    description: 'Mutter 12 Monate Basiselterngeld, Vater im 1. Monat Basiselterngeld und im 12. Monat ElterngeldPlus.',
    parents: 'two',
    periods: { a: [leave(1, 12, 'basic')], b: [leave(1, 1, 'basic'), leave(12, 12, 'plus')] },
  },
  {
    id: 'equal',
    label: 'Halbe-Halbe 7 + 7',
    description: 'Mutter Monat 1–7, Vater Monat 8–14, jeweils Basiselterngeld.',
    parents: 'two',
    periods: { a: [leave(1, 7, 'basic')], b: [leave(8, 14, 'basic')] },
  },
  {
    id: 'plus-long',
    label: 'Länger mit Plus',
    description: 'Mutter 22 Monate mit ElterngeldPlus, danach Vater 4 Monate Teilzeit mit Plus.',
    parents: 'two',
    periods: { a: [leave(1, 22, 'plus')], b: [leave(23, 26, 'plus', 25)] },
  },
  {
    id: 'partnership',
    label: 'Partnerschaftlich mit Bonus',
    description: 'Mutter Monat 1–10, Vater Monat 11–14, danach beide 4 Monate 30 Stunden mit Partnerschaftsbonus.',
    parents: 'two',
    periods: { a: [leave(1, 10, 'basic'), leave(15, 18, 'bonus', 30)], b: [leave(11, 14, 'basic'), leave(15, 18, 'bonus', 30)] },
  },
  {
    id: 'single-basic',
    label: '14 Monate Basiselterngeld',
    description: 'Mutter 14 Monate Basiselterngeld.',
    parents: 'one',
    periods: { a: [leave(1, 14, 'basic')] },
  },
  {
    // The months of the Mutterschutz count as Basiselterngeld, so 24 months of Plus are left after them.
    id: 'single-plus',
    label: 'Länger mit Plus',
    description: 'Mutter 26 Monate mit ElterngeldPlus.',
    parents: 'one',
    periods: { a: [leave(1, 26, 'plus')] },
  },
  {
    id: 'single-part-time',
    label: 'Basis, danach Teilzeit',
    description: 'Mutter 12 Monate Basiselterngeld, danach 4 Monate Teilzeit mit 25 Stunden und ElterngeldPlus.',
    parents: 'one',
    periods: { a: [leave(1, 12, 'basic'), leave(13, 16, 'plus', 25)] },
  },
  {
    id: 'single-bonus',
    label: 'Mit Partnerschaftsbonus',
    description: 'Mutter 14 Monate Basiselterngeld, danach 4 Monate 30 Stunden mit Partnerschaftsbonus.',
    parents: 'one',
    periods: { a: [leave(1, 14, 'basic'), leave(15, 18, 'bonus', 30)] },
  },
]

/** The presets that fit the relationship: single parents get their own. */
export const presetsFor = (relationship: RelationshipStatus | null) =>
  PLAN_PRESETS.filter((preset) => preset.parents === (relationship === 'single' ? 'one' : 'two'))

export function periodsFromPreset(preset: PlanPreset): Record<ParentKey, PlanPeriod[]> {
  const build = (list: PresetPeriod[] = []): PlanPeriod[] =>
    list.map((p) => ({ id: createId('period'), from: p.from, to: p.to, kind: 'leave', hours: p.hours, workDays: null, allowance: p.allowance }))
  return { a: build(preset.periods.a), b: build(preset.periods.b) }
}
