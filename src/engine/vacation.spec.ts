import { describe, expect, it } from 'vitest'
import { exampleConfig } from './example'
import { simulate } from './simulate'
import type { ParentKey, PlanPeriod, VariantConfig } from './types'
import { weekdays, weekEnd, weekStart } from './vacation'

/** Due date 01.01.2027: life month n is calendar month n of 2027, month 13 is January 2028. */
function withPlan(patch: (config: VariantConfig) => void, dueDate = '2027-01-01'): VariantConfig {
  const config = { ...exampleConfig(), dueDate }
  patch(config)
  return config
}

function vacation(config: VariantConfig, key: ParentKey, from: string, to: string) {
  config.vacation[key].push({ id: `${key}-${from}`, from, to })
}

const work = (from: number, to: number, hours: number, workDays: number): PlanPeriod => ({
  id: `work-${from}`,
  from,
  to,
  kind: 'work',
  hours,
  workDays,
  allowance: 'none',
})

describe('vacation', () => {
  it('counts weekdays and snaps to whole weeks', () => {
    expect(weekdays('2027-12-01', '2027-12-31')).toBe(23)
    expect(weekdays('2027-12-04', '2027-12-05')).toBe(0)
    expect(weekStart('2027-12-16')).toBe('2027-12-13')
    expect(weekEnd('2027-12-19')).toBe('2027-12-17')
  })

  it('costs the working days of that time: none during Elternzeit without work and Mutterschutz', () => {
    const result = simulate(
      withPlan((c) => {
        c.periods.b.push(work(3, 4, 24, 3))
        vacation(c, 'b', '2027-06-07', '2027-06-11')
        vacation(c, 'b', '2027-03-08', '2027-03-12')
        vacation(c, 'b', '2028-01-10', '2028-01-14')
        vacation(c, 'a', '2027-01-11', '2027-01-15')
      }),
    )
    expect(result.vacation.b.periods['b-2027-06-07']).toEqual({ weeks: 1, days: 5 })
    expect(result.vacation.b.periods['b-2027-03-08']).toEqual({ weeks: 1, days: 3 })
    expect(result.vacation.b.periods['b-2028-01-10']).toEqual({ weeks: 1, days: 0 })
    expect(result.vacation.a.periods['a-2027-01-11']).toEqual({ weeks: 1, days: 0 })
    expect(result.vacation.b.years.find((y) => y.year === 2027)?.planned).toBe(8)
  })

  it('keeps the salary and closes the care gap in proportion to the vacation', () => {
    const before = simulate(withPlan(() => {})).months[14]
    const after = simulate(withPlan((c) => vacation(c, 'b', '2028-03-06', '2028-03-24'))).months[14]
    // March 2028 has 23 weekdays, 15 of them on vacation.
    expect(after.b).toMatchObject({ vacationDays: 15, netSalary: before.b.netSalary, parentalAllowance: 0 })
    expect(after.b.vacationShare).toBeCloseTo(15 / 23, 6)
    expect(after.care.need).toBeCloseTo(Math.min(after.a.hours, after.b.hours * (8 / 23)), 2)
    expect(after.care.need).toBeLessThan(before.care.need)
  })

  it('splits the week around New Year day by day', () => {
    const result = simulate(withPlan((c) => vacation(c, 'b', '2029-12-31', '2030-01-04'), '2027-01-15'))
    const years = result.vacation.b.years
    expect(years.find((y) => y.year === 2029)?.planned).toBe(1)
    expect(years.find((y) => y.year === 2030)?.planned).toBe(4)
  })

  it('prorates the entitlement for months with fewer working days per week', () => {
    const result = simulate(
      withPlan((c) => {
        c.periods.b.push(work(7, 12, 24, 3))
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
    // Six weeks in 2028 cost 30 days; 2028 provides 30 days minus 5 for two months of Elternzeit.
    const result = simulate(withPlan((c) => vacation(c, 'b', '2028-03-06', '2028-04-14')))
    expect(result.issues.find((i) => i.id === 'vacation-over-b-2028')).toMatchObject({ severity: 'warning', category: 'vacation', months: [15, 16] })
  })

  it('suggests vacation instead of Elternzeit without Elterngeld while enough days are left', () => {
    const unpaid: PlanPeriod = { id: 'ez', from: 12, to: 12, kind: 'leave', hours: 0, workDays: null, allowance: 'none' }
    const suggestion = (config: VariantConfig) => simulate(config).issues.find((i) => i.id === 'tip-vacation-instead-leave-b-12')
    const config = withPlan((c) => c.periods.b.push(unpaid))
    expect(suggestion(config)).toMatchObject({ category: 'vacation', months: [12], impact: simulate(config).months[11].b.fullTimeNet })
    // With four weeks already planned in 2027, only 7.5 days are left for December.
    expect(suggestion(withPlan((c) => (c.periods.b.push(unpaid), vacation(c, 'b', '2027-06-07', '2027-07-02'))))).toBeUndefined()
  })
})
