import { describe, expect, it } from 'vitest'
import { exampleConfig } from '@/engine/example'
import type { Variant } from '@/stores/variants'
import { describeDifferences } from './planningDiff'

function variant(id: string, name: string): Variant {
  return { id, name, updatedAt: '2026-11-11T10:00:00Z', config: exampleConfig() }
}

function copy(variant: Variant, patch: Partial<Variant> = {}): Variant {
  return { ...(JSON.parse(JSON.stringify(variant)) as Variant), ...patch }
}

describe('describeDifferences', () => {
  it('names changed sections, renamed and missing variants', () => {
    const a = variant('a', 'Variante A')
    const b = variant('b', 'Teilzeit')
    const local = [copy(a), copy(b), variant('c', 'Nur lokal')]
    local[0].config.parents.a.grossMonthly = 4000
    const remote = [copy(a), copy(b, { name: 'Teilzeit 30 h' }), variant('d', 'Nur Server')]
    remote[0].config.periods.b = []

    expect(describeDifferences(local, remote)).toEqual([
      '„Variante A“: Mutter: Job & Gehalt, Elternzeit & Elterngeld',
      '„Teilzeit“ heißt auf dem Server „Teilzeit 30 h“',
      '„Nur lokal“ gibt es nur bei dir',
      '„Nur Server“ gibt es nur auf dem Server',
    ])
  })

  it('ignores the key order and matches variants by name if the ids differ', () => {
    const local = [variant('x', 'Variante A')]
    const reordered = Object.fromEntries(Object.entries(copy(local[0]).config).reverse()) as Variant['config']
    expect(describeDifferences(local, [{ ...local[0], id: 'y', config: reordered }])).toEqual([])
  })
})
