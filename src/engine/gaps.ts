import { addDays, formatDateRange, weekEnd, weekStart } from './dates'
import { formatMonthList, formatMonthRange } from './format'
import { consecutiveRuns } from './math'
import { PARENTAL_ALLOWANCE as PA, PARENTAL_LEAVE as PL, WORKING_TIME } from './params'
import { createId, paintPeriod } from './plan'
import type { SimulationResult } from './result'
import { simulate } from './simulate'
import type { AllowanceType, ParentKey, PlanPeriod, VacationPeriod, VariantConfig } from './types'
import { toggleVacationWeek } from './vacation'

/**
 * "Lücken schließen": closes care gaps in three steps, each kept only if it helps and adds no error or warning
 * apart from care and money. The rules are not repeated here; every candidate is checked with simulate().
 *
 * 1. Partnerschaftsbonus: 24 to 32 hours on as many days per parent as close the gap, the higher income first.
 * 2. Other gaps: the parent who earns less works part-time in Elternzeit, as little less as needed (up to 32 hours).
 *    If that is not enough, both parents do, with the Partnerschaftsbonus where it is still free and allowed.
 * 3. Kita-Eingewöhnung: one parent is off the whole month, with vacation if it suffices, else in Elternzeit. It comes
 *    last because part-time lowers the vacation entitlement.
 *
 * The Kita, family and friends stay as they are, and so does who takes which months.
 */

/** Elternzeit lasts until the 3rd birthday; later gaps are not filled with part-time. */
const LAST_LEAVE_MONTH = 36

export interface GapProposal {
  periods: Record<ParentKey, PlanPeriod[]>
  vacation: Record<ParentKey, VacationPeriod[]>
  /** What changed, one short line each. */
  changes: string[]
  /** Life months that still have a care gap. */
  remaining: number[]
}

/** Whether there is anything to close: a care gap, or both parents working while the child settles in at the Kita. */
export function hasCareGaps(result: SimulationResult): boolean {
  return result.months.some((row) => row.care.gap > 0 || (row.care.settlingIn && row.care.need > 0))
}

/** "Die Lücke in Monat 19 konnte nicht automatisch geschlossen werden." */
export function unclosedText(months: number[]): string {
  const one = consecutiveRuns(months).length === 1
  return `Die ${one ? 'Lücke' : 'Lücken'} in ${formatMonthList(months)} ${one ? 'konnte' : 'konnten'} nicht automatisch geschlossen werden.`
}

interface State {
  config: VariantConfig
  result: SimulationResult
}

/** Weekly hours and working days of one parent. */
interface Setting {
  hours: number
  days: number
}

type Settings = Map<ParentKey, Setting>

interface Candidate {
  settings: Settings
  next: State
  gap: number
  income: number
}

type Apply = (config: VariantConfig, key: ParentKey, setting: Setting) => void

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const gapIn = (result: SimulationResult, months: number[]) => months.reduce((sum, m) => sum + result.months[m - 1].care.gap, 0)
const income = (result: SimulationResult) => result.months.reduce((sum, row) => sum + row.income, 0)
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
/** The smaller gap wins, then the higher household income. */
const better = (a: Candidate, b: Candidate | null) => !b || a.gap < b.gap - 0.01 || (Math.abs(a.gap - b.gap) <= 0.01 && a.income > b.income)

/** Errors and warnings a step must not add. Care gaps and money are what the steps trade. */
function blocking(result: SimulationResult): Set<string> {
  return new Set(
    result.issues
      .filter((i) => (i.severity === 'error' || i.severity === 'warning') && i.category !== 'care' && i.category !== 'finance')
      .map((i) => i.id),
  )
}

function hoursText({ hours, days }: Setting): string {
  return `${hours} Stunden an ${days} Tagen`
}

function leavePeriod(from: number, to: number, hours: number, workDays: number | null, allowance: AllowanceType): PlanPeriod {
  return { id: createId('period'), from, to, kind: 'leave', hours, workDays, allowance }
}

export function closeGaps(input: VariantConfig): GapProposal {
  let state: State = { config: clone(input), result: simulate(input) }
  const allowed = blocking(state.result)
  const changes: string[] = []
  const parents = state.result.activeParents
  const name = (key: ParentKey) => state.result.parents[key].name
  const contractDays = (key: ParentKey) => state.config.parents[key].workDaysPerWeek
  const lower = parents.length === 1 ? parents[0] : state.config.parents.b.grossMonthly < state.config.parents.a.grossMonthly ? 'b' : 'a'
  const other = parents.find((key) => key !== lower)
  /** Working days as stored on a period: null for the days of the contract. */
  const workDays = (key: ParentKey, days: number) => (days === contractDays(key) ? null : days)

  /** Simulates a changed copy of the config; null when the change adds an error or warning. */
  function attempt(change: (config: VariantConfig) => void): State | null {
    const config = clone(state.config)
    change(config)
    const result = simulate(config)
    return [...blocking(result)].some((id) => !allowed.has(id)) ? null : { config, result }
  }

  function evaluate(settings: Settings, months: number[], apply: Apply): Candidate | null {
    const next = attempt((config) => {
      for (const [key, setting] of settings) apply(config, key, setting)
    })
    return next && { settings, next, gap: gapIn(next.result, months), income: income(next.result) }
  }

  /** The same setting for every parent first, then each parent on their own. */
  function searchShared(keys: ParentKey[], options: (key: ParentKey) => Setting[], months: number[], apply: Apply): Candidate | null {
    let best: Candidate | null = null
    const fitsAll = (o: Setting) => keys.every((key) => options(key).some((x) => x.hours === o.hours && x.days === o.days))
    for (const option of options(keys[0]).filter(fitsAll)) {
      const candidate = evaluate(new Map(keys.map((key) => [key, option])), months, apply)
      if (candidate && better(candidate, best)) best = candidate
    }
    for (const key of keys) {
      if (!best) break
      const start = best.settings
      for (const option of options(key)) {
        const candidate = evaluate(new Map([...start, [key, option]]), months, apply)
        if (candidate && better(candidate, best)) best = candidate
      }
    }
    return best
  }

  /** Every combination of the settings of two parents. */
  function searchAll(keys: ParentKey[], options: (key: ParentKey) => Setting[], months: number[], apply: Apply): Candidate | null {
    let best: Candidate | null = null
    for (const first of options(keys[0])) {
      for (const second of options(keys[1])) {
        const candidate = evaluate(new Map([[keys[0], first], [keys[1], second]]), months, apply)
        if (candidate && better(candidate, best)) best = candidate
      }
    }
    return best
  }

  /** "Mutter und Vater je 24 Stunden an 3 Tagen" or "Mutter 24 Stunden an 3 Tagen, Vater 16 Stunden an 2 Tagen". */
  function settingsText(settings: Settings): string {
    const list = [...settings].sort(([x], [y]) => x.localeCompare(y))
    const [, first] = list[0]
    return list.length > 1 && list.every(([, s]) => s.hours === first.hours && s.days === first.days)
      ? `${list.map(([key]) => name(key)).join(' und ')} je ${hoursText(first)}`
      : list.map(([key, s]) => `${name(key)} ${hoursText(s)}`).join(', ')
  }

  const bonusOptions = (key: ParentKey): Setting[] => {
    const list: Setting[] = []
    for (let hours = PA.bonusMinHours; hours <= PA.bonusMaxHours; hours++) {
      for (let days = Math.ceil(hours / WORKING_TIME.regularDailyHours); days <= contractDays(key); days++) list.push({ hours, days })
    }
    return list
  }

  // 1. Partnerschaftsbonus
  const hasBonus = (key: ParentKey) => state.config.periods[key].some((p) => p.allowance === 'bonus')
  const bonusMonths = [...new Set(parents.flatMap((key) => state.config.periods[key].filter((p) => p.allowance === 'bonus').flatMap((p) => range(p.from, p.to))))]
  const bonusGap = gapIn(state.result, bonusMonths)
  if (bonusGap > 0) {
    const best = searchShared(parents.filter(hasBonus), bonusOptions, bonusMonths, (config, key, setting) => {
      config.periods[key] = config.periods[key].map((p) =>
        p.allowance === 'bonus' ? { ...p, hours: setting.hours, workDays: workDays(key, setting.days) } : p,
      )
    })
    if (best && best.gap < bonusGap - 0.01) {
      state = best.next
      changes.push(`Partnerschaftsbonus: ${settingsText(best.settings)}`)
    }
  }

  // 2. Other gaps (not the Kita start): part-time in Elternzeit, first for the parent who earns less, then for both
  const works = (key: ParentKey, m: number) => !state.result.months[m - 1][key].leave && state.result.months[m - 1][key].hours > 0
  /** Below the current hours, at most 32, at least 15. */
  const maxPartTime = (key: ParentKey, run: number[]) => Math.min(PL.partTimeMaxHours, ...run.map((m) => state.result.months[m - 1][key].hours - 1))
  const partTimeOptions = (run: number[]) => (key: ParentKey) => {
    const max = maxPartTime(key, run)
    const list: Setting[] = []
    for (let days = Math.ceil(PL.partTimeMinHours / WORKING_TIME.regularDailyHours); days <= contractDays(key); days++) {
      for (const perDay of [8, 7, 6]) {
        const hours = Math.min(max, perDay * days)
        if (hours >= PL.partTimeMinHours && !list.some((o) => o.hours === hours && o.days === days)) list.push({ hours, days })
      }
    }
    return list
  }
  const paint = (run: number[], allowance: AllowanceType): Apply => (config, key, setting) => {
    config.periods[key] = paintPeriod(config.periods[key], leavePeriod(run[0], run[run.length - 1], setting.hours, workDays(key, setting.days), allowance))
  }

  // Longer gaps first: they get the part-time phases (only two have a legal claim) before shorter ones.
  const queue = consecutiveRuns(
    state.result.months
      .filter((row) => row.index <= LAST_LEAVE_MONTH && row.care.gap > 0 && !row.care.settlingIn && works(lower, row.index))
      .map((row) => row.index),
  )
  const longestFirst = () => queue.sort((x, y) => y.length - x.length || x[0] - y[0])
  /** Shown in the order of the months. */
  const partTime: { start: number; text: string }[] = []
  longestFirst()
  while (queue.length) {
    const run = queue.shift()!
    const label = formatMonthRange(run[0], run[run.length - 1])

    // As little less as needed for the parent who earns less.
    let alone: { next: State; setting: Setting } | null = null
    search: for (let hours = maxPartTime(lower, run); hours >= PL.partTimeMinHours; hours--) {
      for (let days = contractDays(lower); days >= Math.ceil(hours / WORKING_TIME.regularDailyHours); days--) {
        const next = attempt((config) => paint(run, 'none')(config, lower, { hours, days }))
        if (next && gapIn(next.result, run) === 0) {
          alone = { next, setting: { hours, days } }
          break search
        }
      }
    }
    if (alone) {
      state = alone.next
      partTime.push({ start: run[0], text: `${label}: ${name(lower)} ${hoursText(alone.setting)} in Elternzeit` })
      continue
    }
    if (!other || !run.every((m) => works(other, m))) continue
    const both = [lower, other]

    // Both with the Partnerschaftsbonus: 2 to 4 months, if nobody has it yet; later months of the run come next.
    if (run.length >= PA.bonusMinMonths && !parents.some(hasBonus)) {
      const months = run.slice(0, PA.bonusMaxMonths)
      const best = searchShared(both, bonusOptions, months, paint(months, 'bonus'))
      if (best && best.gap === 0) {
        state = best.next
        partTime.push({ start: run[0], text: `${formatMonthRange(months[0], months[months.length - 1])}: ${settingsText(best.settings)} mit Partnerschaftsbonus` })
        if (run.length > months.length) {
          queue.push(run.slice(months.length))
          longestFirst()
        }
        continue
      }
    }

    // Both part-time in Elternzeit, without Elterngeld.
    const best = searchAll(both, partTimeOptions(run), run, paint(run, 'none'))
    if (best && best.gap === 0) {
      state = best.next
      partTime.push({ start: run[0], text: `${label}: ${settingsText(best.settings)} in Elternzeit` })
    }
  }
  changes.push(...partTime.sort((x, y) => x.start - y.start).map((c) => c.text))

  // 3. Kita-Eingewöhnung, last, so the vacation counts with the entitlement after part-time: vacation for one
  //    parent (the one who earns less first), else Elternzeit
  const settling = state.result.months.find((row) => row.care.settlingIn && row.care.need > 0)
  if (settling) {
    const free = (next: State | null): next is State => next !== null && next.result.months[settling.index - 1].care.need === 0
    const from = weekStart(settling.start)
    const to = weekEnd(settling.end)
    let done = false
    for (const key of [lower, ...parents.filter((k) => k !== lower)]) {
      if (settling[key].leave || settling[key].hours === 0) continue
      const next = attempt((config) => {
        for (let monday = from; monday <= to; monday = addDays(monday, 7)) {
          if (!config.vacation[key].some((p) => p.from <= monday && monday <= p.to)) {
            config.vacation[key] = toggleVacationWeek(config.vacation[key], monday, () => createId('vacation'))
          }
        }
      })
      if (free(next)) {
        state = next
        changes.push(`Kita-Eingewöhnung: ${name(key)} Urlaub ${formatDateRange(from, to)}`)
        done = true
        break
      }
    }
    if (!done) {
      const next = attempt((config) => {
        config.periods[lower] = paintPeriod(config.periods[lower], leavePeriod(settling.index, settling.index, 0, null, 'none'))
      })
      if (free(next)) {
        state = next
        changes.push(`Kita-Eingewöhnung: ${name(lower)} in ${formatMonthRange(settling.index, settling.index)} in Elternzeit`)
      }
    }
  }

  return {
    periods: state.config.periods,
    vacation: state.config.vacation,
    changes,
    remaining: state.result.months.filter((row) => row.care.gap > 0).map((row) => row.index),
  }
}
