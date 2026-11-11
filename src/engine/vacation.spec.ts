import { describe, expect, it } from 'vitest'
import { exampleConfig } from './example'
import { simulate } from './simulate'
import type { PlanPeriod, VariantConfig } from './types'
import { weekdays } from './vacation'

/** Example due date 01.01.2027: life month n is calendar month n of 2027, month 13 is January 2028. */
function vacation(from: number, to: number, vacationDays: number | null = null): PlanPeriod {
  return { id: `vacation-${from}`, from, to, kind: 'vacation', hours: null, vacationDays, allowance: 'none' }
}

function withPlan(patch: (config: VariantConfig) => void): VariantConfig {
  const config = exampleConfig()
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
    const base = simulate(exampleConfig()).months[14].care.need
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
})
