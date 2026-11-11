import { addDays, diffDays, type IsoDate } from './dates'
import { MATERNITY } from './params'
import { round2 } from './math'
import type { HealthInsurance } from './types'

export interface MaternityPeriod {
  /** First day of protection before birth (equals birth date if the birth came before it). */
  start: IsoDate
  birth: IsoDate
  /** Last day of protection after birth. */
  end: IsoDate
  daysBeforeBirth: number
  /** Days after the birth day (the birth day itself is covered as well). */
  daysAfterBirth: number
  weeksAfter: number
}

/**
 * Mutterschutz (§ 3 MuSchG): 6 weeks before the due date, 8 (12) weeks after birth.
 * If the child is born early, the days lost before birth are added after birth.
 */
export function computeMaternityPeriod(dueDate: IsoDate, birth: IsoDate, extended: boolean): MaternityPeriod {
  const regularStart = addDays(dueDate, -MATERNITY.weeksBefore * 7)
  const start = birth < regularStart ? birth : regularStart
  const daysBeforeBirth = diffDays(start, birth)
  const shortfall = Math.max(0, MATERNITY.weeksBefore * 7 - daysBeforeBirth)
  const weeksAfter = extended ? MATERNITY.weeksAfterExtended : MATERNITY.weeksAfter
  const daysAfterBirth = weeksAfter * 7 + shortfall
  return { start, birth, end: addDays(birth, daysAfterBirth), daysBeforeBirth, daysAfterBirth, weeksAfter }
}

export interface MaternityBenefitRate {
  /** Mutterschaftsgeld from the health insurance per calendar day. */
  statutoryDaily: number
  /** Arbeitgeberzuschuss per calendar day. */
  employerDaily: number
  totalDaily: number
  /** One-off payment by the Bundesamt für Soziale Sicherung (privately insured). */
  oneOff: number
}

/** Mutterschaftsgeld + Arbeitgeberzuschuss based on the average net pay of the last three months. */
export function maternityBenefitRate(netMonthly: number, insurance: HealthInsurance): MaternityBenefitRate {
  const dailyNet = (netMonthly * 3) / 90
  const statutoryInsured = insurance !== 'private'
  const statutoryDaily = statutoryInsured ? Math.min(MATERNITY.statutoryDailyMax, dailyNet) : 0
  const employerDaily = Math.max(0, dailyNet - MATERNITY.statutoryDailyMax)
  return {
    statutoryDaily: round2(statutoryDaily),
    employerDaily: round2(employerDaily),
    totalDaily: round2(statutoryDaily + employerDaily),
    oneOff: statutoryInsured ? 0 : MATERNITY.privateLumpSum,
  }
}
