import { PARENTAL_ALLOWANCE as PA, TRANSITION_ZONE_UPPER_LIMIT } from './params'
import { round2 } from './math'
import { wageTax } from './payroll'
import type { TaxClass } from './types'

export interface AllowanceNetInput {
  gross: number
  taxClass: TaxClass
  factor?: number | null
  churchTax: boolean
  /** 9 % flat KV/PV deduction only for compulsorily insured GKV members. */
  statutoryHealthCompulsory: boolean
  /** 10 % RV + 2 % AV flat deductions. */
  pensionInsured: boolean
}

export interface AllowanceNetResult {
  gross: number
  lumpSum: number
  incomeTax: number
  solidarity: number
  churchTax: number
  social: number
  net: number
}

/**
 * "Elterngeld-Netto" (§§ 2c, 2e, 2f BEEG): flat-rate deductions using the PAP of the year before birth,
 * 8 % church tax, flat social contributions (9/10/2 %) without contribution ceilings and 1/12 of the
 * Arbeitnehmer-Pauschbetrag.
 */
export function computeAllowanceNet(input: AllowanceNetInput): AllowanceNetResult {
  const gross = round2(Math.max(0, input.gross))
  if (gross <= 0) return { gross: 0, lumpSum: 0, incomeTax: 0, solidarity: 0, churchTax: 0, social: 0, net: 0 }
  const lumpSum = Math.min(gross, PA.monthlyLumpSum)

  if (gross <= PA.minijobLimit) {
    return { gross, lumpSum, incomeTax: 0, solidarity: 0, churchTax: 0, social: 0, net: round2(gross - lumpSum) }
  }

  const tax = wageTax({
    gross,
    taxClass: input.taxClass,
    factor: input.factor,
    church: input.churchTax,
    childAllowances: 0,
    additionalHealthRate: PA.averageAdditionalHealthRate,
    privateInsurance: false,
    privatePremium: 0,
    privateEmployerSubsidy: 0,
    pensionInsured: input.pensionInsured,
    childless: false,
  })
  const churchTax = input.churchTax ? round2(tax.churchTaxBase * PA.churchTaxRate) : 0

  const socialBase = gross < TRANSITION_ZONE_UPPER_LIMIT ? transitionZoneBase(gross) : gross
  const socialRate =
    (input.statutoryHealthCompulsory ? PA.flatHealthRate : 0) +
    (input.pensionInsured ? PA.flatPensionRate + PA.flatUnemploymentRate : 0)
  const social = round2(socialBase * socialRate)

  const net = round2(Math.max(0, gross - lumpSum - tax.incomeTax - tax.solidarity - churchTax - social))
  return { gross, lumpSum, incomeTax: tax.incomeTax, solidarity: tax.solidarity, churchTax, social, net }
}

/** Übergangszonenentgelt with the Elterngeld-specific factor F. */
function transitionZoneBase(gross: number): number {
  const lower = PA.minijobLimit
  const upper = TRANSITION_ZONE_UPPER_LIMIT
  const f = PA.transitionFactor
  return round2(f * lower + (upper / (upper - lower) - (lower / (upper - lower)) * f) * (gross - lower))
}

/** Replacement rate (§ 2 Abs. 2 BEEG), always based on the pre-birth Elterngeld-Netto. */
export function replacementRate(netBefore: number): number {
  let perMille: number
  if (netBefore < 1000) {
    perMille = 670 + Math.floor((1000 - netBefore) / 2)
    perMille = Math.min(1000, perMille)
  } else if (netBefore <= 1200) {
    perMille = 670
  } else {
    perMille = Math.max(650, 670 - Math.floor((netBefore - 1200) / 2))
  }
  return perMille / 1000
}

export interface AllowanceSupplements {
  siblingBonus: boolean
  /** Number of additional children in a multiple birth. */
  additionalChildren: number
}

export interface AllowanceBase {
  netBefore: number
  rate: number
  /** Basiselterngeld per month without income after birth (incl. supplements). */
  basicFull: number
  /** ElterngeldPlus per month without income after birth (incl. supplements). */
  plusFull: number
  /** Basiselterngeld without supplements (cap for ElterngeldPlus). */
  basicCore: number
}

function applySupplements(amount: number, plus: boolean, supplements: AllowanceSupplements): number {
  const factor = plus ? 0.5 : 1
  let total = amount
  if (supplements.siblingBonus) total += Math.max(amount * PA.siblingBonusRate, PA.siblingBonusMin * factor)
  total += supplements.additionalChildren * PA.multipleBirthSupplement * factor
  return round2(total)
}

export function computeAllowanceBase(netBefore: number, supplements: AllowanceSupplements): AllowanceBase {
  const rate = replacementRate(netBefore)
  const basicCore = round2(Math.min(PA.maxBasic, Math.max(PA.minBasic, rate * netBefore)))
  const plusCore = round2(Math.max(PA.minPlus, basicCore / 2))
  return {
    netBefore,
    rate,
    basicCore,
    basicFull: applySupplements(basicCore, false, supplements),
    plusFull: applySupplements(plusCore, true, supplements),
  }
}

/** Basiselterngeld per month when the parent has (averaged) income after birth. */
export function basicWithIncome(base: AllowanceBase, averageNetAfter: number, supplements: AllowanceSupplements): number {
  const difference = Math.max(0, Math.min(base.netBefore, PA.incomeCapForDifference) - averageNetAfter)
  const core = round2(Math.min(PA.maxBasic, Math.max(PA.minBasic, base.rate * difference)))
  return applySupplements(core, false, supplements)
}

/** ElterngeldPlus per month with income: capped at half of the Basiselterngeld without income. */
export function plusWithIncome(base: AllowanceBase, averageNetAfter: number, supplements: AllowanceSupplements): number {
  const difference = Math.max(0, Math.min(base.netBefore, PA.incomeCapForDifference) - averageNetAfter)
  const core = round2(Math.max(PA.minPlus, Math.min(base.rate * difference, base.basicCore / 2)))
  return applySupplements(core, true, supplements)
}
