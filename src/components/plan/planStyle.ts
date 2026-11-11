import { num } from '@/engine/format'
import type { ParentMonth } from '@/engine/result'

export interface PlanStyle {
  label: string
  short: string
  color: string
  textClass: string
  striped?: boolean
  /** Dashed border for work without Elternzeit; white on coloured months to stay visible in dark mode. */
  borderClass?: string
}

/** Visual category of a parent's month in timeline, table and legend. */
export function monthStyle(month: ParentMonth): PlanStyle {
  if (month.maternityLocked) {
    return { label: 'Mutterschutz (zählt als Basis)', short: 'Mutterschutz', color: 'var(--plan-maternity)', textClass: 'text-white' }
  }
  const hours = month.hours > 0 ? ` ${num(month.hours, 2)} h` : ''
  // Elterngeld does not need Elternzeit; without it the month is work with fewer hours.
  const work = !month.leave
  const base = work ? `Arbeit${hours}` : month.hours > 0 ? `Teilzeit${hours}` : 'Elternzeit'
  const short = work ? `Arbeit${hours}` : month.hours > 0 ? `TZ${hours}` : 'EZ'
  const borderClass = work ? 'border border-dashed border-white/70' : undefined
  switch (month.allowance) {
    case 'basic':
      return { label: `${base} + Basiselterngeld`, short: `${short} · Basis`, color: 'var(--plan-basic)', textClass: 'text-white', borderClass }
    case 'plus':
      return { label: `${base} + ElterngeldPlus`, short: `${short} · Plus`, color: 'var(--plan-plus)', textClass: 'text-white', borderClass }
    case 'bonus':
      return {
        label: `${base} + Partnerschaftsbonus`,
        short: work ? `${short} · Bonus` : `Bonus${hours}`,
        color: 'var(--plan-bonus)',
        textClass: 'text-white',
        borderClass,
      }
    default:
      if (month.leave && month.hours === 0) {
        return { label: 'Elternzeit ohne Elterngeld', short: 'EZ', color: 'var(--plan-leave)', textClass: 'text-foreground', striped: true }
      }
      if (month.leave) {
        return { label: `Elternteilzeit${hours} (ohne Elterngeld)`, short: `TZ${hours}`, color: 'var(--plan-parttime)', textClass: 'text-foreground' }
      }
      return { label: `Arbeit${hours}`, short: `Arbeit${hours}`, color: 'var(--plan-work)', textClass: 'text-muted-foreground', borderClass: 'border border-dashed' }
  }
}

export const LEGEND: { label: string; color: string; striped?: boolean; line?: boolean }[] = [
  { label: 'Mutterschutz', color: 'var(--plan-maternity)' },
  { label: 'Basiselterngeld', color: 'var(--plan-basic)' },
  { label: 'ElterngeldPlus', color: 'var(--plan-plus)' },
  { label: 'Partnerschaftsbonus', color: 'var(--plan-bonus)' },
  { label: 'Elternzeit ohne Elterngeld', color: 'var(--plan-leave)', striped: true },
  { label: 'Teilzeit in Elternzeit', color: 'var(--plan-parttime)' },
  { label: 'Urlaub', color: 'var(--plan-vacation)', line: true },
  { label: 'Familie/Freunde', color: 'var(--plan-family)' },
  { label: 'Kita', color: 'var(--plan-childcare)' },
]
