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
      vacationDays: null,
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
      vacationDays: null,
      hours: plan.partTimeHours,
      allowance: plan.partTimeAllowance,
    })
  }
  return periods
}

function fullLeaveEnd(plan: ParentPlanOutline): number {
  return plan.leaveMonths > 0 ? Math.max(1, plan.start) + plan.leaveMonths - 1 : 0
}

/** Builds periods from key figures (used for presets and to migrate old variants). */
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
      vacationDays: null,
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
  /** Part of a vacation period: paid at contract hours. */
  vacation: boolean
  hours: number
  hoursMissing: boolean
  allowance: AllowanceType
  periodId: string | null
}

export function expandPeriods(periods: PlanPeriod[], horizon: number, contractHours: number): MonthPlan[] {
  const months: MonthPlan[] = Array.from({ length: horizon }, () => ({
    leave: false,
    vacation: false,
    hours: contractHours,
    hoursMissing: false,
    allowance: 'none' as AllowanceType,
    periodId: null,
  }))
  for (const period of periods) {
    for (let m = Math.max(1, period.from); m <= Math.min(horizon, period.to); m++) {
      const vacation = period.kind === 'vacation'
      months[m - 1] = {
        leave: period.kind === 'leave',
        vacation,
        hours: vacation ? contractHours : (period.hours ?? 0),
        hoursMissing: !vacation && period.hours === null,
        allowance: vacation ? 'none' : period.allowance,
        periodId: period.id,
      }
    }
  }
  return months
}

export interface PlanPreset {
  id: string
  label: string
  description: string
  outline: PlanOutline
}

const noPartTime = { partTimeMonths: 0, partTimeHours: 30, partTimeAllowance: 'plus' as const }

export const PLAN_PRESETS: PlanPreset[] = [
  {
    id: 'classic',
    label: 'Klassisch 12 + 2',
    description: 'Mutter 12 Monate Basiselterngeld, danach Vater 2 Monate.',
    outline: {
      a: { start: 1, leaveMonths: 12, leaveAllowance: 'basic', ...noPartTime },
      b: { start: 13, leaveMonths: 2, leaveAllowance: 'basic', ...noPartTime },
      bonusMonths: 0,
      bonusStart: null,
      bonusHours: 30,
    },
  },
  {
    id: 'start-together',
    label: 'Start zu zweit',
    description: 'Mutter 12 Monate Basiselterngeld, Vater die ersten 4 Monate mit ElterngeldPlus zu Hause.',
    outline: {
      a: { start: 1, leaveMonths: 12, leaveAllowance: 'basic', ...noPartTime },
      b: { start: 1, leaveMonths: 4, leaveAllowance: 'plus', ...noPartTime },
      bonusMonths: 0,
      bonusStart: null,
      bonusHours: 30,
    },
  },
  {
    id: 'equal',
    label: 'Halbe-Halbe 7 + 7',
    description: 'Mutter Monat 1–7, Vater Monat 8–14, jeweils Basiselterngeld.',
    outline: {
      a: { start: 1, leaveMonths: 7, leaveAllowance: 'basic', ...noPartTime },
      b: { start: 8, leaveMonths: 7, leaveAllowance: 'basic', ...noPartTime },
      bonusMonths: 0,
      bonusStart: null,
      bonusHours: 30,
    },
  },
  {
    id: 'plus-long',
    label: 'Länger mit Plus',
    description: 'Mutter 22 Monate mit ElterngeldPlus, danach Vater 4 Monate Teilzeit mit Plus.',
    outline: {
      a: { start: 1, leaveMonths: 22, leaveAllowance: 'plus', ...noPartTime },
      b: { start: 23, leaveMonths: 0, leaveAllowance: 'plus', partTimeMonths: 4, partTimeHours: 25, partTimeAllowance: 'plus' },
      bonusMonths: 0,
      bonusStart: null,
      bonusHours: 30,
    },
  },
  {
    id: 'partnership',
    label: 'Partnerschaftlich mit Bonus',
    description: 'Mutter Monat 1–10, Vater Monat 11–14, danach beide 4 Monate 30 Stunden mit Partnerschaftsbonus.',
    outline: {
      a: { start: 1, leaveMonths: 10, leaveAllowance: 'basic', ...noPartTime },
      b: { start: 11, leaveMonths: 4, leaveAllowance: 'basic', ...noPartTime },
      bonusMonths: 4,
      bonusStart: null,
      bonusHours: 30,
    },
  },
]
