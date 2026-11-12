import { describe, expect, it } from 'vitest'
import { exampleConfig } from '@/engine/example'
import type { Variant } from '@/stores/variants'
import { applyMerge, isResolved, NAME_SECTION, planMerge, VARIANT_SECTION, type Resolution } from './planningMerge'

function variant(id: string, name: string): Variant {
  return { id, name, updatedAt: '2026-11-11T10:00:00Z', config: exampleConfig() }
}

const copy = (list: Variant[]) => structuredClone(list)

/** Shared state with two variants, and a local and remote copy to change. */
function setup() {
  const base = [variant('a', 'Variante A'), variant('b', 'Teilzeit')]
  return { base, local: copy(base), remote: copy(base) }
}

describe('planMerge and applyMerge', () => {
  it('cases 1 and 2: new variants on either side are merged', () => {
    const { base, local, remote } = setup()
    local.push(variant('l', 'Nur bei mir'))
    remote.push(variant('r', 'Nur auf dem Server'))
    const plan = planMerge(base, local, remote)
    expect(plan.conflicts).toBe(0)
    expect(plan.variants.map((v) => [v.name, v.notes])).toEqual([
      ['Nur bei mir', ['neu bei dir']],
      ['Nur auf dem Server', ['neu auf dem Server']],
    ])
    expect(applyMerge(base, local, remote, {}).map((v) => v.id)).toEqual(['a', 'b', 'l', 'r'])
  })

  it('case 3: a rename on one side is merged, also next to content changes on the other side', () => {
    const { base, local, remote } = setup()
    remote[1].name = 'Teilzeit 30 h'
    local[1].config.siblingBonus = true
    const plan = planMerge(base, local, remote)
    expect(plan.conflicts).toBe(0)
    const merged = applyMerge(base, local, remote, {})
    expect(merged[1]).toMatchObject({ name: 'Teilzeit 30 h', config: { siblingBonus: true } })
  })

  it('case 4: two different renames are a conflict about the name', () => {
    const { base, local, remote } = setup()
    local[0].name = 'Plan Mama'
    remote[0].name = 'Plan Papa'
    const plan = planMerge(base, local, remote)
    expect(plan.variants[0].conflict).toMatchObject({ kind: 'edited', sections: [{ id: NAME_SECTION }] })
    expect(applyMerge(base, local, remote, { a: { [NAME_SECTION]: 'remote' } })[0].name).toBe('Plan Papa')
  })

  it('case 5: changes on the server side only are taken over', () => {
    const { base, local, remote } = setup()
    remote[0].config.childcare.enabled = false
    const plan = planMerge(base, local, remote)
    expect(plan.conflicts).toBe(0)
    expect(plan.variants[0].notes).toEqual(['geändert auf dem Server: Kita'])
    expect(applyMerge(base, local, remote, {})[0].config.childcare.enabled).toBe(false)
  })

  it('case 6: changes in different sections of one variant are a conflict, decided per section', () => {
    const { base, local, remote } = setup()
    local[0].config.parents.a.grossMonthly = 4200
    remote[0].config.childcare.enabled = false
    const plan = planMerge(base, local, remote)
    expect(plan.variants[0].conflict).toMatchObject({ kind: 'edited', sections: [{ id: 'parent-a' }, { id: 'childcare' }] })
    const resolution: Resolution = { a: { 'parent-a': 'local' } }
    expect(isResolved(plan, resolution)).toBe(false)
    resolution.a.childcare = 'remote'
    expect(isResolved(plan, resolution)).toBe(true)
    const merged = applyMerge(base, local, remote, resolution)[0].config
    expect([merged.parents.a.grossMonthly, merged.childcare.enabled]).toEqual([4200, false])
  })

  it('case 7: the same change on both sides is not mentioned', () => {
    const { base, local, remote } = setup()
    local[0].config.siblingBonus = true
    remote[0].config.siblingBonus = true
    expect(planMerge(base, local, remote).variants).toEqual([])
  })

  it('case 8: different values in the same place are a conflict', () => {
    const { base, local, remote } = setup()
    local[0].config.parents.a.grossMonthly = 4200
    remote[0].config.parents.a.grossMonthly = 4500
    const plan = planMerge(base, local, remote)
    expect(plan.variants[0].conflict).toMatchObject({ sections: [{ id: 'parent-a', label: 'Mutter: Job & Gehalt' }] })
    expect(applyMerge(base, local, remote, { a: { 'parent-a': 'remote' } })[0].config.parents.a.grossMonthly).toBe(4500)
  })

  it('cases 9 and 10: a variant deleted on one side is a conflict, changed or not', () => {
    const { base, local, remote } = setup()
    remote.splice(1, 1)
    local.splice(0, 1)
    const plan = planMerge(base, local, remote)
    expect(plan.variants.map((v) => v.conflict?.kind === 'deleted' && v.conflict.by)).toEqual(['remote', 'local'])
    // Keep the one the server deleted, delete the one deleted here.
    const merged = applyMerge(base, local, remote, { b: { [VARIANT_SECTION]: 'local' }, a: { [VARIANT_SECTION]: 'local' } })
    expect(merged.map((v) => v.id)).toEqual(['b'])
    expect(applyMerge(base, local, remote, { b: { [VARIANT_SECTION]: 'remote' }, a: { [VARIANT_SECTION]: 'remote' } }).map((v) => v.id)).toEqual(['a'])
  })

  it('case 11: only the order differs, the local one stays', () => {
    const { base, local, remote } = setup()
    remote.reverse()
    expect(planMerge(base, local, remote).variants).toEqual([])
    expect(applyMerge(base, local, remote, {}).map((v) => v.id)).toEqual(['a', 'b'])
  })

  it('case 12: lists count as a whole', () => {
    const { base, local, remote } = setup()
    local[0].config.periods.a[0].hours = 10
    remote[0].config.periods.a.push({ ...remote[0].config.periods.a[0], id: 'new', from: 30, to: 30 })
    const plan = planMerge(base, local, remote)
    expect(plan.variants[0].conflict).toMatchObject({ sections: [{ id: 'plan', label: 'Elternzeit & Elterngeld' }] })
  })
})
