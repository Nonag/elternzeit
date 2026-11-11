import type { VariantConfig } from '@/engine/types'
import type { Variant } from '@/stores/variants'
import { stableStringify } from './json'

/** Sections of the app, so differences can be named the way the user sees them. */
const SECTIONS: { label: (config: VariantConfig) => string; pick: (config: VariantConfig) => unknown }[] = [
  {
    label: () => 'Familie & Termine',
    pick: (c) => [c.relationship, c.dueDate, c.birthDate, c.children, c.extendedMaternity, c.siblingBonus, c.horizonMonths],
  },
  { label: (c) => `${c.parents.a.name || 'Mutter'}: Job & Gehalt`, pick: (c) => [c.parents.a, c.churchTaxRate] },
  { label: (c) => `${c.parents.b.name || 'Vater'}: Job & Gehalt`, pick: (c) => [c.parents.b, c.churchTaxRate] },
  { label: () => 'Plan', pick: (c) => [c.periods, c.vacation] },
  { label: () => 'Kosten & Rücklagen', pick: (c) => [c.fixedCosts, c.childCosts, c.oneTimeCosts, c.balanceAtBirth, c.minReserve] },
  { label: () => 'Kita', pick: (c) => c.childcare },
  { label: () => 'Familie & Freunde', pick: (c) => c.familyCare },
  { label: () => 'Urlaub, Rente & Vermögen', pick: (c) => [c.employerReducesVacation, c.childRaisingCreditTo, c.assumptions] },
  { label: () => 'erledigte Fristen', pick: (c) => c.doneDeadlines },
]

/** Short German list of what differs between the local variants and the ones on the server. */
export function describeDifferences(local: Variant[], remote: Variant[]): string[] {
  const unmatched = [...remote]
  const take = (predicate: (r: Variant) => boolean) => {
    const index = unmatched.findIndex(predicate)
    return index < 0 ? undefined : unmatched.splice(index, 1)[0]
  }
  const pairs = local.map((l) => ({ local: l, remote: take((r) => r.id === l.id) }))
  for (const pair of pairs) pair.remote ??= take((r) => r.name === pair.local.name)

  const lines: string[] = []
  for (const { local: l, remote: r } of pairs) {
    if (!r) {
      lines.push(`„${l.name}“ gibt es nur bei dir`)
      continue
    }
    const sections = SECTIONS.filter((s) => stableStringify(s.pick(l.config)) !== stableStringify(s.pick(r.config))).map((s) =>
      s.label(l.config),
    )
    const renamed = l.name !== r.name
    if (sections.length) lines.push(`„${l.name}“${renamed ? ` (auf dem Server „${r.name}“)` : ''}: ${sections.join(', ')}`)
    else if (renamed) lines.push(`„${l.name}“ heißt auf dem Server „${r.name}“`)
  }
  for (const r of unmatched) lines.push(`„${r.name}“ gibt es nur auf dem Server`)
  return lines
}
