import { describe, expect, it } from 'vitest'
import { exampleConfig } from './example'
import { simulate } from './simulate'
import type { PlanPeriod, VariantConfig } from './types'
import { weekdays } from './vacation'

/** Due date 01.01.2027: life month n is calendar month n of 2027, month 13 is January 2028. */
function vacation(from: number, to: number, vacationDays: number | null = null): PlanPeriod {
  return { id: `vacation-${from}`, from, to, kind: 'vacation', hours: null, workDays: null, vacationDays, allowance: 'none' }
}

function withPlan(patch: (config: VariantConfig) => void): VariantConfig {
  const config = { ...exampleConfig(), dueDate: '2027-01-01' }
  patch(config)
  return config
}

describe('vacation', () => {
  it('counts Monday to Friday', () => {
    expect(weekdays('2027-12-01', '2027-12-31')).toBe(23)
    expect(weekdays('2027-12-04', '2027-12-05')).toBe(0)
    expect(weekdays('2027-12-31', '2027-12-01')).toBe(0)
  })

  it('pays the salary during vacation and takes the days from that calendar year', () => {
    const result = simulate(withPlan((c) => c.periods.b.push(vacation(12, 12))))
    const december = result.months[11].b
    expect(december).toMatchObject({ vacation: true, vacationShare: 1, vacationDays: 23, parentalAllowance: 0 })
    expect(december.netSalary).toBe(result.months[10].b.netSalary)
    expect(result.vacation.b.periods['vacation-12']).toEqual({ available: 23, taken: 23 })
    expect(result.vacation.b.years.find((y) => y.year === 2027)).toMatchObject({ planned: 23, remaining: 7 })
  })

  it('closes the care gap in proportion to the vacation days', () => {
    const base = simulate(withPlan(() => {})).months[14].care.need
    const full = simulate(withPlan((c) => c.periods.b.push(vacation(15, 15)))).months[14]
    const partial = simulate(withPlan((c) => c.periods.b.push(vacation(15, 15, 10)))).months[14]
    expect(base).toBeGreaterThan(0)
    expect(full.care.need).toBe(0)
    expect(partial.b.vacationShare).toBeCloseTo(10 / 23, 6)
    expect(partial.care.need).toBeCloseTo(Math.min(partial.a.hours, partial.b.hours * (13 / 23)), 2)
  })

  it('splits a vacation over New Year between both calendar years', () => {
    const result = simulate(withPlan((c) => ((c.dueDate = '2027-01-16'), c.periods.b.push(vacation(12, 12)))))
    const years = result.vacation.b.years
    expect(result.vacation.b.periods['vacation-12']).toEqual({ available: 22, taken: 22 })
    expect(years.find((y) => y.year === 2027)?.planned).toBe(12)
    expect(years.find((y) => y.year === 2028)?.planned).toBe(10)
  })

  it('takes at most the working days and none during Mutterschutz', () => {
    const result = simulate(
      withPlan((c) => {
        c.periods.b.push(vacation(15, 15, 40))
        c.periods.a = [vacation(1, 1), ...c.periods.a.filter((p) => p.from > 1)]
      }),
    )
    expect(result.vacation.b.periods['vacation-15']).toEqual({ available: 23, taken: 23 })
    expect(result.vacation.a.periods['vacation-1']).toEqual({ available: 0, taken: 0 })
  })

  it('prorates the entitlement for months with fewer working days per week', () => {
    const partTime: PlanPeriod = { id: 'tz', from: 7, to: 12, kind: 'work', hours: 24, workDays: 3, vacationDays: null, allowance: 'none' }
    const result = simulate(
      withPlan((c) => {
        c.periods.b.push(partTime)
        c.periods.b[0].workDays = 2
      }),
    )
    const years = result.vacation.b.years
    // January to June at five days, July to December at three days.
    expect(years.find((y) => y.year === 2027)?.annual).toBeCloseTo((30 * (181 + (184 * 3) / 5)) / 365, 2)
    // Days per week do not matter during Elternzeit without work.
    expect(years.find((y) => y.year === 2028)).toMatchObject({ annual: 30, reduction: 5, entitlement: 25 })
  })

  it('warns when a calendar year has more vacation planned than it provides', () => {
    // March and April 2028 have 43 working days; 2028 provides 30 days minus 5 for two months of Elternzeit.
    const result = simulate(withPlan((c) => c.periods.b.push(vacation(15, 16))))
    expect(result.issues.find((i) => i.id === 'vacation-over-b-2028')).toMatchObject({ severity: 'warning', category: 'vacation', months: [15, 16] })
  })

  it('suggests vacation instead of Elternzeit without Elterngeld while enough days are left', () => {
    const unpaid: PlanPeriod = { id: 'ez', from: 12, to: 12, kind: 'leave', hours: 0, workDays: null, vacationDays: null, allowance: 'none' }
    const suggestion = (config: VariantConfig) => simulate(config).issues.find((i) => i.id === 'tip-vacation-instead-leave-b-12')
    const config = withPlan((c) => c.periods.b.push(unpaid))
    expect(suggestion(config)).toMatchObject({ category: 'vacation', months: [12], impact: simulate(config).months[11].b.fullTimeNet })
    // With March 2027 already planned as vacation, only 4.5 days are left for December.
    expect(suggestion(withPlan((c) => c.periods.b.push(unpaid, vacation(3, 3))))).toBeUndefined()
  })
})
