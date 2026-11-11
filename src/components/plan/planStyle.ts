import type { ParentMonth } from '@/engine/result'

export interface PlanStyle {
  label: string
  short: string
  color: string
  textClass: string
  striped?: boolean
}

/** Visual category of a parent's month in timeline, table and legend. */
export function monthStyle(month: ParentMonth): PlanStyle {
  if (month.maternityLocked) {
    return { label: 'Mutterschutz (zählt als Basis)', short: 'Mutterschutz', color: 'var(--plan-maternity)', textClass: 'text-white' }
  }
  const hours = month.hours > 0 ? ` ${formatHours(month.hours)} h` : ''
  switch (month.allowance) {
    case 'basic':
      return {
        label: month.hours > 0 ? `Teilzeit${hours} + Basiselterngeld` : 'Elternzeit + Basiselterngeld',
        short: month.hours > 0 ? `TZ${hours} · Basis` : 'EZ · Basis',
        color: 'var(--plan-basic)',
        textClass: 'text-white',
      }
    case 'plus':
      return {
        label: month.hours > 0 ? `Teilzeit${hours} + ElterngeldPlus` : 'Elternzeit + ElterngeldPlus',
        short: month.hours > 0 ? `TZ${hours} · Plus` : 'EZ · Plus',
        color: 'var(--plan-plus)',
        textClass: 'text-white',
      }
    case 'bonus':
      return {
        label: `Teilzeit${hours} + Partnerschaftsbonus`,
        short: `Bonus${hours}`,
        color: 'var(--plan-bonus)',
        textClass: 'text-white',
      }
    default:
      if (month.leave && month.hours === 0) {
        return { label: 'Elternzeit ohne Elterngeld', short: 'EZ', color: 'var(--plan-leave)', textClass: 'text-foreground', striped: true }
      }
      if (month.leave) {
        return { label: `Elternteilzeit${hours} (ohne Elterngeld)`, short: `TZ${hours}`, color: 'var(--plan-parttime)', textClass: 'text-foreground' }
      }
      return { label: `Arbeit${hours}`, short: `Arbeit${hours}`, color: 'var(--plan-work)', textClass: 'text-muted-foreground' }
  }
}

function formatHours(hours: number): string {
  return hours.toLocaleString('de-DE', { maximumFractionDigits: 2 })
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
