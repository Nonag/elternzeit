import { describe, expect, it } from 'vitest'
import { computeMaternityPeriod, maternityBenefitRate } from './maternity'
import {
  basicWithIncome,
  computeAllowanceBase,
  computeAllowanceNet,
  plusWithIncome,
  replacementRate,
} from './parentalAllowance'
import { computePayroll } from './payroll'

const noSupplements = { siblingBonus: false, additionalChildren: 0 }

describe('Elterngeld-Netto', () => {
  it('matches the reference example (3,500 € gross, class IV, church tax, birth 2027)', () => {
    const result = computeAllowanceNet({
      gross: 3500,
      taxClass: 4,
      churchTax: true,
      statutoryHealthCompulsory: true,
      pensionInsured: true,
    })
    expect(result.net).toBeCloseTo(2217.99, 2)
    expect(result.social).toBeCloseTo(735, 2)
  })

  it('skips the 9 % health deduction for voluntary or private insurance', () => {
    const compulsory = computeAllowanceNet({ gross: 3000, taxClass: 1, churchTax: false, statutoryHealthCompulsory: true, pensionInsured: true })
    const voluntary = computeAllowanceNet({ gross: 3000, taxClass: 1, churchTax: false, statutoryHealthCompulsory: false, pensionInsured: true })
    expect(voluntary.net - compulsory.net).toBeCloseTo(270, 0)
  })
})

describe('replacement rate', () => {
  it('follows § 2 Abs. 2 BEEG', () => {
    expect(replacementRate(340)).toBe(1)
    expect(replacementRate(998)).toBe(0.671)
    expect(replacementRate(1100)).toBe(0.67)
    expect(replacementRate(1220)).toBe(0.66)
    expect(replacementRate(1240)).toBe(0.65)
    expect(replacementRate(3000)).toBe(0.65)
  })
})

describe('allowance amounts', () => {
  it('caps Basiselterngeld at 1,800 € and ElterngeldPlus at half of it', () => {
    const base = computeAllowanceBase(3200, noSupplements)
    expect(base.basicFull).toBe(1800)
    expect(base.plusFull).toBe(900)
  })

  it('pays the minimum of 300 € without income', () => {
    expect(computeAllowanceBase(0, noSupplements).basicFull).toBe(300)
    expect(computeAllowanceBase(0, noSupplements).plusFull).toBe(150)
  })

  it('caps pre-birth income at 2,770 € when there is income after birth', () => {
    const base = computeAllowanceBase(3200, noSupplements)
    // 65 % × (2,770 − 1,500) = 825.50
    expect(basicWithIncome(base, 1500, noSupplements)).toBeCloseTo(825.5, 2)
    // ElterngeldPlus with the same income is not capped (825.50 < 900)
    expect(plusWithIncome(base, 1500, noSupplements)).toBeCloseTo(825.5, 2)
    // with little income the cap of half the Basiselterngeld applies
    expect(plusWithIncome(base, 500, noSupplements)).toBe(900)
  })

  it('adds the Geschwisterbonus with its minimum', () => {
    const base = computeAllowanceBase(600, { siblingBonus: true, additionalChildren: 0 })
    // rate 67 % + 200 × 0.1 pp = 87 % → 522 €, bonus max(52.20, 75) = 75
    expect(base.basicFull).toBe(597)
  })
})

describe('Mutterschutz', () => {
  it('computes the protection period around the due date', () => {
    const period = computeMaternityPeriod('2027-01-28', '2027-01-28', false)
    expect(period.start).toBe('2026-12-17')
    expect(period.end).toBe('2027-03-25')
    expect(period.daysBeforeBirth).toBe(42)
  })

  it('adds days lost before an early birth', () => {
    const period = computeMaternityPeriod('2027-01-28', '2027-01-18', false)
    expect(period.daysAfterBirth).toBe(66)
  })

  it('splits the daily benefit into Mutterschaftsgeld and employer top-up', () => {
    const rate = maternityBenefitRate(2400, 'statutory')
    expect(rate.statutoryDaily).toBe(13)
    expect(rate.totalDaily).toBe(80)
    expect(maternityBenefitRate(2400, 'private').totalDaily).toBe(67)
  })
})

describe('payroll', () => {
  it('computes a plausible net salary for class I', () => {
    const result = computePayroll({
      year: 2026,
      gross: 4000,
      taxClass: 1,
      churchTax: false,
      churchTaxRate: 0.09,
      childAllowances: 0,
      healthInsurance: 'statutory',
      healthAdditionalRate: 2.9,
      privatePremium: 0,
      pensionInsured: true,
      childless: true,
    })
    expect(result.pension).toBeCloseTo(372, 2)
    expect(result.health).toBeCloseTo(350, 2)
    expect(result.care).toBeCloseTo(96, 2)
    expect(result.unemployment).toBeCloseTo(52, 2)
    expect(result.net).toBeGreaterThan(2500)
    expect(result.net).toBeLessThan(2700)
  })

  it('reduces employee contributions in the Übergangsbereich', () => {
    const midijob = computePayroll({
      year: 2026,
      gross: 1200,
      taxClass: 1,
      churchTax: false,
      churchTaxRate: 0.09,
      childAllowances: 0,
      healthInsurance: 'statutory',
      healthAdditionalRate: 2.9,
      privatePremium: 0,
      pensionInsured: true,
      childless: false,
    })
    expect(midijob.pension).toBeLessThan(1200 * 0.093)
  })
})
