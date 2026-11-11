import { addDays, parseIso } from '@/engine/dates'
import type { Issue, IssueCategory, SimulationResult } from '@/engine/result'
import type { VariantConfig } from '@/engine/types'
import { weekStart } from '@/engine/vacation'

/** Inputs of a plan period that can be marked. */
export type PeriodField = 'to' | 'kind' | 'hours' | 'workDays' | 'allowance'
/** Counters in the header of the plan card. */
export type Counter = 'allowance' | 'bonus' | 'leave'

type Target = { fields: PeriodField[] } | { vacationYear: true } | { counter: Counter } | { lane: 'childcare' | 'gaps' }

/** Where the plan card marks an issue, by its id without the parameters (parent, period, year, month). */
const TARGETS: [id: string, target: Target][] = [
  ['period-hours', { fields: ['hours'] }],
  ['period-zero', { fields: ['kind', 'hours'] }],
  ['period-day-hours', { fields: ['hours', 'workDays'] }],
  ['hours', { fields: ['hours'] }],
  ['bonus-hours', { fields: ['hours'] }],
  ['parttime-max', { fields: ['hours'] }],
  ['parttime-min', { fields: ['hours'] }],
  ['parttime-claim', { fields: ['hours'] }],
  ['parttime-short', { fields: ['to'] }],
  ['basic-after-14', { fields: ['allowance'] }],
  ['plus-after-32', { fields: ['allowance'] }],
  ['bonus-shape', { fields: ['allowance'] }],
  ['tip-plus-instead-basic', { fields: ['allowance'] }],
  ['leave-after-3', { fields: ['kind'] }],
  ['tip-parttime-in-leave', { fields: ['kind'] }],
  ['tip-vacation-instead-leave', { fields: ['kind'] }],
  ['vacation-over', { vacationYear: true }],
  ['bonus-parallel', { counter: 'bonus' }],
  ['tip-partnership-bonus', { counter: 'bonus' }],
  ['settling-in', { lane: 'childcare' }],
]

/** Other issues of the plan, and those without a matching row, go to the counter or lane of their category. */
const BY_CATEGORY: Partial<Record<IssueCategory, Target>> = {
  allowance: { counter: 'allowance' },
  leave: { counter: 'leave' },
  vacation: { counter: 'leave' },
  care: { lane: 'gaps' },
}

export interface PlanIssues {
  /** By `${periodId}:${field}`. */
  fields: Map<string, Issue[]>
  /** By vacation period id. */
  vacation: Map<string, Issue[]>
  counters: Record<Counter, Issue[]>
  /** By timeline lane id. */
  lanes: Map<string, Issue[]>
}

/** Errors, warnings and tips of the plan, assigned to the fields, counters and timeline lanes of the plan card. */
export function planIssues(result: SimulationResult, config: VariantConfig): PlanIssues {
  const marks: PlanIssues = { fields: new Map(), vacation: new Map(), counters: { allowance: [], bonus: [], leave: [] }, lanes: new Map() }
  const add = (map: Map<string, Issue[]>, key: string, issue: Issue) => map.set(key, [...(map.get(key) ?? []), issue])

  const place = (issue: Issue, target: Target): boolean => {
    if ('counter' in target) {
      marks.counters[target.counter].push(issue)
      return true
    }
    if ('lane' in target) {
      add(marks.lanes, target.lane, issue)
      return true
    }
    const parent = issue.parent
    if (!parent) return false
    const own = withoutName(issue, result.parents[parent].name)
    if ('vacationYear' in target) {
      const year = Number(issue.id.slice(issue.id.lastIndexOf('-') + 1))
      // The weekend after the last Friday may fall into the next year, but costs no vacation there.
      const lastFriday = (to: string) => addDays(weekStart(to), 4)
      const rows = config.vacation[parent].filter((v) => v.from && v.to && parseIso(v.from).year <= year && parseIso(lastFriday(v.to)).year >= year)
      rows.forEach((v) => add(marks.vacation, v.id, own))
      return rows.length > 0
    }
    const months = issue.months ?? []
    const periods = config.periods[parent].filter((p) => months.some((m) => m >= p.from && m <= p.to))
    periods.forEach((p) => target.fields.forEach((field) => add(marks.fields, `${p.id}:${field}`, own)))
    return periods.length > 0
  }

  for (const issue of result.issues) {
    if (issue.severity === 'success') continue
    const target = TARGETS.find(([id]) => issue.id === id || issue.id.startsWith(`${id}-`))?.[1]
    if (target && place(issue, target)) continue
    const fallback = BY_CATEGORY[issue.category]
    if (fallback) place(issue, fallback)
  }
  return marks
}

/** In the rows of a parent the name in front of the title is redundant: "Eva: unter 15 Stunden …" → "Unter 15 Stunden …". */
function withoutName(issue: Issue, name: string): Issue {
  const prefix = `${name}: `
  if (!issue.title.startsWith(prefix)) return issue
  const title = issue.title.slice(prefix.length)
  return { ...issue, title: title.charAt(0).toUpperCase() + title.slice(1) }
}
