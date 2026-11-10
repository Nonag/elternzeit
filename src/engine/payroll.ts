import { calculate } from 'lohnsteuerrechner'
import { CONTRIBUTION_RATES, TRANSITION_ZONE_UPPER_LIMIT, yearParameters } from './params'
import { wageTaxYearAdjustment } from './tax'
import type { HealthInsurance, TaxClass } from './types'

export interface PayrollInput {
  year: number
  gross: number
  taxClass: TaxClass
  factor?: number | null
  churchTax: boolean
  churchTaxRate: number
  /** Kinderfreibetragszähler (only affects Soli and church tax). */
  childAllowances: number
  healthInsurance: HealthInsurance
  healthAdditionalRate: number
  privatePremium: number
  pensionInsured: boolean
  childless: boolean
}

export interface PayrollResult {
  gross: number
  incomeTax: number
  solidarity: number
  churchTax: number
  /** Employee health insurance (private: premium minus employer subsidy). */
  health: number
  care: number
  pension: number
  unemployment: number
  net: number
}

/** Wage tax is calculated with the PAP 2026 until the final PAP 2027 is published. */
export const PAP_YEAR = 2026

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function cents(value: number): number {
  return Math.round(value * 100)
}

export interface WageTaxInput {
  gross: number
  taxClass: TaxClass
  factor?: number | null
  church: boolean
  childAllowances: number
  /** KV-Zusatzbeitrag in percent (statutory insurance). */
  additionalHealthRate: number
  privateInsurance: boolean
  privatePremium: number
  privateEmployerSubsidy: number
  pensionInsured: boolean
  childless: boolean
}

export interface WageTaxResult {
  incomeTax: number
  solidarity: number
  /** Base for church tax (the rate is applied by the caller). */
  churchTaxBase: number
}

const wageTaxCache = new Map<string, WageTaxResult>()

/** Monthly wage tax via the official BMF Programmablaufplan. */
export function wageTax(input: WageTaxInput): WageTaxResult {
  const key = JSON.stringify(input)
  const cached = wageTaxCache.get(key)
  if (cached) return cached

  const usesFactor = input.taxClass === 4 && input.factor != null && input.factor > 0 && input.factor < 1
  const result = calculate(PAP_YEAR, {
    LZZ: 2,
    RE4: cents(input.gross),
    STKL: input.taxClass,
    ZKF: input.taxClass <= 4 ? input.childAllowances : 0,
    R: input.church ? 1 : 0,
    KVZ: input.additionalHealthRate,
    PVZ: input.childless ? 1 : 0,
    PVA: 0,
    PKV: input.privateInsurance ? 1 : 0,
    PKPV: input.privateInsurance ? cents(input.privatePremium) : 0,
    PKPVAGZ: input.privateInsurance ? cents(input.privateEmployerSubsidy) : 0,
    KRV: input.pensionInsured ? 0 : 1,
    ALV: input.pensionInsured ? 0 : 1,
    ...(usesFactor ? { af: 1, f: input.factor ?? 1 } : {}),
  })
  const value: WageTaxResult = {
    incomeTax: result.LSTLZZ / 100,
    solidarity: result.SOLZLZZ / 100,
    churchTaxBase: result.BK / 100,
  }
  if (wageTaxCache.size > 5000) wageTaxCache.clear()
  wageTaxCache.set(key, value)
  return value
}

/** Employee contribution base in the Übergangsbereich (Midijob, § 20 Abs. 2a SGB IV). */
export function employeeContributionBase(gross: number, minijobLimit: number): number {
  if (gross <= minijobLimit) return 0
  if (gross >= TRANSITION_ZONE_UPPER_LIMIT) return gross
  return (TRANSITION_ZONE_UPPER_LIMIT / (TRANSITION_ZONE_UPPER_LIMIT - minijobLimit)) * (gross - minijobLimit)
}

/** Maximum employer subsidy for private health and care insurance (§ 257 SGB V, § 61 SGB XI). */
export function maxPrivateEmployerSubsidy(year: number): number {
  const p = yearParameters(year)
  const health = p.healthCeilingMonthly * ((CONTRIBUTION_RATES.healthGeneral / 2 + p.averageAdditionalHealthRate / 2) / 100)
  const care = p.careCeilingMonthly * (CONTRIBUTION_RATES.careEmployee / 100)
  return round2(health + care)
}

const ZERO_RESULT: PayrollResult = {
  gross: 0,
  incomeTax: 0,
  solidarity: 0,
  churchTax: 0,
  health: 0,
  care: 0,
  pension: 0,
  unemployment: 0,
  net: 0,
}

/** Real monthly net pay (gross minus wage tax, Soli, church tax and employee social contributions). */
export function computePayroll(input: PayrollInput): PayrollResult {
  if (input.gross <= 0) return { ...ZERO_RESULT }
  const p = yearParameters(input.year)
  const gross = round2(input.gross)

  if (gross <= p.minijobLimit) {
    // Minijob: flat-rate tax paid by the employer; employee only pays the pension share.
    const pension = input.pensionInsured ? round2(gross * (CONTRIBUTION_RATES.minijobPensionEmployee / 100)) : 0
    return { ...ZERO_RESULT, gross, pension, net: round2(gross - pension) }
  }

  const base = employeeContributionBase(gross, p.minijobLimit)
  const isPrivate = input.healthInsurance === 'private'
  let health = 0
  let care = 0
  let subsidy = 0
  if (isPrivate) {
    subsidy = Math.min(input.privatePremium / 2, maxPrivateEmployerSubsidy(input.year))
    health = round2(input.privatePremium - subsidy)
  } else {
    health = round2(
      Math.min(base, p.healthCeilingMonthly) *
        ((CONTRIBUTION_RATES.healthGeneral / 2 + input.healthAdditionalRate / 2) / 100),
    )
    const careRate = CONTRIBUTION_RATES.careEmployee + (input.childless ? p.careChildlessSurcharge : 0)
    care = round2(Math.min(base, p.careCeilingMonthly) * (careRate / 100))
  }
  const pensionBase = Math.min(base, p.pensionCeilingMonthly)
  const pension = input.pensionInsured ? round2(pensionBase * (CONTRIBUTION_RATES.pension / 2 / 100)) : 0
  const unemployment = input.pensionInsured ? round2(pensionBase * (CONTRIBUTION_RATES.unemployment / 2 / 100)) : 0

  const tax = wageTax({
    gross,
    taxClass: input.taxClass,
    factor: input.factor,
    church: input.churchTax,
    childAllowances: input.childAllowances,
    additionalHealthRate: input.healthAdditionalRate,
    privateInsurance: isPrivate,
    privatePremium: input.privatePremium,
    privateEmployerSubsidy: subsidy,
    pensionInsured: input.pensionInsured,
    childless: input.childless,
  })
  // PAP 2026 plus the tariff change of later years (PAP 2027 is not published yet).
  const adjustment = wageTaxYearAdjustment({
    year: input.year,
    gross,
    taxClass: input.taxClass,
    pensionInsured: input.pensionInsured,
    healthInsurance: input.healthInsurance,
    healthAdditionalRate: input.healthAdditionalRate,
    privatePremium: input.privatePremium,
    privateEmployerSubsidy: subsidy,
    childless: input.childless,
  })
  const incomeTax = round2(Math.max(0, tax.incomeTax - adjustment))
  const churchTax = input.churchTax ? round2(Math.max(0, tax.churchTaxBase - adjustment) * input.churchTaxRate) : 0
  const net = round2(gross - incomeTax - tax.solidarity - churchTax - health - care - pension - unemployment)
  return {
    gross,
    incomeTax,
    solidarity: tax.solidarity,
    churchTax,
    health,
    care,
    pension,
    unemployment,
    net,
  }
}

/** Monthly minimum contribution of a voluntary GKV member without income (KV reduced rate + PV). */
export function voluntaryMinimumContribution(year: number): number {
  const p = yearParameters(year)
  const base = p.referenceValueMonthly / 3
  const rate = CONTRIBUTION_RATES.healthReduced + p.averageAdditionalHealthRate + CONTRIBUTION_RATES.careTotal
  return round2(base * (rate / 100))
}
