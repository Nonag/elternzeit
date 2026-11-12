import { useEventListener, useManualRefHistory, watchDebounced } from '@vueuse/core'
import { computed, reactive, ref, toRef, watch } from 'vue'
import { todayIso, weekEnd, weekStart } from '@/engine/dates'
import { computeDeadlines } from '@/engine/deadlines'
import { exampleConfig } from '@/engine/example'
import { createId, periodsFromOutline } from '@/engine/plan'
import { simulate } from '@/engine/simulate'
import type { ParentKey, PlanOutline, PlanPeriod, VacationPeriod, VariantConfig } from '@/engine/types'
import { stableStringify } from '@/lib/json'

/** One complete set of inputs including its plan ("Variante"). All variants together form the "Planung". */
export interface Variant {
  id: string
  name: string
  updatedAt: string
  config: VariantConfig
}

/** The planning on the sync server this browser works on (name null = not saved there yet). */
export interface PlanningMeta {
  name: string | null
  version: number | null
  savedAt: string | null
  /** Variants as last loaded from or saved to the server, to detect unsaved changes. */
  snapshot: string | null
}

interface StoreState {
  variants: Variant[]
  currentId: string
  planning: PlanningMeta
}

/** Export file and server format of a planning. Version 1 called the variants "scenarios". */
export interface PlanningData {
  app: 'elternzeit-planer'
  version: 2
  variants: Variant[]
}

const STORAGE_KEY = 'elternzeit-planer:v1'
const HISTORY_KEY = 'elternzeit-planer:history'

/** Undo history of the tab, as JSON snapshots of the variants. */
interface StoredHistory {
  last: string
  undo: string[]
  redo: string[]
}

/** Config fields of older versions and their current names. */
const RENAMED_FIELDS: Record<string, keyof VariantConfig> = {
  blocks: 'periods',
  support: 'familyCare',
  fixedCostsBefore: 'fixedCosts',
  startBalance: 'balanceAtBirth',
  pensionCreditTo: 'childRaisingCreditTo',
}

type StoredConfig = Record<string, unknown> & { planMode?: string; quickPlan?: PlanOutline; relationship?: VariantConfig['relationship'] }

/** The fields of `base`, filled with the stored values; fields that no longer exist are dropped. */
function pick<T extends object>(base: T, stored: unknown): T {
  const merged = { ...base, ...(stored as object | undefined) } as T
  return Object.fromEntries(Object.keys(base).map((key) => [key, merged[key as keyof T]])) as T
}

const PERIOD: PlanPeriod = { id: '', from: 1, to: 1, kind: 'leave', hours: 0, workDays: null, allowance: 'none' }

/** Version 1 had an Elternzeit switch ("leave") instead of the kind of period; unknown kinds are dropped. */
function migratePeriods(stored: unknown[] | undefined): PlanPeriod[] {
  return (stored ?? []).flatMap((item) => {
    const raw = item as Partial<PlanPeriod> & { leave?: boolean; kind?: string }
    const period = pick(PERIOD, raw)
    if (!raw.kind) period.kind = raw.leave === false ? 'work' : 'leave'
    else if (raw.kind !== 'leave' && raw.kind !== 'work') return []
    return [{ ...period, id: period.id || createId('period') }]
  })
}

/** Vacation periods used to end on Friday; they now run to Sunday. */
function migrateVacation(stored: unknown[] | undefined): VacationPeriod[] {
  return (stored ?? []).flatMap((item) => {
    const raw = item as Partial<VacationPeriod> | null
    if (typeof raw?.from !== 'string' || typeof raw.to !== 'string' || !raw.from || !raw.to) return []
    return [{ id: raw.id || createId('vacation'), from: weekStart(raw.from), to: weekEnd(raw.to) }]
  })
}

/** Brings a stored config of any older version into the current shape; missing fields get the example values. */
function migrateConfig(stored: StoredConfig): VariantConfig {
  const base = exampleConfig()
  const raw: Record<string, unknown> = { ...stored }
  for (const [old, name] of Object.entries(RENAMED_FIELDS)) {
    if (old in raw && !(name in raw)) raw[name] = raw[old]
  }
  // The first version generated the plan from key figures ("Eckdaten").
  const periods =
    stored.planMode === 'quick' && stored.quickPlan
      ? periodsFromOutline(stored.quickPlan, stored.relationship ?? 'married')
      : ((raw.periods as Partial<VariantConfig['periods']> | undefined) ?? base.periods)
  const parents = raw.parents as Partial<VariantConfig['parents']> | undefined
  const vacation = raw.vacation as Partial<Record<ParentKey, unknown[]>> | undefined
  return {
    ...pick(base, raw),
    periods: { a: migratePeriods(periods.a), b: migratePeriods(periods.b) },
    vacation: { a: migrateVacation(vacation?.a), b: migrateVacation(vacation?.b) },
    parents: { a: pick(base.parents.a, parents?.a), b: pick(base.parents.b, parents?.b) },
    childcare: pick(base.childcare, raw.childcare),
    assumptions: pick(base.assumptions, raw.assumptions),
  }
}

function migrateVariants(list: unknown[]): Variant[] {
  return list
    .filter((item): item is Partial<Variant> => Boolean((item as Partial<Variant> | null)?.config))
    .map((item) => ({
      id: item.id || createId('variant'),
      name: item.name || 'Variante',
      updatedAt: item.updatedAt || new Date().toISOString(),
      config: migrateConfig(item.config as unknown as StoredConfig),
    }))
}

/** Reads the variants of an export file or a server planning; throws if there are none. */
export function parsePlanning(data: unknown): Variant[] {
  const value = data as { variants?: unknown; scenarios?: unknown } | null
  const list = value?.variants ?? value?.scenarios ?? [value]
  const variants = migrateVariants(Array.isArray(list) ? list : [list])
  if (!variants.length) throw new Error('No variants found')
  return variants
}

function snapshotOf(variants: Variant[]): string {
  return stableStringify(variants.map(({ id, name, config }) => ({ id, name, config })))
}

/** A new variant without example values: relationship, due date and salaries come first. */
export function emptyConfig(): VariantConfig {
  const example = exampleConfig()
  return {
    ...example,
    relationship: null,
    dueDate: '',
    periods: { a: [], b: [] },
    parents: { a: { ...example.parents.a, grossMonthly: 0 }, b: { ...example.parents.b, grossMonthly: 0 } },
    fixedCosts: 0,
    childCosts: [],
    oneTimeCosts: [],
    childcare: { ...example.childcare, enabled: false },
    balanceAtBirth: 0,
    minReserve: 0,
  }
}

/** What has to be entered before anything can be calculated, by the labels of the fields. */
export function missingInputs(config: VariantConfig): string[] {
  const missing: string[] = []
  if (!config.relationship) missing.push('Beziehungsstatus')
  if (!config.dueDate) missing.push('Errechneter Termin')
  const parents: ParentKey[] = config.relationship === 'single' ? ['a'] : ['a', 'b']
  for (const key of parents) {
    if (!(config.parents[key].grossMonthly > 0)) missing.push(`Brutto pro Monat (${config.parents[key].name})`)
  }
  return missing
}

/** Fills what is still missing with placeholders, so the input fields keep working; the results stay hidden. */
function calculable(config: VariantConfig, today: string): VariantConfig {
  return { ...config, relationship: config.relationship ?? 'married', dueDate: config.dueDate || today }
}

function newVariant(name: string, config: VariantConfig = emptyConfig()): Variant {
  return { id: createId('variant'), name, updatedAt: new Date().toISOString(), config }
}

const NO_PLANNING: PlanningMeta = { name: null, version: null, savedAt: null, snapshot: null }

function loadState(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { variants?: unknown[]; scenarios?: unknown[]; currentId?: string; planning?: Partial<PlanningMeta> }
      const variants = migrateVariants(parsed.variants ?? parsed.scenarios ?? [])
      if (variants.length) {
        const currentId = variants.some((v) => v.id === parsed.currentId) ? parsed.currentId! : variants[0].id
        return { variants, currentId, planning: migratePlanning(parsed.planning) }
      }
    }
  } catch {
    // Corrupt storage: start fresh.
  }
  const first = newVariant('Variante A')
  return { variants: [first], currentId: first.id, planning: { ...NO_PLANNING } }
}

/** Rebuilds the saved snapshot in the current format, so migrated data does not show up as unsaved. */
function migratePlanning(stored: Partial<PlanningMeta> | undefined): PlanningMeta {
  const planning = { ...NO_PLANNING, ...stored }
  try {
    if (planning.snapshot) planning.snapshot = snapshotOf(migrateVariants(JSON.parse(planning.snapshot) as unknown[]))
  } catch {
    planning.snapshot = null
  }
  return planning
}

const state = reactive<StoreState>(loadState())

// The browser copy is written shortly after the last change, and at once when the page is left (see below), so a
// reload or closing the tab never loses input.
let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist() {
  clearTimeout(saveTimer)
  saveTimer = undefined
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
watch(
  state,
  () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(persist, 300)
  },
  { deep: true },
)

const current = computed(() => state.variants.find((v) => v.id === state.currentId) ?? state.variants[0])
/** Changes since the planning was last opened or saved on the server. */
const unsaved = computed(() => state.planning.name !== null && state.planning.snapshot !== snapshotOf(state.variants))
const config = computed(() => current.value.config)
const today = todayIso()
const missing = computed(() => missingInputs(config.value))
const result = computed(() => simulate(calculable(config.value, today)))
const deadlines = computed(() => computeDeadlines(calculable(config.value, today), result.value, today))

// Undo and redo over all variants, since the planning was loaded in this tab. Changes in quick succession (typing)
// become one step.
const history = useManualRefHistory(toRef(state, 'variants'), { capacity: 100, dump: JSON.stringify, parse: JSON.parse })
const record = (snapshot: string) => ({ snapshot, timestamp: Date.now() })

/** Takes the changes as a step. Changing something back by hand counts as undo (or redo), not as a new step. */
function commitChanges() {
  const snapshot = JSON.stringify(state.variants)
  const { last, undoStack, redoStack } = history
  if (snapshot === last.value.snapshot) return
  if (undoStack.value[0]?.snapshot === snapshot) {
    redoStack.value.unshift(last.value)
    last.value = undoStack.value.shift()!
  } else if (redoStack.value[0]?.snapshot === snapshot) {
    undoStack.value.unshift(last.value)
    last.value = redoStack.value.shift()!
  } else history.commit()
}
watchDebounced(() => state.variants, commitChanges, { deep: true, debounce: 400 })

// The history lives in the session storage of the tab: it survives a reload, but not closing the tab.
function saveHistory() {
  const { last, undoStack, redoStack } = history
  const stored: StoredHistory = { last: last.value.snapshot, undo: undoStack.value.map((r) => r.snapshot), redo: redoStack.value.map((r) => r.snapshot) }
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(stored))
  } catch {
    // No session storage or not enough room: the history stays in this page only.
  }
}

function restoreHistory() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? 'null') as StoredHistory | null
    if (!stored || stableStringify(JSON.parse(stored.last)) !== stableStringify(state.variants)) return
    history.last.value = record(JSON.stringify(state.variants))
    history.undoStack.value = stored.undo.map(record)
    history.redoStack.value = stored.redo.map(record)
  } catch {
    // Nothing usable stored.
  }
}
restoreHistory()
watchDebounced(() => [history.last.value, history.undoStack.value.length, history.redoStack.value.length], saveHistory, { debounce: 300 })

useEventListener('pagehide', () => {
  commitChanges()
  saveHistory()
  if (saveTimer !== undefined) persist()
})

/** Without undo steps but with changes since the last save, undo goes back to the saved planning. */
const undoRestoresSaved = computed(() => !history.canUndo.value && state.planning.snapshot !== null && unsaved.value)

/** Goes back to the planning as last opened or saved on the server; redo brings the changes back. */
function restoreSaved(): boolean {
  if (!undoRestoresSaved.value || !state.planning.snapshot) return false
  const saved = migrateVariants(JSON.parse(state.planning.snapshot) as unknown[])
  if (!saved.length) return false
  history.redoStack.value.unshift(history.last.value)
  state.variants = saved
  if (!saved.some((v) => v.id === state.currentId)) state.currentId = saved[0].id
  history.last.value = record(JSON.stringify(state.variants))
  return true
}

/** Shows the variant that an undo or redo changed; returns it if that meant switching to another variant. */
function showChanged(before: Variant[]): Variant | null {
  const previousId = state.currentId
  const previous = new Map(before.map((v) => [v.id, JSON.stringify(v)]))
  const changed = state.variants.find((v) => previous.get(v.id) !== JSON.stringify(v))
  if (changed) state.currentId = changed.id
  else if (!state.variants.some((v) => v.id === state.currentId)) state.currentId = state.variants[0].id
  return state.currentId !== previousId ? current.value : null
}

/** Counts loaded plannings, so the results can fade in. */
const loads = ref(0)

function uniqueName(base: string): string {
  const names = new Set(state.variants.map((v) => v.name))
  if (!names.has(base)) return base
  let i = 2
  while (names.has(`${base} (${i})`)) i++
  return `${base} (${i})`
}

/** The variants of this browser and the planning they belong to. */
export function useVariants() {
  return {
    state,
    current,
    unsaved,
    config,
    missing,
    result,
    deadlines,
    today,
    loads,
    canUndo: computed(() => history.canUndo.value || undoRestoresSaved.value),
    canRedo: history.canRedo,
    undoRestoresSaved,
    /** Undo and redo say which variant they switched to, if any; undo also whether it went back to the saved planning. */
    undo(): { switched: Variant | null; saved: boolean } {
      commitChanges()
      const before = state.variants
      if (restoreSaved()) return { switched: null, saved: true }
      history.undo()
      return { switched: showChanged(before), saved: false }
    },
    redo(): { switched: Variant | null } {
      const before = state.variants
      history.redo()
      return { switched: showChanged(before) }
    },
    /** A single variant without any input, as in a new planning. */
    isBlank: computed(() => state.variants.length === 1 && stableStringify(state.variants[0].config) === stableStringify(emptyConfig())),
    select(id: string) {
      state.currentId = id
    },
    create() {
      const variant = newVariant(uniqueName(`Variante ${String.fromCharCode(65 + state.variants.length)}`))
      state.variants.push(variant)
      state.currentId = variant.id
    },
    copy() {
      const variant = newVariant(uniqueName(`${current.value.name} – Kopie`), JSON.parse(JSON.stringify(config.value)))
      state.variants.push(variant)
      state.currentId = variant.id
    },
    rename(name: string) {
      current.value.name = name.trim() || current.value.name
    },
    remove(id: string) {
      if (state.variants.length <= 1) return
      state.variants = state.variants.filter((v) => v.id !== id)
      if (state.currentId === id) state.currentId = state.variants[0].id
    },
    planningData(): PlanningData {
      return { app: 'elternzeit-planer', version: 2, variants: state.variants }
    },
    /** Replaces all variants, e.g. from an export file or the server; undo starts over. */
    replaceVariants(variants: Variant[]) {
      state.variants = variants
      state.currentId = variants[0].id
      history.commit()
      history.clear()
      loads.value++
    },
    /** Starts an empty planning that is not on the server yet. */
    newPlanning() {
      this.replaceVariants([newVariant('Variante A')])
      state.planning = { ...NO_PLANNING }
    },
    snapshot: () => snapshotOf(state.variants),
    /** Detaches the variants from the server planning, e.g. after it was deleted there. */
    forgetPlanning() {
      state.planning = { ...NO_PLANNING }
    },
    /** Remembers the server state of the planning after opening or saving it. */
    markSaved(name: string, version: number, savedAt: string, snapshot = snapshotOf(state.variants)) {
      state.planning = { name, version, savedAt, snapshot }
    },
  }
}
