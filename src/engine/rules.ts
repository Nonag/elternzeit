import { count, euro, formatMonthList, formatMonthRange, num } from './format'
import { consecutiveRuns } from './math'
import { PARENTAL_ALLOWANCE as PA, PARENTAL_LEAVE as PL, WORKING_TIME } from './params'
import type { EntitlementSummary, Issue, MonthRow, ParentMonth, ParentSummary } from './result'
import type { ParentKey, PlanPeriod, VariantConfig } from './types'
import type { VacationSummary } from './vacation'

export interface RuleContext {
  config: VariantConfig
  periods: Record<ParentKey, PlanPeriod[]>
  months: MonthRow[]
  activeParents: ParentKey[]
  parents: Record<ParentKey, ParentSummary>
  entitlement: EntitlementSummary
  parallelBasicAllowed: boolean
  estimatedTaxableIncome: number
  vacation: Record<ParentKey, VacationSummary>
}

function monthsWhere(rows: MonthRow[], key: ParentKey, predicate: (m: ParentMonth) => boolean): number[] {
  return rows.filter((row) => predicate(row[key])).map((row) => row.index)
}

export function evaluateRules(ctx: RuleContext): Issue[] {
  const issues: Issue[] = []
  const { months, activeParents, parents, entitlement, config, periods } = ctx
  const twoParents = activeParents.length === 2
  const name = (key: ParentKey) => parents[key].name
  const add = (issue: Issue) => issues.push(issue)

  for (const key of activeParents) {
    for (const period of periods[key]) {
      const range = formatMonthRange(period.from, period.to)
      if (period.hours === null) {
        add({
          id: `period-hours-${period.id}`,
          severity: 'error',
          category: 'leave',
          parent: key,
          months: rangeOf(period),
          title: `${name(key)}: Wochenstunden fehlen (${range})`,
          detail: 'Bitte eintragen, wie viele Stunden pro Woche in diesem Zeitraum gearbeitet wird – 0, wenn gar nicht.',
        })
      } else if (period.kind === 'work' && period.hours === 0) {
        add({
          id: `period-zero-${period.id}`,
          severity: 'error',
          category: 'leave',
          parent: key,
          months: rangeOf(period),
          title: `${name(key)}: 0 Stunden ohne Elternzeit (${range})`,
          detail: 'Wer nicht in Elternzeit ist, arbeitet. Für eine Auszeit mit Kind bitte Elternzeit einschalten.',
        })
      } else if (period.hours > 0) {
        const workDays = period.workDays ?? config.parents[key].workDaysPerWeek
        const perDay = period.hours / workDays
        if (perDay > WORKING_TIME.regularDailyHours + 0.001) {
          add({
            id: `period-day-hours-${period.id}`,
            severity: 'error',
            category: 'general',
            parent: key,
            months: rangeOf(period),
            title: `${name(key)}: mehr als ${WORKING_TIME.regularDailyHours} Stunden pro Arbeitstag (${range})`,
            detail: `${num(period.hours)} Stunden an ${count(workDays, 'Tag', 'Tagen')} pro Woche sind ${num(perDay)} Stunden pro Tag, mehr als ein normaler Arbeitstag mit ${WORKING_TIME.regularDailyHours} Stunden.`,
          })
        }
      }
    }

    const lateBasic = monthsWhere(months, key, (m) => m.allowance === 'basic' && !m.maternityLocked).filter(
      (i) => i > entitlement.lastBasicMonth,
    )
    if (lateBasic.length) {
      add({
        id: `basic-after-14-${key}`,
        severity: 'error',
        category: 'allowance',
        parent: key,
        months: lateBasic,
        title: `${name(key)}: Basiselterngeld gibt es nur bis zum ${entitlement.lastBasicMonth}. Lebensmonat`,
        detail: `Danach ist nur noch ElterngeldPlus möglich. Betroffen: ${formatMonthList(lateBasic)}.`,
      })
    }

    const latePlus = monthsWhere(months, key, (m) => m.allowance === 'plus' || m.allowance === 'bonus').filter(
      (i) => i > PA.lastPlusMonth,
    )
    if (latePlus.length) {
      add({
        id: `plus-after-32-${key}`,
        severity: 'error',
        category: 'allowance',
        parent: key,
        months: latePlus,
        title: `${name(key)}: Elterngeld gibt es höchstens bis zum ${PA.lastPlusMonth}. Lebensmonat`,
        detail: `Betroffen: ${formatMonthList(latePlus)}.`,
      })
    }

    const tooManyHours = monthsWhere(months, key, (m) => m.allowance !== 'none' && m.hours > PA.maxWeeklyHours)
    if (tooManyHours.length) {
      add({
        id: `hours-${key}`,
        severity: 'error',
        category: 'allowance',
        parent: key,
        months: tooManyHours,
        title: `${name(key)}: über ${PA.maxWeeklyHours} Wochenstunden – kein Elterngeld`,
        detail: `Wer im Monatsschnitt mehr als ${PA.maxWeeklyHours} Stunden pro Woche arbeitet, bekommt in diesem Monat kein Elterngeld. Betroffen: ${formatMonthList(tooManyHours)}.`,
      })
    }

    const counts = parents[key].counts
    if (counts.entitlement > entitlement.perParentMax) {
      add({
        id: `per-parent-max-${key}`,
        severity: 'error',
        category: 'allowance',
        parent: key,
        title: `${name(key)}: mehr als ${entitlement.perParentMax} Monate Basiselterngeld`,
        detail: `Ein Elternteil kann höchstens ${entitlement.perParentMax} Monate Basiselterngeld bekommen (ElterngeldPlus zählt halb). Geplant sind ${num(counts.entitlement)}.`,
      })
    }
    if (counts.allowanceMonths > 0 && counts.allowanceMonths < PA.minMonthsPerParent) {
      add({
        id: `min-months-${key}`,
        severity: 'error',
        category: 'allowance',
        parent: key,
        title: `${name(key)}: Elterngeld nur für mindestens 2 Monate`,
        detail: 'Wer Elterngeld bekommt, muss es mindestens zwei Monate lang beziehen.',
      })
    }

    const bonusMonths = monthsWhere(months, key, (m) => m.allowance === 'bonus')
    if (bonusMonths.length) {
      const runs = consecutiveRuns(bonusMonths)
      if (runs.length > 1 || bonusMonths.length < PA.bonusMinMonths || bonusMonths.length > PA.bonusMaxMonths) {
        add({
          id: `bonus-shape-${key}`,
          severity: 'error',
          category: 'allowance',
          parent: key,
          months: bonusMonths,
          title: `${name(key)}: Partnerschaftsbonus muss 2 bis 4 Monate am Stück dauern`,
          detail: `Geplant: ${formatMonthList(bonusMonths)}.`,
        })
      }
      const wrongHours = bonusMonths.filter((i) => {
        const h = months[i - 1][key].hours
        return h < PA.bonusMinHours || h > PA.bonusMaxHours
      })
      if (wrongHours.length) {
        add({
          id: `bonus-hours-${key}`,
          severity: 'error',
          category: 'allowance',
          parent: key,
          months: wrongHours,
          title: `${name(key)}: Partnerschaftsbonus nur bei ${PA.bonusMinHours} bis ${PA.bonusMaxHours} Wochenstunden`,
          detail: `Betroffen: ${formatMonthList(wrongHours)}.`,
        })
      }
    }

    const leaveMonths = monthsWhere(months, key, (m) => m.leave && !m.maternityLocked)
    const sections = consecutiveRuns(leaveMonths)
    if (sections.length > PL.maxSectionsWithoutConsent) {
      add({
        id: `sections-${key}`,
        severity: 'warning',
        category: 'leave',
        parent: key,
        title: `${name(key)}: Elternzeit in ${sections.length} Abschnitten`,
        detail: `Ohne Zustimmung des Arbeitgebers lässt sich die Elternzeit auf höchstens ${PL.maxSectionsWithoutConsent} Abschnitte verteilen.`,
      })
    }
    if (leaveMonths.length > PL.maxMonths) {
      add({
        id: `leave-total-${key}`,
        severity: 'error',
        category: 'leave',
        parent: key,
        title: `${name(key)}: mehr als 3 Jahre Elternzeit`,
        detail: 'Jeder Elternteil hat höchstens 3 Jahre Elternzeit pro Kind.',
      })
    }
    const afterThird = leaveMonths.filter((i) => i > 36)
    if (afterThird.length) {
      add({
        id: `leave-after-3-${key}`,
        severity: 'info',
        category: 'leave',
        parent: key,
        months: afterThird,
        title: `${name(key)}: Elternzeit nach dem 3. Geburtstag`,
        detail: 'Bis zu 24 Monate können bis zum 8. Geburtstag genommen werden. Anmeldung dafür 13 Wochen vorher.',
      })
    }

    const partTime = months.filter((row) => row[key].leave && row[key].hours > 0 && !row[key].maternityLocked)
    const overMax = partTime.filter((row) => row[key].hours > PL.partTimeMaxHours).map((r) => r.index)
    if (overMax.length) {
      add({
        id: `parttime-max-${key}`,
        severity: 'error',
        category: 'leave',
        parent: key,
        months: overMax,
        title: `${name(key)}: in der Elternzeit höchstens ${PL.partTimeMaxHours} Wochenstunden`,
        detail: `Betroffen: ${formatMonthList(overMax)}.`,
      })
    }
    const underMin = partTime.filter((row) => row[key].hours < PL.partTimeMinHours).map((r) => r.index)
    if (underMin.length) {
      add({
        id: `parttime-min-${key}`,
        severity: 'warning',
        category: 'leave',
        parent: key,
        months: underMin,
        title: `${name(key)}: unter ${PL.partTimeMinHours} Stunden kein Anspruch auf Teilzeit`,
        detail: `Weniger als ${PL.partTimeMinHours} Wochenstunden muss der Arbeitgeber nicht genehmigen – nur nach Absprache. Betroffen: ${formatMonthList(underMin)}.`,
      })
    }
    const episodes: { months: number[]; hours: number }[] = []
    for (const row of partTime) {
      const last = episodes[episodes.length - 1]
      if (last && last.months[last.months.length - 1] === row.index - 1 && last.hours === row[key].hours) {
        last.months.push(row.index)
      } else {
        episodes.push({ months: [row.index], hours: row[key].hours })
      }
    }
    if (episodes.length > PL.partTimeClaims) {
      add({
        id: `parttime-claims-${key}`,
        severity: 'warning',
        category: 'leave',
        parent: key,
        title: `${name(key)}: ${episodes.length} verschiedene Teilzeit-Phasen`,
        detail: `Ein Recht auf Teilzeit in der Elternzeit gibt es nur für ${PL.partTimeClaims} Phasen. Jede weitere Änderung der Stunden nur in Absprache mit dem Arbeitgeber.`,
      })
    }
    const shortEpisodes = episodes.filter((e) => e.months.length < PL.partTimeMinMonths)
    if (shortEpisodes.length) {
      add({
        id: `parttime-short-${key}`,
        severity: 'warning',
        category: 'leave',
        parent: key,
        months: shortEpisodes.flatMap((e) => e.months),
        title: `${name(key)}: Teilzeit kürzer als ${PL.partTimeMinMonths} Monate`,
        detail: 'Ein Recht auf Teilzeit in der Elternzeit besteht nur für mindestens zwei Monate am Stück.',
      })
    }
    const parentConfig = config.parents[key]
    if (partTime.length && (!parentConfig.employerOver15 || !parentConfig.employedOver6Months)) {
      add({
        id: `parttime-claim-${key}`,
        severity: 'info',
        category: 'leave',
        parent: key,
        months: partTime.map((row) => row.index),
        title: `${name(key)}: Teilzeit nur in Absprache`,
        detail: 'Ein Recht auf Teilzeit in der Elternzeit gibt es nur bei mehr als 15 Beschäftigten und nach mehr als 6 Monaten im Betrieb.',
      })
    }
  }

  if (twoParents) {
    const parallel = months
      .filter((row) => row.a.allowance === 'basic' && row.b.allowance === 'basic')
      .map((row) => row.index)
    if (!ctx.parallelBasicAllowed && (parallel.length > 1 || parallel.some((i) => i > PA.parallelBasicWindow))) {
      const maternityOverlap = parallel.some((i) => months[i - 1].a.maternityLocked)
      add({
        id: 'parallel-basic',
        severity: 'error',
        category: 'allowance',
        months: parallel,
        title: 'Beide gleichzeitig Basiselterngeld – nur 1 Monat erlaubt',
        detail:
          `Gleichzeitig Basiselterngeld dürfen beide Eltern nur in einem einzigen Monat beziehen, und nur im ersten Lebensjahr. Geplant: ${formatMonthList(parallel)}.` +
          (maternityOverlap
            ? ` Achtung: Die ersten Monate von ${name('a')} zählen wegen des Mutterschutzes automatisch als Basiselterngeld.`
            : '') +
          ' Mit ElterngeldPlus statt Basiselterngeld gilt diese Grenze nicht.',
      })
    }

    const bonusMismatch = months
      .filter((row) => (row.a.allowance === 'bonus') !== (row.b.allowance === 'bonus'))
      .map((row) => row.index)
    if (bonusMismatch.length) {
      add({
        id: 'bonus-parallel',
        severity: 'error',
        category: 'allowance',
        months: bonusMismatch,
        title: 'Partnerschaftsbonus nur gemeinsam',
        detail: `Beide Eltern müssen ihn in denselben Monaten beziehen. Betroffen: ${formatMonthList(bonusMismatch)}.`,
      })
    }
  }

  if (entitlement.used > entitlement.available) {
    add({
      id: 'entitlement',
      severity: 'error',
      category: 'allowance',
      title: `Zu viele Elterngeld-Monate verplant (${num(entitlement.used)} von ${entitlement.available})`,
      detail:
        'Zusammen gibt es 14 Monate Basiselterngeld, wenn beide Elterngeld beziehen – sonst 12. ElterngeldPlus zählt halb, der Partnerschaftsbonus kommt obendrauf.',
    })
  }

  const lastAllowanceMonth = Math.max(
    0,
    ...months.filter((row) => activeParents.some((k) => row[k].allowance !== 'none')).map((row) => row.index),
  )
  if (lastAllowanceMonth > entitlement.lastBasicMonth) {
    const gaps = months
      .filter((row) => row.index > entitlement.lastBasicMonth && row.index < lastAllowanceMonth)
      .filter((row) => activeParents.every((k) => row[k].allowance === 'none'))
      .map((row) => row.index)
    if (gaps.length) {
      add({
        id: 'continuity',
        severity: 'error',
        category: 'allowance',
        months: gaps,
        title: `Lücke im Elterngeld nach dem ${entitlement.lastBasicMonth}. Monat`,
        detail: `Ab dem ${entitlement.lastBasicMonth + 1}. Lebensmonat muss ohne Unterbrechung mindestens ein Elternteil Elterngeld bekommen, sonst entfällt der Rest. Lücke: ${formatMonthList(gaps)}.`,
      })
    }
  }

  if (ctx.estimatedTaxableIncome > PA.incomeLimit) {
    add({
      id: 'income-limit',
      severity: 'error',
      category: 'allowance',
      title: 'Einkommen zu hoch für Elterngeld',
      detail: `Liegt das zu versteuernde Einkommen im Jahr vor der Geburt über ${euro(PA.incomeLimit)}, gibt es kein Elterngeld. Geschätzt: ${euro(ctx.estimatedTaxableIncome)}.`,
    })
  } else if (ctx.estimatedTaxableIncome > PA.incomeLimit - 15_000) {
    add({
      id: 'income-limit-near',
      severity: 'warning',
      category: 'allowance',
      title: 'Einkommen nahe an der Elterngeld-Grenze',
      detail: `Ab ${euro(PA.incomeLimit)} zu versteuerndem Einkommen im Jahr vor der Geburt gibt es kein Elterngeld. Geschätzt: ${euro(ctx.estimatedTaxableIncome)} – maßgeblich ist der Steuerbescheid.`,
    })
  }

  const belowReserve = months.filter((row) => row.balance < config.minReserve).map((row) => row.index)
  if (belowReserve.length) {
    const negative = months.some((row) => row.balance < 0)
    add({
      id: 'reserve',
      severity: 'warning',
      category: 'finance',
      months: belowReserve,
      title: negative ? 'Konto rutscht ins Minus' : 'Kontostand unter der Mindestreserve',
      detail: `Betroffen: ${formatMonthList(belowReserve)} (Mindestreserve ${euro(config.minReserve)}).`,
    })
  }
  const careGaps = months.filter((row) => row.care.gap > 0.5).map((row) => row.index)
  if (careGaps.length) {
    add({
      id: 'care-gap',
      severity: 'warning',
      category: 'care',
      months: careGaps,
      title: 'Betreuungslücke',
      detail: `In ${formatMonthList(careGaps)} arbeiten beide Eltern gleichzeitig, ohne dass Kita, Familie oder Freunde das Kind betreuen.`,
    })
  }
  const settling = months.find((row) => row.care.settlingIn)
  if (settling && settling.care.need > 0) {
    add({
      id: 'settling-in',
      severity: 'warning',
      category: 'care',
      months: [settling.index],
      title: 'Kita-Eingewöhnung, während beide arbeiten',
      detail: 'In den ersten zwei bis vier Wochen in der Kita sollte ein Elternteil frei haben (Urlaub oder Elternzeit).',
    })
  }

  if (twoParents && activeParents.every((k) => parents[k].counts.allowanceMonths >= PA.minMonthsPerParent)) {
    add({
      id: 'partner-months',
      severity: 'success',
      category: 'allowance',
      title: 'Partnermonate gesichert',
      detail: 'Weil beide Elterngeld beziehen, gibt es zusammen 14 statt 12 Monate.',
    })
  }
  if (activeParents.every((k) => parents[k].counts.bonus >= PA.bonusMinMonths) && !issues.some((i) => i.id.startsWith('bonus'))) {
    add({
      id: 'bonus-used',
      severity: 'success',
      category: 'allowance',
      title: 'Partnerschaftsbonus genutzt',
      detail: `${parents.a.counts.bonus} zusätzliche Monate ElterngeldPlus für jeden Elternteil.`,
    })
  }
  for (const key of activeParents) {
    for (const year of ctx.vacation[key].years) {
      if (year.remaining > -0.05) continue
      const inYear = monthsWhere(months, key, (m) => m.vacationShare > 0).filter((i) => {
        const row = months[i - 1]
        return row.start <= `${year.year}-12-31` && row.end >= `${year.year}-01-01`
      })
      add({
        id: `vacation-over-${key}-${year.year}`,
        severity: 'warning',
        category: 'vacation',
        parent: key,
        months: inYear,
        title: `${name(key)}: ${year.year} mehr Urlaub geplant als vorhanden`,
        detail: `Geplant sind ${num(year.planned)} Tage, der Anspruch für ${year.year} liegt bei ${num(year.entitlement)} Tagen. Resturlaub aus dem Vorjahr kann das ausgleichen.`,
      })
    }
  }

  if (!issues.some((i) => i.category === 'allowance' && i.severity === 'error')) {
    add({
      id: 'plan-valid',
      severity: 'success',
      category: 'allowance',
      title: 'Der Elterngeld-Plan hält alle Regeln ein',
    })
  }

  return issues
}

function rangeOf(period: PlanPeriod): number[] {
  return Array.from({ length: period.to - period.from + 1 }, (_, i) => period.from + i)
}
