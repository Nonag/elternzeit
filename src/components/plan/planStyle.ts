import { num } from '@/engine/format'
import type { ParentMonth } from '@/engine/result'

export interface PlanStyle {
  label: string
  short: string
  /** For a segment of one life month: an abbreviation without hours. */
  tiny: string
  color: string
  textClass: string
  striped?: boolean
  /** Dashed border for work without Elternzeit; white on coloured months to stay visible in dark mode. */
  borderClass?: string
}

/**
 * Visual category of a parent's month in timeline, table and legend. EZ is Elternzeit without work, ETZ Elternteilzeit
 * (Elternzeit with hours), TZ work with fewer hours than the contract.
 */
export function monthStyle(month: ParentMonth, contractHours: number): PlanStyle {
  if (month.maternityLocked) {
    return { label: 'Mutterschutz (zählt als Basis)', short: 'Mutterschutz', tiny: 'Mutterschutz', color: 'var(--plan-maternity)', textClass: 'text-white' }
  }
  const hours = month.hours > 0 ? ` ${num(month.hours, 2)} h` : ''
  // Elterngeld does not need Elternzeit; without it the month is work, part-time below the contract hours.
  const work = !month.leave
  const partTime = work && month.hours < contractHours
  const base = work ? `${partTime ? 'Teilzeit' : 'Arbeit'}${hours}` : month.hours > 0 ? `Elternteilzeit${hours}` : 'Elternzeit'
  const tiny = work ? (partTime ? 'TZ' : 'Arb.') : month.hours > 0 ? 'ETZ' : 'EZ'
  const short = `${work && !partTime ? 'Arbeit' : tiny}${hours}`
  const borderClass = work ? 'border border-dashed border-white/70' : undefined
  switch (month.allowance) {
    case 'basic':
      return { label: `${base} + Basiselterngeld`, short: `${short} · Basis`, tiny, color: 'var(--plan-basic)', textClass: 'text-white', borderClass }
    case 'plus':
      return { label: `${base} + ElterngeldPlus`, short: `${short} · Plus`, tiny, color: 'var(--plan-plus)', textClass: 'text-white', borderClass }
    case 'bonus':
      return {
        label: `${base} + Partnerschaftsbonus`,
        short: work ? `${short} · Bonus` : `Bonus${hours}`,
        tiny: 'Bon',
        color: 'var(--plan-bonus)',
        textClass: 'text-white',
        borderClass,
      }
    default:
      if (month.leave && month.hours === 0) {
        return { label: 'Elternzeit ohne Elterngeld', short: 'EZ', tiny, color: 'var(--plan-leave)', textClass: 'text-foreground', striped: true }
      }
      if (month.leave) {
        return { label: `Elternteilzeit${hours} (ohne Elterngeld)`, short, tiny, color: 'var(--plan-parttime)', textClass: 'text-foreground' }
      }
      return { label: base, short, tiny, color: 'var(--plan-work)', textClass: 'text-muted-foreground', borderClass: 'border border-dashed' }
  }
}

export const LEGEND: { label: string; color: string; striped?: boolean; line?: boolean }[] = [
  { label: 'Mutterschutz', color: 'var(--plan-maternity)' },
  { label: 'Basiselterngeld', color: 'var(--plan-basic)' },
  { label: 'ElterngeldPlus', color: 'var(--plan-plus)' },
  { label: 'Partnerschaftsbonus', color: 'var(--plan-bonus)' },
  { label: 'Elternzeit ohne Elterngeld', color: 'var(--plan-leave)', striped: true },
  { label: 'Elternteilzeit', color: 'var(--plan-parttime)' },
  { label: 'Urlaub', color: 'var(--plan-vacation)', line: true },
  { label: 'Familie/Freunde', color: 'var(--plan-family)' },
  { label: 'Kita', color: 'var(--plan-childcare)' },
]
