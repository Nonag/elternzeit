/** German number and text formatting, for the texts of the calculations and the interface alike. */
import { consecutiveRuns } from './math'

const euro0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const euro2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const euroCompact = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })
const percent1 = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 })
const numbers = new Map<string, Intl.NumberFormat>()

function numberFormat(minimum: number, maximum: number): Intl.NumberFormat {
  const key = `${minimum}-${maximum}`
  let format = numbers.get(key)
  if (!format) {
    format = new Intl.NumberFormat('de-DE', { minimumFractionDigits: minimum, maximumFractionDigits: maximum })
    numbers.set(key, format)
  }
  return format
}

/** "1.234 €", with cents "1.234,56 €"; "–" without a value. */
export function euro(value: number | null | undefined, cents = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  const normalized = Math.abs(value) < 0.005 ? 0 : value
  return (cents ? euro2 : euro0).format(normalized)
}

/** "+1.234 €" or "−1.234 €". */
export function signedEuro(value: number): string {
  const formatted = euro(Math.abs(value))
  if (Math.abs(value) < 0.5) return formatted
  return value > 0 ? `+${formatted}` : `−${formatted}`
}

/** Short amounts for chart axes, e.g. "1,2 Mio. €". */
export function compactEuro(value: number): string {
  return euroCompact.format(value)
}

/** Up to `decimals` decimals: "1.234", "2,5". */
export function num(value: number, decimals = 1): string {
  return numberFormat(0, decimals).format(value)
}

/** Always `decimals` decimals, e.g. pension points "1,20". */
export function fixed(value: number, decimals: number): string {
  return numberFormat(decimals, decimals).format(value)
}

/** A number with its noun: "1 Woche", "3 Wochen", "2,5 Tage". */
export function count(value: number, one: string, many: string): string {
  return `${num(value)} ${value === 1 ? one : many}`
}

/** 0.125 → "12,5 %". */
export function percent(value: number): string {
  return percent1.format(value)
}

/** "11.11.2026 um 17:30" */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return `${date.toLocaleDateString('de-DE')} um ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
}

/** Life months: "Monat 3" or "Monat 3–12". */
export function formatMonthRange(from: number, to: number): string {
  return from === to ? `Monat ${from}` : `Monat ${from}–${to}`
}

/** Life months: "Monat 3", "Monat 3–12" or "Monat 3, 5–7". */
export function formatMonthList(months: number[]): string {
  const parts = consecutiveRuns(months).map((run) => (run.length === 1 ? `${run[0]}` : `${run[0]}–${run[run.length - 1]}`))
  return `Monat ${parts.join(', ')}`
}
