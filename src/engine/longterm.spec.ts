import { describe, expect, it } from 'vitest'
import { computeDeadlines } from './deadlines'
import { defaultScenario } from './defaults'
import { simulate } from './simulate'
import { fullCalendarMonths } from './vacation'

describe('vacation (§ 17 BEEG)', () => {
  it('counts only full calendar months', () => {
    expect(fullCalendarMonths('2027-03-28', '2027-05-27')).toEqual(['2027-04'])
    expect(fullCalendarMonths('2027-02-01', '2027-03-31')).toEqual(['2027-02', '2027-03'])
  })

  it('reduces the father’s vacation by 1/12 for a two-month leave aligned with life months', () => {
    const result = simulate(defaultScenario())
    const father = result.vacation.b
    expect(father.ranges).toHaveLength(1)
    expect(father.ranges[0]).toMatchObject({ start: '2028-01-28', end: '2028-03-27', lifeMonths: 2, fullCalendarMonths: 1 })
    expect(father.years.find((y) => y.year === 2028)?.reduction).toBe(2.5)
    expect(father.savedByAlignment).toBe(2.5)
  })
})

describe('long-term effects', () => {
  it('credits child-raising periods to the assigned parent', () => {
    const result = simulate(defaultScenario())
    const mother = result.longTerm.pension.a
    // 35 calendar months of the 36 credit months fall into the 36-month horizon (Feb 2027 – Dec 2029).
    expect(mother.pointsChildRaising).toBeGreaterThan(2.8)
    expect(result.longTerm.pension.b.pointsChildRaising).toBe(0)
    const personalLoss = result.parents.a.totals.loss + result.parents.b.totals.loss
    expect(result.longTerm.lostIncome).toBeCloseTo(personalLoss, 0)
  })
})

describe('deadlines', () => {
  it('derives the key dates for a birth on 28.01.2027', () => {
    const config = defaultScenario()
    config.blocks.b = [{ id: 'b1', from: 1, to: 2, leave: true, hours: 0, allowance: 'plus' }]
    const result = simulate(config)
    const deadlines = computeDeadlines(config, result, '2026-11-09')
    const byId = Object.fromEntries(deadlines.map((d) => [d.id, d]))
    expect(byId['event-maternity-start'].date).toBe('2026-12-17')
    expect(byId['tax-class-allowance'].date).toBe('2026-05-31')
    expect(byId['tax-class-allowance'].status).toBe('missed')
    expect(byId['leave-b-1'].date).toBe('2026-12-10')
    expect(byId['leave-a-3'].date).toBe('2027-02-05')
    expect(byId['allowance-application'].date).toBe('2027-05-27')
    expect(byId['child-benefit'].date).toBe('2027-07-31')
  })
})
