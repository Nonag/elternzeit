import { describe, expect, it } from 'vitest'
import { defaultScenario } from './defaults'
import { computePayroll } from './payroll'
import { generateQuickPlan, paintBlock, PLAN_PRESETS } from './plan'
import { simulate } from './simulate'
import { incomeTax } from './tax'
import type { PlanBlock, ScenarioConfig } from './types'

/** Worked example of the tests: due date and birth on 28.01.2027. */
const exampleScenario = () => ({ ...defaultScenario(), dueDate: '2027-01-28' })

function scenario(patch: (config: ScenarioConfig) => void = () => {}): ScenarioConfig {
  const config = exampleScenario()
  patch(config)
  return config
}

function block(from: number, to: number, patch: Partial<PlanBlock> = {}): PlanBlock {
  return { id: `test-${from}-${to}`, from, to, leave: true, hours: 0, allowance: 'basic', ...patch }
}

describe('plan blocks', () => {
  it('splits existing blocks when painting a new one', () => {
    const blocks = paintBlock([block(1, 12)], block(5, 6, { hours: 30, allowance: 'plus' }))
    expect(blocks.map((b) => [b.from, b.to])).toEqual([
      [1, 4],
      [5, 6],
      [7, 12],
    ])
  })

  it('places the Partnerschaftsbonus of a preset after both full-time leaves', () => {
    const preset = PLAN_PRESETS.find((p) => p.id === 'partnership')!
    const plan = generateQuickPlan(preset.quick, 'married')
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
  it('runs the default scenario without rule violations', () => {
    const result = simulate(scenario())
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(result.months).toHaveLength(36)
    expect(result.entitlement.available).toBe(14)
    expect(result.entitlement.used).toBe(14)
  })

  it('locks the Mutterschutz months as Basis months and offsets Mutterschaftsleistungen per day', () => {
    const result = simulate(scenario())
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
    const result = simulate(scenario((c) => (c.blocks.b = [block(1, 2)])))
    expect(result.issues.some((i) => i.id === 'parallel-basic')).toBe(true)
  })

  it('validates all presets', () => {
    for (const preset of PLAN_PRESETS) {
      const result = simulate(scenario((c) => (c.blocks = generateQuickPlan(preset.quick, 'married'))))
      const errors = result.issues.filter((i) => i.severity === 'error' && i.category === 'allowance')
      expect(errors, preset.id).toEqual([])
    }
  })

  it('reports missing weekly hours instead of guessing them', () => {
    const result = simulate(scenario((c) => (c.blocks.b = [block(13, 14, { hours: null })])))
    expect(result.issues.some((i) => i.severity === 'error' && i.id.startsWith('block-hours-'))).toBe(true)
  })

  it('supports contracts with fractional hours', () => {
    const result = simulate(
      scenario((c) => {
        c.parents.b.weeklyHours = 37.5
        c.blocks.b = [block(13, 16, { hours: 18.75, allowance: 'plus' })]
      }),
    )
    const month = result.months[12].b
    expect(month.hours).toBe(18.75)
    expect(month.grossSalary).toBeCloseTo(result.months[20].b.grossSalary / 2, 1)
  })

  it('pays the expected Kindergeld 2027 and books the birth month in LM 1', () => {
    const result = simulate(scenario())
    expect(result.months[0].childBenefit).toBe(534)
    expect(result.months[1].childBenefit).toBe(267)
    expect(result.months[12].childBenefit).toBe(272)
  })

  it('compares the household income with the net pay before the birth', () => {
    const result = simulate(scenario())
    const before = result.parents.a.realNetBefore + result.parents.b.realNetBefore
    expect(result.months[5].preBirthIncome).toBeCloseTo(before, 1)
    expect(result.months[5].delta).toBeCloseTo(result.months[5].income - before, 1)
  })

  it('charges Cologne Kita fees from the start month', () => {
    const result = simulate(scenario())
    const start = result.childcare.startMonthIndex!
    expect(start).toBe(19)
    expect(result.months[start - 2].childcareFee).toBe(0)
    expect(result.months[start - 1].childcareFee).toBeGreaterThan(70)
  })

  it('computes a reduced Elterngeld with part-time income', () => {
    const result = simulate(scenario((c) => (c.blocks.b = [block(13, 16, { hours: 20, allowance: 'plus' })])))
    const month = result.months[12].b
    expect(month.hours).toBe(20)
    expect(month.netSalary).toBeGreaterThan(0)
    expect(month.parentalAllowance).toBeGreaterThan(150)
    expect(month.parentalAllowance).toBeLessThanOrEqual(result.parents.b.base.plusFull)
  })
})
