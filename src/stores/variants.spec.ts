import { describe, expect, it } from 'vitest'
import { exampleConfig } from '@/engine/example'
import { PLAN_PRESETS, periodsFromOutline } from '@/engine/plan'
import type { PlanPeriod } from '@/engine/types'
import { parsePlanning } from './variants'

const withoutIds = (periods: PlanPeriod[]) => periods.map(({ id: _id, ...rest }) => rest)

describe('parsePlanning', () => {
  it('migrates version 1 files with their old field names', () => {
    const period = { id: 'p1', from: 1, to: 12, leave: true, hours: 0, allowance: 'basic' }
    const work = { id: 'p2', from: 13, to: 14, leave: false, hours: 30, allowance: 'none' }
    const removedKind = { id: 'p3', from: 20, to: 20, kind: 'vacation', hours: null, allowance: 'none' }
    const care = { id: 'c1', label: 'Großeltern', from: '2028-01-01', to: '2028-03-31', daysPerWeek: 2, hoursPerDay: 8 }
    const [variant] = parsePlanning({
      app: 'elternzeit-planer',
      version: 1,
      scenarios: [
        {
          id: 's1',
          name: 'Variante A',
          updatedAt: '2026-01-01T00:00:00Z',
          config: {
            version: 1,
            blocks: { a: [period], b: [work, removedKind] },
            vacation: { a: [{ id: 'v1', from: '2027-06-07', to: '2027-06-18' }, { id: 'v2' }, { id: 'v3', from: '', to: '' }] },
            support: [care],
            fixedCostsBefore: 1234,
            startBalance: 5678,
            pensionCreditTo: 'b',
            parents: { a: { name: 'Mama', grossMonthly: 3000, allowanceGross: 2500 } },
            removedField: true,
          },
        },
      ],
    })

    expect(variant).toMatchObject({ id: 's1', name: 'Variante A' })
    const { config } = variant
    expect(config.periods).toEqual({
      a: [{ id: 'p1', from: 1, to: 12, kind: 'leave', hours: 0, workDays: null, allowance: 'basic' }],
      b: [{ id: 'p2', from: 13, to: 14, kind: 'work', hours: 30, workDays: null, allowance: 'none' }],
    })
    expect(config.familyCare).toEqual([care])
    expect(config.vacation).toEqual({ a: [{ id: 'v1', from: '2027-06-07', to: '2027-06-20' }], b: [] })
    expect(config).toMatchObject({ fixedCosts: 1234, balanceAtBirth: 5678, childRaisingCreditTo: 'b' })
    expect(config.parents.a).toMatchObject({ name: 'Mama', grossMonthly: 3000 })
    expect(Object.keys(config).sort()).toEqual(Object.keys(exampleConfig()).sort())
    expect(Object.keys(config.parents.a).sort()).toEqual(Object.keys(exampleConfig().parents.a).sort())
  })

  it('builds the plan of the first version from its outline', () => {
    const outline = PLAN_PRESETS[1].outline
    const [variant] = parsePlanning({ scenarios: [{ config: { planMode: 'quick', quickPlan: outline, blocks: { a: [], b: [] } } }] })
    const expected = periodsFromOutline(outline, 'married')
    expect(withoutIds(variant.config.periods.a)).toEqual(withoutIds(expected.a))
    expect(withoutIds(variant.config.periods.b)).toEqual(withoutIds(expected.b))
  })

  it('fills missing fields with the example values and rejects files without variants', () => {
    const [variant] = parsePlanning({ app: 'elternzeit-planer', version: 2, variants: [{ name: 'Leer', config: {} }] })
    const { periods, ...rest } = variant.config
    const { periods: examplePeriods, ...example } = exampleConfig()
    expect(rest).toEqual(example)
    expect(withoutIds(periods.a)).toEqual(withoutIds(examplePeriods.a))
    expect(() => parsePlanning({ variants: [] })).toThrow()
  })
})
