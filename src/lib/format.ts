import { formatDate, formatMonthKey, formatShortDate } from '@/engine/dates'

const euro0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const euro2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const number1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const percent1 = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 })

export function euro(value: number | null | undefined, cents = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  const normalized = Math.abs(value) < 0.005 ? 0 : value
  return (cents ? euro2 : euro0).format(normalized)
}

export function signedEuro(value: number): string {
  const formatted = euro(Math.abs(value))
  if (Math.abs(value) < 0.5) return formatted
  return value > 0 ? `+${formatted}` : `−${formatted}`
}

export function num(value: number): string {
  return number1.format(value)
}

export function percent(value: number): string {
  return percent1.format(value)
}

export { formatDate, formatMonthKey, formatShortDate }
