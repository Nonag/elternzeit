/**
 * Calendar helpers working on ISO date strings ('YYYY-MM-DD') in UTC to avoid timezone drift.
 */

export type IsoDate = string

export interface DateParts {
  year: number
  month: number
  day: number
}

const MS_PER_DAY = 86_400_000

export function parseIso(iso: IsoDate): DateParts {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

export function toIso({ year, month, day }: DateParts): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}

export function toEpochDay(iso: IsoDate): number {
  const { year, month, day } = parseIso(iso)
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY)
}

export function fromEpochDay(epochDay: number): IsoDate {
  const date = new Date(epochDay * MS_PER_DAY)
  return toIso({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() })
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(iso) + days)
}

/** Number of days from `from` to `to` (negative if `to` is earlier). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return toEpochDay(to) - toEpochDay(from)
}

/** Adds calendar months; if the day does not exist in the target month it is clamped to the month end. */
export function addMonths(iso: IsoDate, months: number): { date: IsoDate; clamped: boolean } {
  const { year, month, day } = parseIso(iso)
  const total = year * 12 + (month - 1) + months
  const targetYear = Math.floor(total / 12)
  const targetMonth = (total % 12) + 1
  const lastDay = daysInMonth(targetYear, targetMonth)
  return {
    date: toIso({ year: targetYear, month: targetMonth, day: Math.min(day, lastDay) }),
    clamped: day > lastDay,
  }
}

export function compareIso(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function maxIso(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b
}

export function minIso(a: IsoDate, b: IsoDate): IsoDate {
  return a < b ? a : b
}

/** Number of days shared by two inclusive date ranges. */
export function overlapDays(aStart: IsoDate, aEnd: IsoDate, bStart: IsoDate, bEnd: IsoDate): number {
  const start = maxIso(aStart, bStart)
  const end = minIso(aEnd, bEnd)
  return start > end ? 0 : diffDays(start, end) + 1
}

/** 'YYYY-MM' key of the month containing the date. */
export function monthKey(iso: IsoDate): string {
  return iso.slice(0, 7)
}

export function monthKeyToIso(key: string, day = 1): IsoDate {
  return `${key}-${String(day).padStart(2, '0')}`
}

export function addMonthsToKey(key: string, months: number): string {
  return monthKey(addMonths(monthKeyToIso(key), months).date)
}

export function monthsBetweenKeys(from: string, to: string): number {
  const a = parseIso(monthKeyToIso(from))
  const b = parseIso(monthKeyToIso(to))
  return (b.year - a.year) * 12 + (b.month - a.month)
}

export function lastDayOfMonth(key: string): IsoDate {
  const { year, month } = parseIso(monthKeyToIso(key))
  return toIso({ year, month, day: daysInMonth(year, month) })
}

export function formatDate(iso: IsoDate): string {
  const { year, month, day } = parseIso(iso)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
}

export function formatShortDate(iso: IsoDate): string {
  const { month, day } = parseIso(iso)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.`
}

const MONTH_NAMES_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const MONTH_NAMES_DE_LONG = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

export function formatMonthKey(key: string, long = false): string {
  const { year, month } = parseIso(monthKeyToIso(key))
  return `${(long ? MONTH_NAMES_DE_LONG : MONTH_NAMES_DE)[month - 1]} ${year}`
}

export function todayIso(): IsoDate {
  const now = new Date()
  return toIso({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() })
}

/**
 * A "Lebensmonat" (month of the child's life) as defined by § 4 BEEG with §§ 187, 188 BGB:
 * month n ends the day before the birth-date day in month n; if that day does not exist,
 * it ends on the last day of that month and the next month starts on the 1st.
 */
export interface LifeMonth {
  index: number
  start: IsoDate
  end: IsoDate
  days: number
}

export function lifeMonthEnd(birth: IsoDate, index: number): IsoDate {
  const { date, clamped } = addMonths(birth, index)
  return clamped ? date : addDays(date, -1)
}

export function lifeMonth(birth: IsoDate, index: number): LifeMonth {
  const start = index === 1 ? birth : addDays(lifeMonthEnd(birth, index - 1), 1)
  const end = lifeMonthEnd(birth, index)
  return { index, start, end, days: diffDays(start, end) + 1 }
}

export function lifeMonths(birth: IsoDate, count: number): LifeMonth[] {
  return Array.from({ length: count }, (_, i) => lifeMonth(birth, i + 1))
}

/** Index of the life month containing `date` (0 if before birth). */
export function lifeMonthIndexOf(birth: IsoDate, date: IsoDate): number {
  if (date < birth) return 0
  const b = parseIso(birth)
  const d = parseIso(date)
  let index = Math.max(1, (d.year - b.year) * 12 + (d.month - b.month))
  while (index > 1 && lifeMonth(birth, index).start > date) index--
  while (lifeMonth(birth, index).end < date) index++
  return index
}

/**
 * Calendar month that a life month represents in the monthly overview: the month whose 16th falls
 * into the life month. Monthly calendar amounts (salary, Kindergeld, Kita fees) are booked there.
 */
export function primaryCalendarMonth(month: LifeMonth): string {
  const startParts = parseIso(month.start)
  const candidate = toIso({ year: startParts.year, month: startParts.month, day: 16 })
  if (candidate >= month.start && candidate <= month.end) return monthKey(candidate)
  return monthKey(addMonths(candidate, 1).date)
}

/** Life month (≥ 1) that books a calendar month; months before the birth month map to 0. */
export function lifeMonthForCalendarMonth(birth: IsoDate, key: string): number {
  if (key < monthKey(birth)) return 0
  const sixteenth = monthKeyToIso(key, 16)
  return Math.max(1, lifeMonthIndexOf(birth, sixteenth))
}
