import { formatDate } from './dates'
import { PARENTAL_ALLOWANCE as PA } from './params'
import { basicWithIncome, computeAllowanceNet, plusWithIncome } from './parentalAllowance'
import { computePayroll } from './payroll'
import type { Issue, SimulationResult } from './result'
import { formatMonthList } from './rules'
import type { VacationSummary } from './vacation'
import type { ParentKey, ScenarioConfig } from './types'

const euro = (value: number) =>
  value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

/** Synergies and missed opportunities, each with an estimated effect in euros where possible. */
export function evaluateTips(
  config: ScenarioConfig,
  result: SimulationResult,
  vacation: Record<ParentKey, VacationSummary>,
): Issue[] {
  const tips: Issue[] = []
  const { months, parents, activeParents } = result
  const supplements = { siblingBonus: config.siblingBonus, additionalChildren: Math.max(0, config.children - 1) }

  for (const key of activeParents) {
    const summary = parents[key]
    const parent = config.parents[key]
    const name = summary.name

    const basicWithWork = months.filter((m) => m[key].allowance === 'basic' && m[key].hours > 0 && !m[key].maternityLocked)
    if (basicWithWork.length && summary.averageNetAfterBasic !== null) {
      const basic = basicWithIncome(summary.base, summary.averageNetAfterBasic, supplements)
      const plus = plusWithIncome(summary.base, summary.averageNetAfterBasic, supplements)
      const gain = (2 * plus - basic) * basicWithWork.length
      if (gain > 50) {
        tips.push({
          id: `tip-plus-instead-basic-${key}`,
          severity: 'info',
          category: 'allowance',
          parent: key,
          months: basicWithWork.map((m) => m.index),
          impact: gain,
          title: `${name}: in Teilzeit lieber ElterngeldPlus`,
          detail: `Wer nebenbei arbeitet, bekommt deutlich weniger Basiselterngeld (hier ${euro(basic)} im Monat). ElterngeldPlus wird kaum gekürzt (${euro(plus)}) und läuft doppelt so lange. Insgesamt wären das bis zu ${euro(gain)} mehr.`,
        })
      }
    }

    const saved = vacation[key].savedByAlignment
    if (saved >= 0.5) {
      const first = vacation[key].ranges[0]
      tips.push({
        id: `tip-vacation-${key}`,
        severity: 'success',
        category: 'leave',
        parent: key,
        title: `${name}: ${saved.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Urlaubstage gespart`,
        detail: `Der Arbeitgeber darf den Urlaub nur für jeden vollen Kalendermonat Elternzeit kürzen. Weil die Elternzeit am ${formatDate(first.start).slice(0, 6)} beginnt statt am Monatsersten, fallen weniger volle Kalendermonate an.`,
      })
    }

    const regularPartTime = months.filter(
      (m) => !m[key].leave && m[key].hours > 0 && m[key].hours < parent.weeklyHours && m.index <= 36 && !m[key].maternityLocked,
    )
    if (regularPartTime.length && regularPartTime.every((m) => m[key].hours <= 32)) {
      tips.push({
        id: `tip-parttime-in-leave-${key}`,
        severity: 'info',
        category: 'leave',
        parent: key,
        months: regularPartTime.map((m) => m.index),
        title: `${name}: Teilzeit besser als Elternzeit anmelden`,
        detail:
          'Bis zum 3. Geburtstag kannst du in Elternzeit bis zu 32 Stunden pro Woche arbeiten. Vorteile: Danach gilt automatisch wieder die alte Stundenzahl, du hast Kündigungsschutz und der Urlaub wird nicht gekürzt.',
      })
    }

    if (parent.healthInsurance === 'private' && summary.counts.leaveMonths > 0) {
      const cost = months.reduce((s, m) => s + m[key].healthCosts, 0)
      if (cost > 0) {
        tips.push({
          id: `tip-private-insurance-${key}`,
          severity: 'warning',
          category: 'finance',
          parent: key,
          impact: -cost,
          title: `${name}: privater Krankenversicherungsbeitrag ohne Zuschuss`,
          detail: `Ohne Gehalt zahlt der Arbeitgeber nichts dazu – im Plan sind das zusammen ${euro(cost)}. Bei der Versicherung nach einem günstigeren Tarif für diese Zeit fragen.`,
        })
      }
    }
  }

  const free = result.entitlement.available - result.entitlement.used
  if (free > 0 && result.entitlement.used > 0) {
    const best = Math.max(...activeParents.map((k) => parents[k].base.basicFull))
    tips.push({
      id: 'tip-free-entitlement',
      severity: 'info',
      category: 'allowance',
      impact: free * best,
      title: `Ungenutztes Elterngeld: bis zu ${euro(free * best)}`,
      detail: `Es sind noch ${free.toLocaleString('de-DE')} Monate Basiselterngeld frei – oder doppelt so viele Monate ElterngeldPlus, das lohnt sich auch neben einer Teilzeitstelle.`,
    })
  }

  if (activeParents.length === 2 && activeParents.every((k) => parents[k].counts.bonus === 0)) {
    const hours = 30
    const potential = activeParents.reduce((sum, k) => {
      const p = config.parents[k]
      const net = computeAllowanceNet({
        gross: (p.grossMonthly * hours) / Math.max(1, p.weeklyHours),
        taxClass: p.taxClass,
        factor: p.taxFactor,
        churchTax: p.churchTax,
        statutoryHealthCompulsory: p.healthInsurance === 'statutory',
        pensionInsured: p.pensionInsured,
      }).net
      return sum + 4 * plusWithIncome(parents[k].base, net, supplements)
    }, 0)
    tips.push({
      id: 'tip-partnership-bonus',
      severity: 'info',
      category: 'allowance',
      impact: potential,
      title: `Partnerschaftsbonus ungenutzt: bis zu ${euro(potential)}`,
      detail: `Arbeitet ihr beide 2 bis 4 Monate gleichzeitig ${PA.bonusMinHours} bis ${PA.bonusMaxHours} Stunden pro Woche, gibt es für jeden zusätzlich ElterngeldPlus. Die Schätzung gilt für 4 Monate mit je ${hours} Stunden. Die Betreuung in dieser Zeit mitplanen.`,
    })
  }

  if (config.relationship === 'married' && activeParents.length === 2) {
    for (const key of activeParents) {
      const other: ParentKey = key === 'a' ? 'b' : 'a'
      const p = config.parents[key]
      const currentClass = p.taxClassAfterBirth ?? p.taxClass
      if (currentClass === 3) continue
      const leaveMonths = months.filter((m) => m[key].hours >= p.weeklyHours && m[other].netSalary === 0)
      if (leaveMonths.length < 2) continue
      const year = Number(leaveMonths[0].start.slice(0, 4))
      const base = {
        year,
        gross: p.grossMonthly,
        factor: null,
        churchTax: p.churchTax,
        churchTaxRate: config.churchTaxRate,
        childAllowances: 1,
        healthInsurance: p.healthInsurance,
        healthAdditionalRate: p.healthAdditionalRate,
        privatePremium: p.privatePremium,
        pensionInsured: p.pensionInsured,
        childless: false,
      }
      const gain = computePayroll({ ...base, taxClass: 3 }).net - computePayroll({ ...base, taxClass: currentClass }).net
      if (gain > 50) {
        tips.push({
          id: `tip-tax-class-${key}`,
          severity: 'info',
          category: 'finance',
          parent: key,
          months: leaveMonths.map((m) => m.index),
          title: `${parents[key].name}: Steuerklasse III, solange ${parents[other].name} kein Gehalt hat`,
          detail: `Bringt etwa ${euro(gain)} mehr Netto pro Monat (${formatMonthList(leaveMonths.map((m) => m.index))}). Die Steuer fürs ganze Jahr bleibt gleich – zu wenig gezahlte Steuer wird mit der Steuererklärung nachgezahlt. Aufs Elterngeld hat der Wechsel keinen Einfluss.`,
        })
      }
    }
  }

  if (config.childcare.enabled && result.childcare.startMonthIndex) {
    tips.push({
      id: 'tip-childcare-subsidy',
      severity: 'info',
      category: 'finance',
      title: 'Arbeitgeber nach einem Kita-Zuschuss fragen',
      detail:
        'Ein Zuschuss zu den Kita-Kosten ist steuer- und abgabenfrei, wenn er zusätzlich zum Gehalt gezahlt wird – 100 € Zuschuss kommen komplett an. Außerdem lassen sich Kita-Beiträge (ohne Essen) zu 80 % von der Steuer absetzen, höchstens 4.800 € im Jahr.',
    })
  }

  const surchargeGain = activeParents.reduce((sum, k) => {
    const p = config.parents[k]
    if (p.healthInsurance === 'private' || p.grossMonthly <= 0) return sum
    const base = {
      year: Number(result.birth.slice(0, 4)),
      gross: p.grossMonthly,
      taxClass: p.taxClass,
      factor: p.taxFactor,
      churchTax: p.churchTax,
      churchTaxRate: config.churchTaxRate,
      childAllowances: 0,
      healthInsurance: p.healthInsurance,
      healthAdditionalRate: p.healthAdditionalRate,
      privatePremium: 0,
      pensionInsured: p.pensionInsured,
    }
    return sum + computePayroll({ ...base, childless: false }).net - computePayroll({ ...base, childless: true }).net
  }, 0)
  if (surchargeGain > 1) {
    tips.push({
      id: 'tip-care-surcharge',
      severity: 'success',
      category: 'finance',
      title: `Kein Kinderlosenzuschlag mehr: +${euro(surchargeGain)} Netto pro Monat`,
      detail:
        'Kinderlose zahlen einen Zuschlag zur Pflegeversicherung. Mit dem ersten Kind fällt er für beide Eltern weg – ab dem Geburtsmonat, wenn ihr dem Arbeitgeber die Geburtsurkunde rechtzeitig zeigt.',
    })
  }

  return tips
}
