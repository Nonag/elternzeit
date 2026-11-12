import { describe, expect, it } from 'vitest'
import { exampleConfig } from './example'
import { closeGaps, hasCareGaps, unclosedText } from './gaps'
import { periodsFromPreset, PLAN_PRESETS } from './plan'
import { simulate } from './simulate'
import type { VariantConfig } from './types'

/** "Partnerschaftlich mit Bonus" with a Kita from August 2028 and grandparents one day a week before it. */
function withKitaAndFamily(change: (config: VariantConfig) => void = () => {}): VariantConfig {
  const config = exampleConfig()
  config.periods = periodsFromPreset(PLAN_PRESETS.find((p) => p.id === 'partnership')!)
  config.childcare = { ...config.childcare, enabled: true, startMonth: '2028-08', hoursPerWeek: 35 }
  config.familyCare = [{ id: 'f1', label: 'Großeltern', from: '2028-01-15', to: '2028-08-14', daysPerWeek: 1, hoursPerDay: 8 }]
  change(config)
  return config
}

const blockingIssues = (config: VariantConfig) =>
  simulate(config)
    .issues.filter((i) => (i.severity === 'error' || i.severity === 'warning') && i.category !== 'care' && i.category !== 'finance')
    .map((i) => i.id)

describe('closeGaps', () => {
  it('tunes the bonus, covers the Kita start with vacation and reduces the hours where needed', () => {
    const config = withKitaAndFamily()
    const proposal = closeGaps(config)
    expect(proposal.changes).toEqual([
      'Partnerschaftsbonus: Mutter und Vater je 24 Stunden an 3 Tagen',
      // No Kita yet: the mother alone cannot close it, so both work three days and the grandparents take the shared one.
      'Monat 19: Mutter und Vater je 24 Stunden an 3 Tagen in Elternzeit',
      'Monat 21–36: Mutter 32 Stunden an 5 Tagen in Elternzeit',
      'Kita-Eingewöhnung: Mutter Urlaub 14.08.2028 – 17.09.2028',
    ])
    expect(proposal.remaining).toEqual([])
    const after = { ...config, periods: proposal.periods, vacation: proposal.vacation }
    expect(blockingIssues(after)).toEqual(blockingIssues(config))
    expect(simulate(after).issues.some((i) => i.id === 'settling-in')).toBe(false)
  })

  it('takes Elternzeit for the Kita start when the vacation does not suffice', () => {
    const proposal = closeGaps(
      withKitaAndFamily((c) => {
        c.parents.a.vacationDaysPerYear = 10
        c.parents.b.vacationDaysPerYear = 10
      }),
    )
    expect(proposal.changes).toContain('Kita-Eingewöhnung: Mutter in Monat 20 in Elternzeit')
    expect(proposal.vacation).toEqual({ a: [], b: [] })
  })

  it('lets the father reduce when he earns less', () => {
    const proposal = closeGaps(withKitaAndFamily((c) => (c.parents.b.grossMonthly = 3000)))
    expect(proposal.changes).toContain('Monat 21–36: Vater 32 Stunden an 5 Tagen in Elternzeit')
  })

  it('uses the Partnerschaftsbonus for both when the parent who earns less cannot close the gap alone', () => {
    const proposal = closeGaps(withKitaAndFamily((c) => (c.periods = periodsFromPreset(PLAN_PRESETS.find((p) => p.id === 'equal')!))))
    expect(proposal.changes).toContain('Monat 15–18: Mutter und Vater je 24 Stunden an 3 Tagen mit Partnerschaftsbonus')
    expect(proposal.remaining).toEqual([])
  })

  it('plans the Kita start after part-time, which lowers the vacation entitlement', () => {
    const proposal = closeGaps(withKitaAndFamily((c) => (c.periods = periodsFromPreset(PLAN_PRESETS.find((p) => p.id === 'start-together')!))))
    expect(proposal.changes).toContain('Monat 17–19: Mutter und Vater je 24 Stunden an 3 Tagen in Elternzeit')
    expect(proposal.remaining).toEqual([])
  })

  it('names what is left', () => {
    expect(unclosedText([19])).toBe('Die Lücke in Monat 19 konnte nicht automatisch geschlossen werden.')
    expect(unclosedText([15, 16, 19])).toBe('Die Lücken in Monat 15–16, 19 konnten nicht automatisch geschlossen werden.')
  })

  it('changes nothing without gaps', () => {
    // The mother stays at home for all three years.
    const config = exampleConfig()
    config.periods.a.push({ id: 'home', from: 13, to: 36, kind: 'leave', hours: 0, workDays: null, allowance: 'none' })
    expect(hasCareGaps(simulate(config))).toBe(false)
    expect(closeGaps(config).changes).toEqual([])
  })
})
