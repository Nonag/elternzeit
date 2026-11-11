import { CONTRIBUTION_RATES, yearParameters } from './params'
import type { HealthInsurance, TaxClass } from './types'

/** Income tax per § 32a EStG (basic tariff). 2027/2028 follow the draft Einkommensteuerreformgesetz 2027. */
export function incomeTax(taxableIncome: number, year: number): number {
  const x = Math.floor(Math.max(0, taxableIncome))
  if (year <= 2026) {
    if (x <= 12348) return 0
    if (x <= 17799) {
      const y = (x - 12348) / 10000
      return Math.floor((914.51 * y + 1400) * y)
    }
    if (x <= 69878) {
      const z = (x - 17799) / 10000
      return Math.floor((173.1 * z + 2397) * z + 1034.87)
    }
    if (x <= 277825) return Math.floor(0.42 * x - 11135.63)
    return Math.floor(0.45 * x - 19470.38)
  }
  const is2027 = year === 2027
  const allowance = is2027 ? 12564 : 12900
  if (x <= allowance) return 0
  if (x <= 17799) {
    const y = (x - allowance) / 10000
    return Math.floor(((is2027 ? 952.24 : 1017.55) * y + 1400) * y)
  }
  if (x <= 70600) {
    const z = (x - 17799) / 10000
    return Math.floor((170.74 * z + 2397) * z + (is2027 ? 993.86 : 930.08))
  }
  if (x <= 249999) return Math.floor(0.42 * x - (is2027 ? 11241.73 : 11305.52))
  if (x <= 279999) return Math.floor(0.45 * x - (is2027 ? 18741.7 : 18805.49))
  return Math.floor(0.47 * x - (is2027 ? 24341.68 : 24405.47))
}

function incomeTaxForClass(taxableIncome: number, year: number, taxClass: TaxClass): number {
  return taxClass === 3 ? 2 * incomeTax(taxableIncome / 2, year) : incomeTax(taxableIncome, year)
}

export interface WageTaxAdjustmentInput {
  year: number
  gross: number
  taxClass: TaxClass
  pensionInsured: boolean
  healthInsurance: HealthInsurance
  healthAdditionalRate: number
  privatePremium: number
  privateEmployerSubsidy: number
  childless: boolean
}

/**
 * Monthly wage tax difference between the 2026 tariff (official PAP 2026) and the tariff of `year`.
 * The PAP 2027 is not published yet, so the taxable income is approximated like the PAP does
 * (annual wage minus lump sums and Vorsorgepauschale) and only the tariff change is applied.
 */
export function wageTaxYearAdjustment(input: WageTaxAdjustmentInput): number {
  const { gross, ...rest } = input
  return annualWageTaxAdjustment({ ...rest, annualGross: gross * 12 }) / 12
}

/** Annual variant of `wageTaxYearAdjustment` for an annual wage (also used for sonstige Bezüge). */
export function annualWageTaxAdjustment(input: Omit<WageTaxAdjustmentInput, 'gross'> & { annualGross: number }): number {
  if (input.year <= 2026 || input.annualGross <= 0) return 0
  const base = yearParameters(2026)
  const target = yearParameters(input.year)
  const annual = input.annualGross
  const pensionBase = Math.min(annual, base.pensionCeilingMonthly * 12)
  const healthBase = Math.min(annual, base.healthCeilingMonthly * 12)
  const pension = input.pensionInsured ? pensionBase * 0.093 : 0
  const unemployment = input.pensionInsured ? pensionBase * 0.013 : 0
  const healthCare =
    input.healthInsurance === 'private'
      ? Math.max(0, input.privatePremium - input.privateEmployerSubsidy) * 12
      : healthBase *
        ((CONTRIBUTION_RATES.healthReduced / 2 + input.healthAdditionalRate / 2 + CONTRIBUTION_RATES.careEmployee + (input.childless ? base.careChildlessSurcharge : 0)) /
          100)
  const provision = pension + Math.max(healthCare, Math.min(healthCare + unemployment, 1900))
  const singleParentRelief = input.taxClass === 2 ? 4260 : 0
  const specialLumpSum = input.taxClass === 6 ? 0 : 36
  const taxable = (lumpSum: number) => annual - lumpSum - specialLumpSum - provision - singleParentRelief
  const before = incomeTaxForClass(taxable(base.employeeLumpSum), 2026, input.taxClass)
  const after = incomeTaxForClass(taxable(target.employeeLumpSum), input.year, input.taxClass)
  return Math.max(0, before - after)
}
