import { daysInMonth, monthKey, parseIso, toIso, type IsoDate } from './dates'
import type { MonthRow } from './result'
import type { ParentKey, VariantConfig } from './types'

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
  entitlement: number
}

export interface VacationSummary {
  parent: ParentKey
  ranges: LeaveRange[]
  years: VacationYear[]
  /** Days saved because leave runs from the birth-date day instead of full calendar months. */
  savedByAlignment: number
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

/**
 * § 17 BEEG: the employer may reduce the annual vacation by 1/12 for each full calendar month of
 * Elternzeit. Months with part-time work at the own employer and Mutterschutz do not count.
 */
export function computeVacation(config: VariantConfig, months: MonthRow[], activeParents: ParentKey[]): Record<ParentKey, VacationSummary> {
  const firstYear = parseIso(months[0].start).year
  const lastYear = parseIso(months[months.length - 1].end).year
  const summaries = {} as Record<ParentKey, VacationSummary>
  for (const key of ['a', 'b'] as ParentKey[]) {
    const days = config.parents[key].vacationDaysPerYear
    const ranges = activeParents.includes(key) ? leaveRanges(months, key) : []
    const leaveMonths = new Set(ranges.flatMap((r) => fullCalendarMonths(r.start, r.end)))
    const years: VacationYear[] = []
    for (let year = firstYear; year <= lastYear; year++) {
      const fullLeaveMonths = [...leaveMonths].filter((m) => m.startsWith(`${year}-`)).length
      const reduction = config.employerReducesVacation ? (days * fullLeaveMonths) / 12 : 0
      years.push({ year, contractual: days, fullLeaveMonths, reduction, entitlement: days - reduction })
    }
    const savedByAlignment = config.employerReducesVacation
      ? ranges.reduce((sum, r) => sum + ((r.lifeMonths - r.fullCalendarMonths) * days) / 12, 0)
      : 0
    summaries[key] = { parent: key, ranges, years, savedByAlignment }
  }
  return summaries
}
