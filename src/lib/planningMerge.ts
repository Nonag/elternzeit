import type { VariantConfig } from '@/engine/types'
import type { Variant } from '@/stores/variants'
import { stableStringify } from './json'

/**
 * Three-way merge of the variants when saving on top of a newer server state: base is the state both sides last
 * shared, local the variants in this browser, remote the newer server state.
 *
 * Mergeable without asking: new variants, a rename on one side, changes on one side only, the same change on both
 * sides, the order. Conflicts the user decides: both sides changed the same variant (anywhere), both renamed it
 * differently, or one side deleted it.
 */

export type Side = 'local' | 'remote'

interface Section {
  id: string
  /** Top-level fields of the config the section covers. */
  keys: string[]
  label: (config: VariantConfig) => string
  get: (config: VariantConfig) => unknown
  set: (target: VariantConfig, source: VariantConfig) => void
}

/** A section copies whole top-level fields; lists count as a whole. */
function fields(id: string, label: (config: VariantConfig) => string, keys: (keyof VariantConfig)[]): Section {
  return {
    id,
    keys,
    label,
    get: (c) => keys.map((key) => c[key]),
    set: (target, source) => {
      for (const key of keys) (target as unknown as Record<string, unknown>)[key] = clone(source[key])
    },
  }
}

function parent(key: 'a' | 'b', fallback: string): Section {
  return {
    id: `parent-${key}`,
    keys: ['parents'],
    label: (c) => `${c.parents[key].name || fallback}: Job & Gehalt`,
    get: (c) => c.parents[key],
    set: (target, source) => {
      target.parents[key] = clone(source.parents[key])
    },
  }
}

/** The parts of a variant, named like the sections of the app. Together they cover every field. */
const SECTIONS: Section[] = [
  fields('family', () => 'Familie & Termine', ['relationship', 'dueDate', 'birthDate', 'children', 'extendedMaternity', 'siblingBonus', 'horizonMonths']),
  parent('a', 'Mutter'),
  parent('b', 'Vater'),
  fields('church-tax', () => 'Kirchensteuer', ['churchTaxRate']),
  fields('plan', () => 'Elternzeit & Elterngeld', ['periods', 'vacation']),
  fields('costs', () => 'Kosten & Rücklagen', ['fixedCosts', 'childCosts', 'oneTimeCosts', 'balanceAtBirth', 'minReserve']),
  fields('childcare', () => 'Kita', ['childcare']),
  fields('family-care', () => 'Familie & Freunde', ['familyCare']),
  fields('long-term', () => 'Urlaub, Rente & Vermögen', ['employerReducesVacation', 'childRaisingCreditTo', 'assumptions']),
  fields('deadlines', () => 'erledigte Fristen', ['doneDeadlines']),
]

const COVERED = new Set(SECTIONS.flatMap((s) => s.keys))

/** Fields no section names (added later); they are compared and copied as one more section. */
function otherSection(config: VariantConfig): Section {
  return fields('other', () => 'Weitere Angaben', Object.keys(config).filter((key) => !COVERED.has(key)) as (keyof VariantConfig)[])
}

/** Deep copy; works on reactive state too, which structuredClone refuses. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const sectionsFor = (config: VariantConfig) => [...SECTIONS, otherSection(config)]
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b)

/** Name as a choice of its own, when both sides renamed a variant differently. */
export const NAME_SECTION = 'name'
/** The only choice for a variant one side deleted: local or remote state (one of them is "deleted"). */
export const VARIANT_SECTION = 'variant'

export interface MergeSection {
  id: string
  label: string
}

export type MergeConflict =
  | { kind: 'edited'; sections: MergeSection[]; local: Variant; remote: Variant }
  | { kind: 'deleted'; by: Side; kept: Variant }

export interface VariantMerge {
  id: string
  /** The name shown: the local one, or the remote one for variants only the server has. */
  name: string
  /** What is taken over without asking, e.g. "neu auf dem Server" or "geändert auf dem Server: Kita". */
  notes: string[]
  conflict: MergeConflict | null
}

export interface MergePlan {
  variants: VariantMerge[]
  conflicts: number
}

/** Picks per variant id and section id. */
export type Resolution = Record<string, Record<string, Side>>

interface Triple {
  id: string
  base?: Variant
  local?: Variant
  remote?: Variant
}

function triples(base: Variant[], local: Variant[], remote: Variant[]): Triple[] {
  const ids = [...new Set([...local, ...remote, ...base].map((v) => v.id))]
  const find = (list: Variant[], id: string) => list.find((v) => v.id === id)
  return ids.map((id) => ({ id, base: find(base, id), local: find(local, id), remote: find(remote, id) }))
}

function changedSections(from: VariantConfig, to: VariantConfig): Section[] {
  return sectionsFor(to).filter((s) => !same(s.get(from), s.get(to)))
}

const labels = (sections: Section[], config: VariantConfig) => sections.map((s) => s.label(config))

export function planMerge(base: Variant[], local: Variant[], remote: Variant[]): MergePlan {
  const variants: VariantMerge[] = []
  for (const { id, base: b, local: l, remote: r } of triples(base, local, remote)) {
    if (!l && !r) continue
    if (!b || !l || !r) {
      if (l && r) variants.push(editedWithoutBase(id, l, r))
      else if (!b) variants.push({ id, name: (l ?? r)!.name, notes: [l ? 'neu bei dir' : 'neu auf dem Server'], conflict: null })
      else variants.push({ id, name: (l ?? r)!.name, notes: [], conflict: { kind: 'deleted', by: l ? 'remote' : 'local', kept: (l ?? r)! } })
      continue
    }
    const notes: string[] = []
    const sections: MergeSection[] = []
    if (l.name !== b.name && r.name !== b.name && l.name !== r.name) sections.push({ id: NAME_SECTION, label: 'Name' })
    else if (r.name !== b.name && r.name !== l.name) notes.push(`umbenannt auf dem Server in „${r.name}“`)
    else if (l.name !== b.name && l.name !== r.name) notes.push(`umbenannt bei dir, vorher „${b.name}“`)

    const localChanged = !same(l.config, b.config)
    const remoteChanged = !same(r.config, b.config)
    if (localChanged && remoteChanged && !same(l.config, r.config)) {
      for (const s of changedSections(l.config, r.config)) sections.push({ id: s.id, label: s.label(l.config) })
    } else if (remoteChanged && !same(l.config, r.config)) {
      notes.push(`geändert auf dem Server: ${labels(changedSections(b.config, r.config), r.config).join(', ')}`)
    } else if (localChanged && !same(l.config, r.config)) {
      notes.push(`geändert bei dir: ${labels(changedSections(b.config, l.config), l.config).join(', ')}`)
    }
    const conflict: MergeConflict | null = sections.length ? { kind: 'edited', sections, local: l, remote: r } : null
    if (notes.length || conflict) variants.push({ id, name: l.name, notes, conflict })
  }
  return { variants, conflicts: variants.filter((v) => v.conflict).length }
}

/** The same variant on both sides without a shared state: every difference is a conflict. */
function editedWithoutBase(id: string, l: Variant, r: Variant): VariantMerge {
  const sections: MergeSection[] = l.name === r.name ? [] : [{ id: NAME_SECTION, label: 'Name' }]
  for (const s of changedSections(l.config, r.config)) sections.push({ id: s.id, label: s.label(l.config) })
  return { id, name: l.name, notes: [], conflict: sections.length ? { kind: 'edited', sections, local: l, remote: r } : null }
}

/** Whether every conflict of the plan has a pick for each of its choices. */
export function isResolved(plan: MergePlan, resolution: Resolution): boolean {
  return plan.variants.every(({ id, conflict }) => {
    if (!conflict) return true
    const picks = resolution[id] ?? {}
    return conflict.kind === 'deleted' ? !!picks[VARIANT_SECTION] : conflict.sections.every((s) => !!picks[s.id])
  })
}

/** The merged variants: the local order first, then what only the server adds. */
export function applyMerge(base: Variant[], local: Variant[], remote: Variant[], resolution: Resolution): Variant[] {
  const byId = new Map(triples(base, local, remote).map((t) => [t.id, t]))
  const order = [...local.map((v) => v.id), ...remote.map((v) => v.id).filter((id) => !local.some((v) => v.id === id))]
  const result: Variant[] = []
  for (const id of order) {
    const { base: b, local: l, remote: r } = byId.get(id)!
    const picks = resolution[id] ?? {}
    if (!l || !r) {
      // Only one side has it: new there, or deleted on the other side (a conflict unless it was new).
      const kept = (l ?? r)!
      const keep = !b || picks[VARIANT_SECTION] === (l ? 'local' : 'remote')
      if (keep) result.push(clone(kept))
      continue
    }
    result.push(mergeVariant(b, l, r, picks))
  }
  return result
}

function mergeVariant(b: Variant | undefined, l: Variant, r: Variant, picks: Record<string, Side>): Variant {
  const merged = clone(l)
  merged.updatedAt = l.updatedAt > r.updatedAt ? l.updatedAt : r.updatedAt
  const baseName = b?.name
  if (picks[NAME_SECTION]) merged.name = (picks[NAME_SECTION] === 'local' ? l : r).name
  else if (baseName !== undefined && l.name === baseName) merged.name = r.name

  const localChanged = !b || !same(l.config, b.config)
  const remoteChanged = !b || !same(r.config, b.config)
  if (localChanged && remoteChanged) {
    for (const s of changedSections(l.config, r.config)) if (picks[s.id] === 'remote') s.set(merged.config, r.config)
  } else if (remoteChanged) {
    merged.config = clone(r.config)
  }
  return merged
}
