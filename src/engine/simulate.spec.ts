import { describe, expect, it } from 'vitest'
import { exampleConfig } from './example'
import { computePayroll } from './payroll'
import { periodsFromOutline, periodsFromPreset, paintPeriod, PLAN_PRESETS } from './plan'
import { simulate } from './simulate'
import { incomeTax } from './tax'
import type { PlanPeriod, VariantConfig } from './types'

/** Worked example of the tests: due date and birth on 28.01.2027. */
const workedExample = () => ({ ...exampleConfig(), dueDate: '2027-01-28' })

function variant(patch: (config: VariantConfig) => void = () => {}): VariantConfig {
  const config = workedExample()
  patch(config)
  return config
}

function period(from: number, to: number, patch: Partial<PlanPeriod> = {}): PlanPeriod {
  return { id: `test-${from}-${to}`, from, to, kind: 'leave', hours: 0, workDays: null, allowance: 'basic', ...patch }
}

describe('plan periods', () => {
  it('splits existing periods when painting a new one', () => {
    const periods = paintPeriod([period(1, 12)], period(5, 6, { hours: 30, allowance: 'plus' }))
    expect(periods.map((b) => [b.from, b.to])).toEqual([
      [1, 4],
      [5, 6],
      [7, 12],
    ])
  })

  it('places the Partnerschaftsbonus of a first-version outline after both full-time leaves', () => {
    const parent = (start: number, leaveMonths: number) =>
      ({ start, leaveMonths, leaveAllowance: 'basic', partTimeMonths: 0, partTimeHours: 30, partTimeAllowance: 'plus' }) as const
    const plan = periodsFromOutline({ a: parent(1, 10), b: parent(11, 4), bonusMonths: 4, bonusStart: null, bonusHours: 30 }, 'married')
    expect(plan.b.at(-1)).toMatchObject({ from: 15, to: 18, allowance: 'bonus', hours: 30 })
  })
})

describe('income tax tariff', () => {
  it('matches § 32a EStG 2026 and the draft tariffs for 2027/2028', () => {
    expect(incomeTax(32523, 2026)).toBe(4939)
    expect(incomeTax(12348, 2026)).toBe(0)
    expect(incomeTax(12564, 2027)).toBe(0)
    // zones join without jumps
    expect(Math.abs(incomeTax(70600, 2027) - incomeTax(70601, 2027))).toBeLessThanOrEqual(1)
    expect(Math.abs(incomeTax(17799, 2028) - incomeTax(17800, 2028))).toBeLessThanOrEqual(1)
  })

  it('raises the net pay from 2027 by the expected tax reform', () => {
    const input = {
      gross: 4000,
      taxClass: 1 as const,
      churchTax: false,
      churchTaxRate: 0.09,
      childAllowances: 0,
      healthInsurance: 'statutory' as const,
      healthAdditionalRate: 2.9,
      privatePremium: 0,
      pensionInsured: true,
      childless: false,
    }
    const net2026 = computePayroll({ ...input, year: 2026 })
    const net2027 = computePayroll({ ...input, year: 2027 })
    expect(net2026.incomeTax - net2027.incomeTax).toBeGreaterThan(5)
    expect(net2026.incomeTax - net2027.incomeTax).toBeLessThan(25)
  })
})

describe('simulate', () => {
  it('runs the example without rule violations', () => {
    const result = simulate(variant())
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(result.months).toHaveLength(36)
    expect(result.entitlement.available).toBe(14)
    expect(result.entitlement.used).toBe(14)
  })

  it('locks the Mutterschutz months as Basis months and offsets Mutterschaftsleistungen per day', () => {
    const result = simulate(variant())
    const [lm1, lm2, lm3] = result.months
    expect(lm1.a.maternityLocked).toBe(true)
    expect(lm2.a.maternityLocked).toBe(true)
    expect(lm1.a.parentalAllowance).toBe(0)
    // LM 2 (28.02.–27.03.) is covered until 25.03. → 2 of 28 days are paid
    const basic = result.parents.a.base.basicFull
    expect(lm2.a.parentalAllowance).toBeCloseTo((basic * 2) / 28, 1)
    expect(lm3.a.parentalAllowance).toBe(basic)
  })

  it('flags parallel Basiselterngeld when the father takes the first two months', () => {
    const result = simulate(variant((c) => (c.periods.b = [period(1, 2)])))
    expect(result.issues.some((i) => i.id === 'parallel-basic')).toBe(true)
  })

  it('validates all presets', () => {
    for (const preset of PLAN_PRESETS) {
      const result = simulate(
        variant((c) => {
          c.relationship = preset.parents === 'one' ? 'single' : 'married'
          c.periods = periodsFromPreset(preset)
        }),
      )
      const errors = result.issues.filter((i) => i.severity === 'error' && i.category === 'allowance')
      expect(errors, preset.id).toEqual([])
      // Every preset uses the whole entitlement, except the half month the father leaves in "Vater im 1. und 12. Monat".
      expect(result.entitlement.used, preset.id).toBe(preset.id === 'first-and-twelfth' ? 13.5 : result.entitlement.available)
    }
  })

  it('reports missing weekly hours instead of guessing them', () => {
    const result = simulate(variant((c) => (c.periods.b = [period(13, 14, { hours: null })])))
    expect(result.issues.some((i) => i.severity === 'error' && i.id.startsWith('period-hours-'))).toBe(true)
  })

  it('flags more than 8 hours per working day', () => {
    const issue = (hours: number, workDays: number) =>
      simulate(variant((c) => (c.periods.b = [period(13, 14, { kind: 'work', hours, workDays, allowance: 'none' })]))).issues.find(
        (i) => i.id === 'period-day-hours-test-13-14',
      )
    expect(issue(25, 1)).toMatchObject({ severity: 'error', months: [13, 14] })
    expect(issue(30, 3)?.detail).toContain('10 Stunden pro Tag')
    expect(issue(24, 3)).toBeUndefined()
  })

  it('supports contracts with fractional hours', () => {
    const result = simulate(
      variant((c) => {
        c.parents.b.weeklyHours = 37.5
        c.periods.b = [period(13, 16, { hours: 18.75, allowance: 'plus' })]
      }),
    )
    const month = result.months[12].b
    expect(month.hours).toBe(18.75)
    expect(month.grossSalary).toBeCloseTo(result.months[20].b.grossSalary / 2, 1)
  })

  it('pays the expected Kindergeld 2027 and books the birth month in LM 1', () => {
    const result = simulate(variant())
    expect(result.months[0].childBenefit).toBe(534)
    expect(result.months[1].childBenefit).toBe(267)
    expect(result.months[12].childBenefit).toBe(272)
  })

  it('compares the household income with the net pay before the birth', () => {
    const result = simulate(variant())
    const before = result.parents.a.realNetBefore + result.parents.b.realNetBefore
    expect(result.months[5].preBirthIncome).toBeCloseTo(before, 1)
    expect(result.months[5].delta).toBeCloseTo(result.months[5].income - before, 1)
  })

  it('charges Cologne Kita fees from the start month', () => {
    const result = simulate(variant())
    const start = result.childcare.startMonthIndex!
    expect(start).toBe(19)
    expect(result.months[start - 2].childcareFee).toBe(0)
    expect(result.months[start - 1].childcareFee).toBeGreaterThan(70)
  })

  it('computes a reduced Elterngeld with part-time income', () => {
    const result = simulate(variant((c) => (c.periods.b = [period(13, 16, { hours: 20, allowance: 'plus' })])))
    const month = result.months[12].b
    expect(month.hours).toBe(20)
    expect(month.netSalary).toBeGreaterThan(0)
    expect(month.parentalAllowance).toBeGreaterThan(150)
    expect(month.parentalAllowance).toBeLessThanOrEqual(result.parents.b.base.plusFull)
  })
})

describe('care', () => {
  const care = (patch: (config: VariantConfig) => void, month: number) => simulate(variant(patch)).months[month - 1].care
  const work = (hours: number, workDays: number | null) => [period(13, 24, { hours, workDays, allowance: 'none' })]

  it('needs no care when the working days of both parents fit into one week', () => {
    const result = care((c) => {
      c.periods.a = work(24, 3)
      c.periods.b = work(16, 2)
    }, 13)
    expect(result).toMatchObject({ need: 0, gap: 0 })
  })

  it('needs care for the shorter working day on shared days; family and friends cover whole days', () => {
    const result = care((c) => {
      c.periods.a = work(24, null)
      c.periods.b = work(18, 3)
      c.familyCare = [{ id: 'f', label: 'Oma', from: '2028-01-28', to: '2028-12-31', daysPerWeek: 1, hoursPerDay: 8 }]
    }, 14)
    // Three shared days with 4.8 hours each; family and friends cover one of them.
    expect(result).toMatchObject({ need: 14.4, family: 8, familyCovered: 4.8, gap: 9.6 })
  })

  it('spreads the Kita hours over the weekdays, so they only help on shared days', () => {
    const result = care((c) => {
      c.periods.b = work(24, 3)
      c.childcare.hoursPerWeek = 35
    }, 22)
    // Three shared days with 8 hours each; the Kita covers 7 hours of each.
    expect(result).toMatchObject({ need: 24, childcare: 35, childcareCovered: 21, gap: 3 })
  })
})
