import { describe, expect, it } from 'vitest'
import { exampleConfig } from './example'
import { simulate } from './simulate'
import type { OneTimePayment, ParentKey, VariantConfig } from './types'

/** Worked example of the tests: due date and birth on 28.01.2027. */
const workedExample = () => ({ ...exampleConfig(), dueDate: '2027-01-28' })

function withPayments(key: ParentKey, payments: Omit<OneTimePayment, 'id' | 'label'>[], patch: (config: VariantConfig) => void = () => {}) {
  const config = workedExample()
  config.parents[key].oneTimePayments = payments.map((p, i) => ({ id: `p${i + 1}`, label: 'Bonus', ...p }))
  patch(config)
  return simulate(config)
}

describe('one-time payments', () => {
  it('pays a bonus during Elternzeit without deductions and leaves Elterngeld unchanged', () => {
    const base = simulate(workedExample())
    const result = withPayments('a', [{ gross: 3000, month: '2027-05' }])
    const [payment] = result.oneTimePayments
    expect(payment).toMatchObject({ lifeMonth: 4, tax: 0, contributions: 0, net: 3000, contributionYear: 2027, betterMonth: null })
    expect(result.months[3].a.oneTimePayments).toBe(3000)
    expect(result.months[3].a.total).toBeCloseTo(base.months[3].a.total + 3000, 2)
    expect(result.totals.parentalAllowance).toBe(base.totals.parentalAllowance)
  })

  it('counts a payout from January to March for the previous year (März-Klausel)', () => {
    const result = withPayments('a', [{ gross: 3000, month: '2027-03' }])
    const [payment] = result.oneTimePayments
    // 2027 has no salary yet, so the payout belongs to 2026: 8.75 % KV, 1.8 % PV, 9.3 % RV, 1.3 % AV
    expect(payment.contributionYear).toBe(2026)
    expect(payment.contributions).toBe(634.5)
    expect(payment.betterMonth).toEqual({ month: '2027-04', saving: 634.5 })
    expect(result.issues.find((i) => i.id === 'tip-one-time-month-p1')?.impact).toBe(634.5)
  })

  it('charges contributions and wage tax while working', () => {
    const [payment] = withPayments('b', [{ gross: 3000, month: '2027-06' }]).oneTimePayments
    expect(payment.contributionYear).toBe(2027)
    expect(payment.contributions).toBe(634.5)
    expect(payment.tax).toBeGreaterThan(500)
    expect(payment.betterMonth).toBeNull()
  })

  it('shares the pro-rata contribution ceiling between payouts of the same year', () => {
    const result = withPayments('b', [
      { gross: 2000, month: '2027-06' },
      { gross: 2000, month: '2027-06' },
    ], (c) => (c.parents.b.grossMonthly = 6000))
    const [first, second] = result.oneTimePayments
    // Six months with 375 € below the KV ceiling of 6.375 € leave room for 2.250 € in KV and PV.
    expect(first.contributions).toBeCloseTo(2000 * 0.2115, 2)
    expect(second.contributions).toBeCloseTo(250 * 0.1055 + 2000 * 0.106, 1)
  })

  it('estimates the tax return effect of a bonus in the Elternzeit year', () => {
    const result = withPayments('a', [{ gross: 3000, month: '2027-05' }])
    const [payment] = result.oneTimePayments
    expect(payment.taxReturnEffect).toBeGreaterThan(300)
    expect(payment.taxReturnEffect).toBeLessThan(800)
    expect(result.issues.find((i) => i.id === 'tip-one-time-tax-p1')?.impact).toBeLessThan(0)
  })

  it('adds a payout before the birth to the starting balance', () => {
    const base = simulate(workedExample())
    const result = withPayments('a', [{ gross: 1000, month: '2026-11' }])
    const [payment] = result.oneTimePayments
    expect(payment.lifeMonth).toBe(0)
    expect(payment.contributions).toBeGreaterThan(0)
    expect(result.totals.initialBalance).toBeCloseTo(base.totals.initialBalance + payment.net, 2)
  })

  it('counts the gross amount for the Cologne Kita fee in the year of the payout', () => {
    const base = simulate(workedExample())
    const result = withPayments('a', [{ gross: 20000, month: '2028-09' }])
    expect(result.childcare.annualIncomeByYear[2028] - base.childcare.annualIncomeByYear[2028]).toBe(20000)
  })
})
