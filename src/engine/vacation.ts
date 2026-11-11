import {
  addDays,
  daysInMonth,
  diffDays,
  isLeapYear,
  maxIso,
  minIso,
  monthKey,
  overlapDays,
  parseIso,
  toIso,
  weekday,
  weekdays,
  weekEnd,
  weekStart,
  type IsoDate,
  type LifeMonth,
} from './dates'
import { round2 } from './math'
import type { MonthRow, ParentMonth, SimulationResult } from './result'
import type { ParentKey, VacationPeriod, VariantConfig } from './types'

export interface LeaveRange {
  start: IsoDate
  end: IsoDate
  lifeMonths: number
  fullCalendarMonths: number
}

export interface VacationYear {
  year: number
  contractual: number
  /** Annual entitlement before the reduction, prorated for months with fewer working days per week. */
  annual: number
  fullLeaveMonths: number
  reduction: number
  /** Entitlement after the reduction. */
  entitlement: number
  /** Vacation days planned in this calendar year. */
  planned: number
  /** Entitlement minus planned vacation; negative when more is planned than available. */
  remaining: number
}

export interface VacationUse {
  weeks: number
  /** Vacation days the weeks cost. */
  days: number
}

export interface VacationSummary {
  parent: ParentKey
  ranges: LeaveRange[]
  years: VacationYear[]
  /** Days saved because leave runs from the birth-date day instead of full calendar months. */
  savedByAlignment: number
  /** Vacation periods by id. */
  periods: Record<string, VacationUse>
}

/** Vacation planned for one parent. */
export interface PlannedVacation {
  periods: Record<string, VacationUse>
  /** Share of the weekdays spent on vacation, per life month. */
  shares: number[]
  /** Vacation days per life month. */
  days: number[]
  /** Vacation days per calendar year. */
  byYear: Map<number, number>
}

/** What decides the cost of a vacation day: work in the life month around it. */
export interface WorkMonth {
  start: IsoDate
  end: IsoDate
  leave: boolean
  hours: number
  /** Working days per week. */
  workDays: number
}

/** Working days from start to end for a week with `perWeek` working days (Monday to Friday, scaled). */
function workingDays(start: IsoDate, end: IsoDate, perWeek: number): number {
  return (weekdays(start, end) * perWeek) / 5
}

/** Working days per calendar year from start to end. */
export function workingDaysByYear(start: IsoDate, end: IsoDate, perWeek: number): Map<number, number> {
  const result = new Map<number, number>()
  for (let year = parseIso(start).year; year <= parseIso(end).year; year++) {
    result.set(year, workingDays(maxIso(start, `${year}-01-01`), minIso(end, `${year}-12-31`), perWeek))
  }
  return result
}

/**
 * Vacation days one weekday costs: the working days per week of that time divided by five. Nothing during
 * Elternzeit without work and Mutterschutz, where no vacation can be taken, and outside the plan.
 */
function vacationDayCost(months: WorkMonth[], date: IsoDate, maternityEnd: IsoDate | null): number {
  const index = months.findIndex((m) => m.start <= date && date <= m.end)
  return index < 0 ? 0 : costIn(months[index], date, maternityEnd)
}

function costIn(month: WorkMonth, date: IsoDate, maternityEnd: IsoDate | null): number {
  if (weekday(date) > 4 || (maternityEnd !== null && date <= maternityEnd)) return 0
  return month.leave && month.hours === 0 ? 0 : month.workDays / 5
}

/** Vacation days per calendar year that the weekdays from start to end cost. */
export function vacationDaysByYear(months: WorkMonth[], start: IsoDate, end: IsoDate, maternityEnd: IsoDate | null): Map<number, number> {
  const byYear = new Map<number, number>()
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const cost = vacationDayCost(months, date, maternityEnd)
    const year = parseIso(date).year
    if (cost > 0) byYear.set(year, (byYear.get(year) ?? 0) + cost)
  }
  return byYear
}

/** Mondays of the weeks of a vacation period. */
export function vacationWeeks(period: VacationPeriod): IsoDate[] {
  const weeks: IsoDate[] = []
  for (let monday = weekStart(period.from); monday <= period.to; monday = addDays(monday, 7)) weeks.push(monday)
  return weeks
}

/**
 * Adds the week of a Monday to the vacation or takes it out again. Weeks right after each other form one period;
 * taking a week out of the middle splits it.
 */
export function toggleVacationWeek(periods: VacationPeriod[], monday: IsoDate, newId: () => string): VacationPeriod[] {
  const byStart = (list: VacationPeriod[]) => list.sort((x, y) => x.from.localeCompare(y.from))
  const containing = periods.find((p) => p.from <= weekEnd(monday) && monday <= p.to)
  if (containing) {
    const parts = [
      { from: containing.from, to: addDays(monday, -1) },
      { from: addDays(monday, 7), to: containing.to },
    ].filter((part) => part.from <= part.to)
    const split = parts.map((part, i) => ({ id: i === 0 ? containing.id : newId(), ...part }))
    return byStart([...periods.filter((p) => p !== containing), ...split])
  }
  const before = periods.find((p) => p.to === addDays(monday, -1))
  const after = periods.find((p) => p.from === addDays(monday, 7))
  const merged = { id: before?.id ?? after?.id ?? newId(), from: before?.from ?? monday, to: after?.to ?? weekEnd(monday) }
  return byStart([...periods.filter((p) => p !== before && p !== after), merged])
}

/** The work months of a parent from a simulation result. */
export function workMonths(result: SimulationResult, key: ParentKey): WorkMonth[] {
  return result.months.map((row) => ({ start: row.start, end: row.end, leave: row[key].leave, hours: row[key].hours, workDays: row[key].workDays }))
}

/** Day by day: the vacation days each period costs, and how they fall on life months and calendar years. */
export function planVacation(periods: VacationPeriod[], lms: LifeMonth[], months: WorkMonth[], maternityEnd: IsoDate | null): PlannedVacation {
  const planned: PlannedVacation = { periods: {}, shares: lms.map(() => 0), days: lms.map(() => 0), byYear: new Map() }
  const offWeekdays = lms.map(() => 0)
  for (const period of periods) {
    if (!period.from || !period.to || period.to < period.from) continue
    let days = 0
    for (let date = period.from; date <= period.to; date = addDays(date, 1)) {
      const index = months.findIndex((m) => m.start <= date && date <= m.end)
      const cost = index < 0 ? 0 : costIn(months[index], date, maternityEnd)
      if (cost === 0) continue
      days += cost
      planned.days[index] += cost
      offWeekdays[index] += 1
      const year = parseIso(date).year
      planned.byYear.set(year, (planned.byYear.get(year) ?? 0) + cost)
    }
    planned.periods[period.id] = { weeks: Math.round((diffDays(period.from, period.to) + 3) / 7), days: round2(days) }
  }
  lms.forEach((lm, i) => {
    const total = weekdays(lm.start, lm.end)
    planned.shares[i] = total > 0 ? Math.min(1, offWeekdays[i] / total) : 0
  })
  return planned
}

/** Weekly hours actually worked: contract hours without the vacation share. */
export function hoursWorked(month: ParentMonth): number {
  return month.hours * (1 - month.vacationShare)
}

/** Calendar months that lie completely inside [start, end]. */
export function fullCalendarMonths(start: IsoDate, end: IsoDate): string[] {
  const result: string[] = []
  const s = parseIso(start)
  let year = s.year
  let month = s.month
  if (s.day !== 1) {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  for (;;) {
    const first = toIso({ year, month, day: 1 })
    const last = toIso({ year, month, day: daysInMonth(year, month) })
    if (last > end) break
    if (first >= start) result.push(monthKey(first))
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return result
}

/** Full-time parental leave (0 h) without Mutterschutz, grouped into date ranges. */
function leaveRanges(months: MonthRow[], key: ParentKey): LeaveRange[] {
  const ranges: LeaveRange[] = []
  let current: { from: MonthRow; to: MonthRow } | null = null
  const flush = () => {
    if (!current) return
    const start = current.from.start
    const end = current.to.end
    ranges.push({
      start,
      end,
      lifeMonths: current.to.index - current.from.index + 1,
      fullCalendarMonths: fullCalendarMonths(start, end).length,
    })
    current = null
  }
  for (const row of months) {
    const m = row[key]
    const isFullLeave = m.active && m.leave && m.hours === 0 && !m.maternityLocked
    if (isFullLeave) {
      if (current && current.to.index === row.index - 1) current.to = row
      else {
        flush()
        current = { from: row, to: row }
      }
    } else flush()
  }
  flush()
  return ranges
}

/**
 * Contract vacation for a calendar year, prorated by the working days per week of each day. Days already
 * earned keep their value when someone switches to fewer days (EuGH C-415/12, BAG 9 AZR 53/14 (F)).
 */
function annualEntitlement(months: MonthRow[], key: ParentKey, year: number, contractual: number, perWeek: number): number {
  const first = `${year}-01-01`
  const last = `${year}-12-31`
  const yearDays = isLeapYear(year) ? 366 : 365
  let covered = 0
  let weighted = 0
  for (const row of months) {
    const days = overlapDays(row.start, row.end, first, last)
    covered += days
    weighted += (days * row[key].workDays) / perWeek
  }
  return round2((contractual * (weighted + yearDays - covered)) / yearDays)
}

/**
 * Vacation per calendar year. § 17 BEEG: the employer may reduce the annual vacation by 1/12 for each full
 * calendar month of Elternzeit. Months with part-time work at the own employer and Mutterschutz do not count.
 */
export function computeVacation(
  config: VariantConfig,
  months: MonthRow[],
  activeParents: ParentKey[],
  planned: Record<ParentKey, PlannedVacation>,
): Record<ParentKey, VacationSummary> {
  const firstYear = parseIso(months[0].start).year
  const lastYear = parseIso(months[months.length - 1].end).year
  const summaries = {} as Record<ParentKey, VacationSummary>
  for (const key of ['a', 'b'] as ParentKey[]) {
    const active = activeParents.includes(key)
    const days = config.parents[key].vacationDaysPerYear
    const perWeek = config.parents[key].workDaysPerWeek
    const ranges = active ? leaveRanges(months, key) : []
    const leaveMonths = new Set(ranges.flatMap((r) => fullCalendarMonths(r.start, r.end)))
    const years: VacationYear[] = []
    for (let year = firstYear; year <= lastYear; year++) {
      const fullLeaveMonths = [...leaveMonths].filter((m) => m.startsWith(`${year}-`)).length
      const annual = active ? annualEntitlement(months, key, year, days, perWeek) : days
      const reduction = config.employerReducesVacation ? (annual * fullLeaveMonths) / 12 : 0
      const entitlement = annual - reduction
      const plannedDays = active ? round2(planned[key].byYear.get(year) ?? 0) : 0
      years.push({ year, contractual: days, annual, fullLeaveMonths, reduction, entitlement, planned: plannedDays, remaining: entitlement - plannedDays })
    }
    const savedByAlignment = config.employerReducesVacation
      ? ranges.reduce((sum, r) => sum + ((r.lifeMonths - r.fullCalendarMonths) * days) / 12, 0)
      : 0
    summaries[key] = { parent: key, ranges, years, savedByAlignment, periods: active ? planned[key].periods : {} }
  }
  return summaries
}
