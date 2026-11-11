import { daysInMonth, monthKey, parseIso, toEpochDay, toIso, type IsoDate, type LifeMonth } from './dates'
import type { MonthRow, ParentMonth } from './result'
import type { ParentKey, PlanPeriod, VariantConfig } from './types'

export interface LeaveRange {
  start: IsoDate
  end: IsoDate
  lifeMonths: number
  fullCalendarMonths: number
}

export interface VacationYear {
  year: number
  contractual: number
  fullLeaveMonths: number
  reduction: number
  /** Entitlement after the reduction. */
  entitlement: number
  /** Vacation days planned in this calendar year. */
  planned: number
  /** Entitlement minus planned vacation; negative when more is planned than available. */
  remaining: number
}

export interface VacationPeriodUse {
  /** Working days in the period: the most vacation days it can take. */
  available: number
  /** Vacation days taken, at most `available`. */
  taken: number
}

export interface VacationSummary {
  parent: ParentKey
  ranges: LeaveRange[]
  years: VacationYear[]
  /** Days saved because leave runs from the birth-date day instead of full calendar months. */
  savedByAlignment: number
  /** Vacation periods by id. */
  periods: Record<string, VacationPeriodUse>
}

/** Vacation planned for one parent, spread over the life months. */
export interface PlannedVacation {
  periods: Record<string, VacationPeriodUse>
  /** Share of the working days spent on vacation, per life month. */
  shares: number[]
  /** Vacation days per life month. */
  days: number[]
}

/** Monday to Friday from start to end, inclusive. */
export function weekdays(start: IsoDate, end: IsoDate): number {
  const first = toEpochDay(start)
  const last = toEpochDay(end)
  if (last < first) return 0
  const fullWeeks = Math.floor((last - first + 1) / 7)
  let count = fullWeeks * 5
  for (let day = first + fullWeeks * 7; day <= last; day++) {
    // Day 0 (1970-01-01) was a Thursday: 0 = Monday … 6 = Sunday.
    if ((((day + 3) % 7) + 7) % 7 < 5) count++
  }
  return count
}

/** Working days from start to end for a week with `perWeek` working days (Monday to Friday, scaled). */
export function workingDays(start: IsoDate, end: IsoDate, perWeek: number): number {
  return (weekdays(start, end) * perWeek) / 5
}

const roundHalf = (value: number) => Math.round(value * 2) / 2

/**
 * Spreads the vacation days of each vacation period evenly over its working days. Life months in which no
 * vacation can be taken (Mutterschutz) do not count.
 */
export function planVacation(
  periods: PlanPeriod[],
  lms: LifeMonth[],
  workDaysPerWeek: number,
  unavailable: (lm: LifeMonth) => boolean,
): PlannedVacation {
  const planned: PlannedVacation = { periods: {}, shares: lms.map(() => 0), days: lms.map(() => 0) }
  for (const period of periods) {
    if (period.kind !== 'vacation') continue
    const covered = lms.filter((lm) => lm.index >= period.from && lm.index <= period.to && !unavailable(lm))
    const perMonth = covered.map((lm) => workingDays(lm.start, lm.end, workDaysPerWeek))
    const available = roundHalf(perMonth.reduce((sum, days) => sum + days, 0))
    const taken = Math.min(available, Math.max(0, period.vacationDays ?? available))
    const share = available > 0 ? taken / available : 0
    covered.forEach((lm, i) => {
      planned.shares[lm.index - 1] = share
      planned.days[lm.index - 1] = perMonth[i] * share
    })
    planned.periods[period.id] = { available, taken }
  }
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
export function leaveRanges(months: MonthRow[], key: ParentKey): LeaveRange[] {
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

/** Vacation days of the life months that fall into a calendar year. */
function plannedInYear(months: MonthRow[], key: ParentKey, year: number, perWeek: number): number {
  const first = `${year}-01-01`
  const last = `${year}-12-31`
  const days = months.reduce((sum, row) => {
    const share = row[key].vacationShare
    if (!share) return sum
    const start = row.start > first ? row.start : first
    const end = row.end < last ? row.end : last
    return start > end ? sum : sum + share * workingDays(start, end, perWeek)
  }, 0)
  return Math.round(days * 100) / 100
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
      const reduction = config.employerReducesVacation ? (days * fullLeaveMonths) / 12 : 0
      const entitlement = days - reduction
      const plannedDays = active ? plannedInYear(months, key, year, perWeek) : 0
      years.push({ year, contractual: days, fullLeaveMonths, reduction, entitlement, planned: plannedDays, remaining: entitlement - plannedDays })
    }
    const savedByAlignment = config.employerReducesVacation
      ? ranges.reduce((sum, r) => sum + ((r.lifeMonths - r.fullCalendarMonths) * days) / 12, 0)
      : 0
    summaries[key] = { parent: key, ranges, years, savedByAlignment, periods: active ? planned[key].periods : {} }
  }
  return summaries
}
