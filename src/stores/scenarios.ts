import { computed, reactive, watch } from 'vue'
import { todayIso } from '@/engine/dates'
import { computeDeadlines } from '@/engine/deadlines'
import { defaultParent, defaultScenario } from '@/engine/defaults'
import { createId, generateQuickPlan } from '@/engine/plan'
import { simulate } from '@/engine/simulate'
import type { QuickPlan, ScenarioConfig } from '@/engine/types'
import { stableStringify } from '@/lib/json'

/** One complete set of inputs, shown as "Variante" in the UI. All variants together form the "Planung". */
export interface StoredScenario {
  id: string
  name: string
  updatedAt: string
  config: ScenarioConfig
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
  scenarios: StoredScenario[]
  currentId: string
  planning: PlanningMeta
}

/** Export file and server format of a planning. */
export interface PlanningData {
  app: 'elternzeit-planer'
  version: 1
  scenarios: StoredScenario[]
}

const STORAGE_KEY = 'elternzeit-planer:v1'

type StoredConfig = Partial<ScenarioConfig> & { planMode?: string; quickPlan?: QuickPlan }

/** Fills fields that are missing in older stored scenarios with defaults. */
export function migrateConfig(raw: StoredConfig): ScenarioConfig {
  const base = defaultScenario()
  const { planMode, quickPlan, ...rest } = raw
  // Older versions could generate the plan from key figures ("Eckdaten").
  const blocks =
    planMode === 'quick' && quickPlan ? generateQuickPlan(quickPlan, raw.relationship ?? 'married') : (raw.blocks ?? base.blocks)
  return {
    ...base,
    ...rest,
    blocks: { a: blocks.a ?? [], b: blocks.b ?? [] },
    parents: {
      // The separate average gross of the year before birth is no longer offered in the UI.
      a: { ...defaultParent('Mutter', 0), ...base.parents.a, ...raw.parents?.a, allowanceGross: null },
      b: { ...defaultParent('Vater', 0), ...base.parents.b, ...raw.parents?.b, allowanceGross: null },
    },
    childcare: { ...base.childcare, ...raw.childcare },
    assumptions: { ...base.assumptions, ...raw.assumptions },
    doneDeadlines: raw.doneDeadlines ?? [],
    childCosts: raw.childCosts ?? base.childCosts,
    oneTimeCosts: raw.oneTimeCosts ?? base.oneTimeCosts,
    support: raw.support ?? base.support,
    version: 1,
  }
}

function newScenario(name: string, config: ScenarioConfig = defaultScenario()): StoredScenario {
  return { id: createId('scenario'), name, updatedAt: new Date().toISOString(), config }
}

const NO_PLANNING: PlanningMeta = { name: null, version: null, savedAt: null, snapshot: null }

function loadState(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreState>
      if (Array.isArray(parsed.scenarios) && parsed.scenarios.length) {
        const scenarios = parsed.scenarios.map((s) => ({ ...s, config: migrateConfig(s.config as StoredConfig) }))
        const currentId = scenarios.some((s) => s.id === parsed.currentId) ? parsed.currentId! : scenarios[0].id
        return { scenarios, currentId, planning: { ...NO_PLANNING, ...parsed.planning } }
      }
    }
  } catch {
    // Corrupt storage: start fresh.
  }
  const first = newScenario('Variante A')
  return { scenarios: [first], currentId: first.id, planning: { ...NO_PLANNING } }
}

/** Reads the variants of an export file or server planning; throws if there are none. */
export function parsePlanning(data: unknown): StoredScenario[] {
  const value = data as { scenarios?: StoredScenario[] } | StoredScenario | null
  const list = value && 'scenarios' in value && Array.isArray(value.scenarios) ? value.scenarios : [value as StoredScenario]
  const scenarios = list
    .filter((item) => item?.config)
    .map((item) => ({
      id: item.id || createId('scenario'),
      name: item.name || 'Variante',
      updatedAt: item.updatedAt || new Date().toISOString(),
      config: migrateConfig(item.config as StoredConfig),
    }))
  if (!scenarios.length) throw new Error('No variants found')
  return scenarios
}

function snapshotOf(scenarios: StoredScenario[]): string {
  return stableStringify(scenarios.map(({ id, name, config }) => ({ id, name, config })))
}

const state = reactive<StoreState>(loadState())

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(
  state,
  () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), 300)
  },
  { deep: true },
)

const current = computed(() => state.scenarios.find((s) => s.id === state.currentId) ?? state.scenarios[0])
const dirty = computed(() => state.planning.name !== null && state.planning.snapshot !== snapshotOf(state.scenarios))
const config = computed(() => current.value.config)
const result = computed(() => simulate(config.value))
const today = todayIso()
const deadlines = computed(() => computeDeadlines(config.value, result.value, today))

function uniqueName(base: string): string {
  const names = new Set(state.scenarios.map((s) => s.name))
  if (!names.has(base)) return base
  let i = 2
  while (names.has(`${base} (${i})`)) i++
  return `${base} (${i})`
}

export function useScenarios() {
  return {
    state,
    current,
    dirty,
    config,
    result,
    deadlines,
    today,
    select(id: string) {
      state.currentId = id
    },
    create() {
      const scenario = newScenario(uniqueName(`Variante ${String.fromCharCode(65 + state.scenarios.length)}`))
      state.scenarios.push(scenario)
      state.currentId = scenario.id
    },
    duplicate() {
      const copy = newScenario(uniqueName(`${current.value.name} – Kopie`), JSON.parse(JSON.stringify(config.value)))
      state.scenarios.push(copy)
      state.currentId = copy.id
    },
    rename(name: string) {
      current.value.name = name.trim() || current.value.name
    },
    remove(id: string) {
      if (state.scenarios.length <= 1) return
      state.scenarios = state.scenarios.filter((s) => s.id !== id)
      if (state.currentId === id) state.currentId = state.scenarios[0].id
    },
    resetCurrent() {
      current.value.config = defaultScenario()
    },
    planningData(): PlanningData {
      return { app: 'elternzeit-planer', version: 1, scenarios: state.scenarios }
    },
    /** Replaces all variants, e.g. from an export file or the server. */
    replaceScenarios(scenarios: StoredScenario[]) {
      state.scenarios = scenarios
      state.currentId = scenarios[0].id
    },
    snapshot: () => snapshotOf(state.scenarios),
    /** Remembers the server state of the planning after opening or saving it. */
    markSaved(name: string, version: number, savedAt: string, snapshot = snapshotOf(state.scenarios)) {
      state.planning = { name, version, savedAt, snapshot }
    },
  }
}
