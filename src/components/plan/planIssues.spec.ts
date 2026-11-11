import { describe, expect, it } from 'vitest'
import { exampleConfig } from '@/engine/example'
import { simulate } from '@/engine/simulate'
import type { VariantConfig } from '@/engine/types'
import { planIssues } from './planIssues'

/** Father: Elternzeit with 1 hour and ElterngeldPlus in month 6–9, then work with 1 hour and Basiselterngeld in month 13–16. */
function fewHours(): VariantConfig {
  const config = exampleConfig()
  config.parents.b.name = 'Vater'
  config.periods.b = [
    { id: 'leave', from: 6, to: 9, kind: 'leave', hours: 1, workDays: null, allowance: 'plus' },
    { id: 'work', from: 13, to: 16, kind: 'work', hours: 1, workDays: null, allowance: 'basic' },
  ]
  return config
}

const ids = (issues: { id: string }[] | undefined) => (issues ?? []).map((i) => i.id)

describe('planIssues', () => {
  it('marks the fields of the periods concerned', () => {
    const config = fewHours()
    const { fields } = planIssues(simulate(config), config)
    expect(ids(fields.get('work:allowance'))).toContain('basic-after-14-b')
    expect(ids(fields.get('work:kind'))).toEqual(['tip-parttime-in-leave-b'])
    expect(ids(fields.get('leave:hours'))).toEqual(['parttime-min-b'])
    expect(fields.get('leave:allowance')).toBeUndefined()
  })

  it('drops the name in front of the title, which is redundant in the rows of a parent', () => {
    const config = fewHours()
    const [issue] = planIssues(simulate(config), config).fields.get('leave:hours') ?? []
    expect(issue.title).toBe('Unter 15 Stunden kein Anspruch auf Teilzeit')
  })

  it('puts plan-wide issues at the counters and care at the timeline lanes', () => {
    const config = fewHours()
    const marks = planIssues(simulate(config), config)
    expect(ids(marks.counters.allowance)).toContain('entitlement')
    expect(ids(marks.counters.bonus)).toEqual(['tip-partnership-bonus'])
    expect(ids(marks.lanes.get('gaps'))).toEqual(['care-gap'])
    expect(ids(marks.lanes.get('childcare'))).toEqual(['settling-in'])
    const all = [...marks.fields.values(), ...marks.counters.allowance, ...marks.counters.leave, ...marks.lanes.values()].flat()
    expect(all.some((issue) => issue.severity === 'success' || issue.category === 'finance')).toBe(false)
  })

  it('marks the vacation weeks of a calendar year with too much vacation', () => {
    const config = exampleConfig()
    config.vacation.b = [
      { id: 'spring', from: '2028-03-20', to: '2028-04-28' },
      { id: 'summer', from: '2027-08-02', to: '2027-08-13' },
    ]
    const { vacation } = planIssues(simulate(config), config)
    expect(ids(vacation.get('spring'))).toEqual(['vacation-over-b-2028'])
    expect(vacation.get('summer')).toBeUndefined()
  })

  it('falls back to the counter when no period lies in the months', () => {
    const config = fewHours()
    const result = simulate(config)
    const stray = { id: 'hours-b', severity: 'error' as const, category: 'allowance' as const, parent: 'b' as const, months: [40], title: 'Vater: zu viele Stunden' }
    const marks = planIssues({ ...result, issues: [stray] }, config)
    expect(marks.counters.allowance).toEqual([stray])
    expect(marks.fields.size).toBe(0)
  })
})
