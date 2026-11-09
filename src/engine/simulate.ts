import { cologneAgeCategory, cologneFee, COLOGNE_MEAL_FEES } from './childcare'
import {
  addMonthsToKey,
  diffDays,
  lifeMonthForCalendarMonth,
  lifeMonths,
  monthKey,
  overlapDays,
  parseIso,
  primaryCalendarMonth,
} from './dates'
import { computeMaternityPeriod, maternityBenefitRate } from './maternity'
import { PARENTAL_ALLOWANCE as PA, yearParameters } from './params'
import {
  basicWithIncome,
  computeAllowanceBase,
  computeAllowanceNet,
  plusWithIncome,
  type AllowanceSupplements,
} from './parentalAllowance'
import { computePayroll, round2, voluntaryMinimumContribution } from './payroll'
import { computeLongTerm } from './pension'
import { expandBlocks, normalizeBlocks, type MonthPlan } from './plan'
import type {
  AllowanceCounts,
  CareCoverage,
  EntitlementSummary,
  MonthMarker,
  MonthRow,
  ParentMonth,
  ParentSummary,
  SimulationResult,
} from './result'
import { evaluateRules } from './rules'
import { evaluateTips } from './tips'
import type { ParentConfig, ParentKey, PlanBlock, RelationshipStatus, ScenarioConfig, TaxClass } from './types'
import { computeVacation } from './vacation'

const PARENT_KEYS: ParentKey[] = ['a', 'b']

const EMPTY_MONTH: ParentMonth = {
  active: false,
  leave: false,
  hours: 0,
  allowance: 'none',
  maternityDays: 0,
  maternityLocked: false,
  grossSalary: 0,
  netSalary: 0,
  maternityBenefit: 0,
  parentalAllowance: 0,
  allowanceNetAfter: 0,
  allowanceNote: '',
  healthCosts: 0,
  fullTimeNet: 0,
  total: 0,
  blockId: null,
}

/** Kinderfreibetragszähler after birth (only affects Soli and church tax). */
function childAllowanceCount(relationship: RelationshipStatus, taxClass: TaxClass, children: number): number {
  if (taxClass >= 5) return 0
  return (relationship === 'married' ? 1 : 0.5) * children
}

/** Additional Basis months after a premature birth (§ 4 Abs. 5 BEEG). */
export function prematureExtraMonths(dueDate: string, birth: string): number {
  const weeksEarly = diffDays(birth, dueDate) / 7
  if (weeksEarly >= 16) return 4
  if (weeksEarly >= 12) return 3
  if (weeksEarly >= 8) return 2
  if (weeksEarly >= 6) return 1
  return 0
}

function contractGross(parent: ParentConfig, hours: number): number {
  if (parent.weeklyHours <= 0) return 0
  return (parent.grossMonthly * hours) / parent.weeklyHours
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null
}

export function effectiveBlocks(config: ScenarioConfig): Record<ParentKey, PlanBlock[]> {
  return {
    a: normalizeBlocks(config.blocks.a),
    b: config.relationship === 'single' ? [] : normalizeBlocks(config.blocks.b),
  }
}

/** Rough zvE estimate for the income limit check (wages minus lump sums and social contributions). */
function estimateTaxableIncome(config: ScenarioConfig, activeParents: ParentKey[]): number {
  let total = 0
  for (const key of activeParents) {
    const parent = config.parents[key]
    const gross = parent.allowanceGross ?? parent.grossMonthly
    if (gross <= 0) continue
    const payroll = computePayroll({
      year: 2026,
      gross,
      taxClass: parent.taxClass,
      churchTax: false,
      churchTaxRate: 0,
      childAllowances: 0,
      healthInsurance: parent.healthInsurance,
      healthAdditionalRate: parent.healthAdditionalRate,
      privatePremium: parent.privatePremium,
      pensionInsured: parent.pensionInsured,
      childless: true,
    })
    const yearly = 12 * (gross - payroll.pension - payroll.health - payroll.care)
    total += Math.max(0, yearly - yearParameters(2026).employeeLumpSum - 36)
  }
  return Math.round(total)
}

export function simulate(config: ScenarioConfig): SimulationResult {
  const birth = config.birthDate ?? config.dueDate
  const horizon = Math.min(96, Math.max(12, Math.round(config.horizonMonths)))
  const lms = lifeMonths(birth, horizon)
  const activeParents: ParentKey[] = config.relationship === 'single' ? ['a'] : ['a', 'b']
  const isActive = (key: ParentKey) => activeParents.includes(key)
  const blocks = effectiveBlocks(config)
  const children = Math.max(1, Math.round(config.children))
  const maternity = computeMaternityPeriod(config.dueDate, birth, config.extendedMaternity || children > 1)
  const supplements: AllowanceSupplements = { siblingBonus: config.siblingBonus, additionalChildren: children - 1 }
  const extraMonths = prematureExtraMonths(config.dueDate, birth)
  const parallelBasicAllowed = children > 1 || extraMonths > 0

  // Pre-birth figures per parent
  const setup = Object.fromEntries(
    PARENT_KEYS.map((key) => {
      const parent = config.parents[key]
      const realNetBefore = computePayroll({
        year: 2026,
        gross: parent.grossMonthly,
        taxClass: parent.taxClass,
        factor: parent.taxFactor,
        churchTax: parent.churchTax,
        churchTaxRate: config.churchTaxRate,
        childAllowances: 0,
        healthInsurance: parent.healthInsurance,
        healthAdditionalRate: parent.healthAdditionalRate,
        privatePremium: parent.privatePremium,
        pensionInsured: parent.pensionInsured,
        childless: true,
      }).net
      const allowanceNetInput = {
        taxClass: parent.taxClass,
        factor: parent.taxFactor,
        churchTax: parent.churchTax,
        statutoryHealthCompulsory: parent.healthInsurance === 'statutory',
        pensionInsured: parent.pensionInsured,
      }
      const allowanceNet = computeAllowanceNet({ ...allowanceNetInput, gross: parent.allowanceGross ?? parent.grossMonthly })
      const base = computeAllowanceBase(allowanceNet.net, supplements)
      const plan: MonthPlan[] = expandBlocks(blocks[key], horizon, parent.weeklyHours)
      return [key, { parent, realNetBefore, allowanceNetInput, allowanceNet, base, plan }]
    }),
  ) as Record<
    ParentKey,
    {
      parent: ParentConfig
      realNetBefore: number
      allowanceNetInput: Omit<Parameters<typeof computeAllowanceNet>[0], 'gross'>
      allowanceNet: ReturnType<typeof computeAllowanceNet>
      base: ReturnType<typeof computeAllowanceBase>
      plan: MonthPlan[]
    }
  >

  const maternityRate = maternityBenefitRate(setup.a.realNetBefore, config.parents.a.healthInsurance)

  // Pass 1: work, salary, maternity benefits
  const parentMonths: Record<ParentKey, ParentMonth[]> = { a: [], b: [] }
  for (const key of PARENT_KEYS) {
    const { parent, plan } = setup[key]
    const other = config.parents[key === 'a' ? 'b' : 'a']
    const taxClassAfter = parent.taxClassAfterBirth ?? parent.taxClass
    const childAllowances = childAllowanceCount(config.relationship, taxClassAfter, children)
    for (const lm of lms) {
      if (!isActive(key)) {
        parentMonths[key].push({ ...EMPTY_MONTH })
        continue
      }
      const year = parseIso(lm.start).year
      const planMonth = plan[lm.index - 1]
      const maternityDays = key === 'a' ? overlapDays(lm.start, lm.end, birth, maternity.end) : 0
      const maternityLocked = maternityDays > 0
      const workFraction = (lm.days - maternityDays) / lm.days
      const hours = workFraction <= 0 ? 0 : planMonth.hours
      const payrollInput = {
        year,
        taxClass: taxClassAfter,
        factor: parent.taxFactor,
        churchTax: parent.churchTax,
        churchTaxRate: config.churchTaxRate,
        childAllowances,
        healthInsurance: parent.healthInsurance,
        healthAdditionalRate: parent.healthAdditionalRate,
        privatePremium: parent.privatePremium,
        pensionInsured: parent.pensionInsured,
        childless: false,
      }
      const payroll = computePayroll({ ...payrollInput, gross: contractGross(parent, hours) })
      const reference = computePayroll({ ...payrollInput, gross: parent.grossMonthly })
      const grossSalary = round2(payroll.gross * workFraction)
      const netSalary = round2(payroll.net * workFraction)
      const maternityBenefit =
        key === 'a' ? round2(maternityDays * maternityRate.totalDaily + (lm.index === 1 ? maternityRate.oneOff : 0)) : 0

      const withoutSalary = hours === 0 ? 1 : 1 - workFraction
      let healthCosts = 0
      if (withoutSalary > 0) {
        if (parent.healthInsurance === 'private') {
          healthCosts = parent.privatePremium * withoutSalary
        } else if (parent.healthInsurance === 'statutoryVoluntary') {
          const familyInsured = config.relationship === 'married' && other.healthInsurance !== 'private'
          healthCosts = familyInsured ? 0 : voluntaryMinimumContribution(year) * withoutSalary
        }
      }

      parentMonths[key].push({
        active: true,
        leave: planMonth.leave,
        hours: round2(hours * workFraction),
        allowance: maternityLocked ? 'basic' : planMonth.allowance,
        maternityDays,
        maternityLocked,
        grossSalary,
        netSalary,
        maternityBenefit,
        parentalAllowance: 0,
        allowanceNetAfter: 0,
        allowanceNote: '',
        healthCosts: round2(healthCosts),
        fullTimeNet: reference.net,
        total: 0,
        blockId: planMonth.blockId,
      })
    }
  }

  // Pass 2: Elterngeld (income averaged separately for Basis and Plus months)
  const averages: Record<ParentKey, { basic: number | null; plus: number | null }> = {
    a: { basic: null, plus: null },
    b: { basic: null, plus: null },
  }
  for (const key of activeParents) {
    const { parent, allowanceNetInput, base } = setup[key]
    const months = parentMonths[key]
    for (const month of months) {
      if (month.allowance !== 'none' && month.hours > 0 && !month.maternityLocked) {
        month.allowanceNetAfter = computeAllowanceNet({
          ...allowanceNetInput,
          gross: contractGross(parent, month.hours),
        }).net
      }
    }
    const withIncome = (variants: string[]) =>
      months
        .filter((m) => variants.includes(m.allowance) && m.hours > 0 && !m.maternityLocked && m.hours <= PA.maxWeeklyHours)
        .map((m) => m.allowanceNetAfter)
    const avgBasic = average(withIncome(['basic']))
    const avgPlus = average(withIncome(['plus', 'bonus']))
    averages[key] = { basic: avgBasic, plus: avgPlus }
    const basicIncome = avgBasic === null ? null : basicWithIncome(base, avgBasic, supplements)
    const plusIncome = avgPlus === null ? null : plusWithIncome(base, avgPlus, supplements)

    months.forEach((month, i) => {
      const lm = lms[i]
      if (month.allowance === 'none') return
      if (month.hours > PA.maxWeeklyHours) {
        month.allowanceNote = `Kein Elterngeld: mehr als ${PA.maxWeeklyHours} Wochenstunden.`
        return
      }
      const isBasic = month.allowance === 'basic'
      const hasIncome = month.hours > 0 && !month.maternityLocked
      let amount: number
      if (isBasic) {
        amount = hasIncome && basicIncome !== null ? basicIncome : base.basicFull
      } else {
        amount = hasIncome && plusIncome !== null ? plusIncome : base.plusFull
      }
      const variantLabel = isBasic ? 'Basiselterngeld' : month.allowance === 'bonus' ? 'Partnerschaftsbonus (Plus)' : 'ElterngeldPlus'
      let note = hasIncome
        ? `${variantLabel} mit Zuverdienst: ${pct(base.rate)} × (${eur(Math.min(base.netBefore, PA.incomeCapForDifference))} − Ø ${eur(
            (isBasic ? avgBasic : avgPlus) ?? 0,
          )} Elterngeld-Netto) = ${eur(amount)}${isBasic ? '' : ' (max. halbes Basiselterngeld)'}`
        : `${variantLabel}: ${pct(base.rate)} × ${eur(base.netBefore)} Elterngeld-Netto${isBasic ? '' : ' ÷ 2'} = ${eur(amount)}`
      if (month.maternityDays > 0) {
        const daily = amount / lm.days
        const uncovered = lm.days - month.maternityDays
        const covered = month.maternityDays * Math.max(0, daily - maternityRate.totalDaily)
        const reduced = uncovered * daily + covered
        note += `; Mutterschaftsleistungen werden tageweise angerechnet (${month.maternityDays} von ${lm.days} Tagen) → ${eur(reduced)}`
        amount = reduced
      }
      month.parentalAllowance = round2(amount)
      month.allowanceNote = note
    })
  }

  for (const key of PARENT_KEYS) {
    for (const month of parentMonths[key]) {
      month.total = round2(month.netSalary + month.maternityBenefit + month.parentalAllowance)
    }
  }

  // Kindergeld per booked calendar month
  const childBenefit = new Array<number>(horizon).fill(0)
  for (let offset = 0; offset < horizon + 2; offset++) {
    const key = addMonthsToKey(monthKey(birth), offset)
    const index = lifeMonthForCalendarMonth(birth, key)
    if (index < 1 || index > horizon) continue
    childBenefit[index - 1] += yearParameters(parseIso(`${key}-01`).year).childBenefitMonthly * children
  }

  // Annual income relevant for the Cologne Kita fee (positive income incl. Elterngeld above 300/150 €)
  const incomeByYear = new Map<number, { sum: number; months: number; earners: Set<ParentKey> }>()
  lms.forEach((lm, i) => {
    const year = parseIso(`${primaryCalendarMonth(lm)}-01`).year
    const entry = incomeByYear.get(year) ?? { sum: 0, months: 0, earners: new Set<ParentKey>() }
    for (const key of activeParents) {
      const month = parentMonths[key][i]
      const freeAmount = month.allowance === 'basic' ? 300 : month.allowance === 'none' ? 0 : 150
      entry.sum += month.grossSalary + month.maternityBenefit + Math.max(0, month.parentalAllowance - freeAmount)
      if (month.grossSalary > 0) entry.earners.add(key)
    }
    entry.months += 1
    incomeByYear.set(year, entry)
  })
  const annualIncomeByYear: Record<number, number> = {}
  for (const [year, entry] of incomeByYear) {
    const lumpSums = entry.earners.size * yearParameters(year).employeeLumpSum
    annualIncomeByYear[year] = Math.max(0, Math.round((entry.sum * 12) / entry.months - lumpSums))
  }

  // Childcare fees and start
  const childcareFee = new Array<number>(horizon).fill(0)
  let childcareStartIndex: number | null = null
  if (config.childcare.enabled && config.childcare.startMonth) {
    childcareStartIndex = Math.max(1, lifeMonthForCalendarMonth(birth, config.childcare.startMonth))
    if (childcareStartIndex > horizon) childcareStartIndex = null
    for (let offset = 0; offset < horizon + 2; offset++) {
      const key = addMonthsToKey(config.childcare.startMonth, offset)
      const index = lifeMonthForCalendarMonth(birth, key)
      if (index < 1 || index > horizon) continue
      const year = parseIso(`${key}-01`).year
      const fee =
        config.childcare.feeMode === 'manual'
          ? config.childcare.manualFee
          : cologneFee(
              annualIncomeByYear[year] ?? annualIncomeByYear[Math.max(...Object.keys(annualIncomeByYear).map(Number))] ?? 0,
              cologneAgeCategory(birth, key),
              config.childcare.hoursPerWeek,
            )
      const meals = COLOGNE_MEAL_FEES[Math.min(5, Math.max(0, Math.round(config.childcare.mealDaysPerWeek)))]
      childcareFee[index - 1] += fee + meals
    }
  }

  // Household rows
  const initialBalance = round2(
    config.startBalance - config.oneTimeCosts.filter((c) => c.month <= 0).reduce((sum, c) => sum + c.amount, 0),
  )
  let balance = initialBalance
  const preBirthIncome = round2(activeParents.reduce((sum, key) => sum + setup[key].realNetBefore, 0))
  const months: MonthRow[] = lms.map((lm, i) => {
    const a = parentMonths.a[i]
    const b = parentMonths.b[i]
    const income = round2(a.total + b.total + childBenefit[i])
    const childCosts = config.childCosts
      .filter((c) => c.fromMonth <= lm.index && (c.toMonth === null || lm.index <= c.toMonth))
      .reduce((sum, c) => sum + c.monthly, 0)
    const oneTimeCosts = config.oneTimeCosts.filter((c) => c.month === lm.index).reduce((sum, c) => sum + c.amount, 0)
    const healthCosts = round2(a.healthCosts + b.healthCosts)
    const expenses = round2(config.fixedCostsBefore + childCosts + childcareFee[i] + healthCosts + oneTimeCosts)
    const balanceChange = round2(income - expenses)
    balance = round2(balance + balanceChange)

    const familyHours = config.support.reduce((sum, period) => {
      if (!period.from || !period.to) return sum
      const share = overlapDays(lm.start, lm.end, period.from, period.to) / lm.days
      return sum + share * period.daysPerWeek * period.hoursPerDay
    }, 0)
    const settlingIn = childcareStartIndex === lm.index
    const childcareHours =
      childcareStartIndex !== null && lm.index >= childcareStartIndex
        ? config.childcare.hoursPerWeek * (settlingIn ? 0.5 : 1)
        : 0
    const need = activeParents.length === 1 ? a.hours : Math.min(a.hours, b.hours)
    const care: CareCoverage = {
      need: round2(need),
      family: round2(familyHours),
      childcare: childcareHours,
      gap: round2(Math.max(0, need - familyHours - childcareHours)),
      settlingIn,
    }

    const markers: MonthMarker[] = []
    if (a.maternityDays > 0) markers.push('maternity')
    if (settlingIn) markers.push('childcareStart')
    if (lm.index > 1 && (lm.index - 1) % 12 === 0) markers.push('birthday')
    if (lm.index === 14 + extraMonths) markers.push('lastBasic')
    if (lm.index === PA.lastPlusMonth) markers.push('lastPlus')

    return {
      index: lm.index,
      start: lm.start,
      end: lm.end,
      days: lm.days,
      calendarMonth: primaryCalendarMonth(lm),
      a,
      b,
      childBenefit: childBenefit[i],
      income,
      preBirthIncome,
      delta: round2(income - preBirthIncome),
      fixedCosts: config.fixedCostsBefore,
      childCosts,
      childcareFee: round2(childcareFee[i]),
      healthCosts,
      oneTimeCosts,
      expenses,
      balanceChange,
      balance,
      care,
      markers,
    }
  })

  // Summaries
  const parents = Object.fromEntries(
    PARENT_KEYS.map((key) => {
      const ms = parentMonths[key]
      const counts: AllowanceCounts = {
        basic: ms.filter((m) => m.allowance === 'basic').length,
        plus: ms.filter((m) => m.allowance === 'plus').length,
        bonus: ms.filter((m) => m.allowance === 'bonus').length,
        entitlement: 0,
        allowanceMonths: ms.filter((m) => m.allowance !== 'none').length,
        leaveMonths: ms.filter((m) => m.leave).length,
        partTimeLeaveMonths: ms.filter((m) => m.leave && m.hours > 0).length,
      }
      counts.entitlement = counts.basic + counts.plus / 2
      const sum = (pick: (m: ParentMonth) => number) => round2(ms.reduce((s, m) => s + pick(m), 0))
      const income = sum((m) => m.total)
      const fullTimeNet = sum((m) => m.fullTimeNet)
      const summary: ParentSummary = {
        key,
        name: config.parents[key].name || (key === 'a' ? 'Mutter' : 'Vater'),
        active: isActive(key),
        allowanceNet: setup[key].allowanceNet,
        base: setup[key].base,
        realNetBefore: setup[key].realNetBefore,
        realNetAfter: ms[0]?.fullTimeNet ?? 0,
        averageNetAfterBasic: averages[key].basic,
        averageNetAfterPlus: averages[key].plus,
        counts,
        totals: {
          netSalary: sum((m) => m.netSalary),
          maternityBenefit: sum((m) => m.maternityBenefit),
          parentalAllowance: sum((m) => m.parentalAllowance),
          fullTimeNet,
          income,
          loss: round2(fullTimeNet - income),
        },
      }
      return [key, summary]
    }),
  ) as Record<ParentKey, ParentSummary>

  const bothUseAllowance = activeParents.length === 2 && activeParents.every((k) => parents[k].counts.allowanceMonths > 0)
  const entitlement: EntitlementSummary = {
    available:
      PA.basicMonthsJoint + extraMonths + (activeParents.length === 1 || bothUseAllowance ? PA.partnerMonths : 0),
    used: activeParents.reduce((s, k) => s + parents[k].counts.entitlement, 0),
    perParent: { a: parents.a.counts.entitlement, b: parents.b.counts.entitlement },
    perParentMax: activeParents.length === 1 ? PA.basicMonthsJoint + PA.partnerMonths + extraMonths : PA.maxBasicPerParent + extraMonths,
    bonus: { a: parents.a.counts.bonus, b: parents.b.counts.bonus },
    lastBasicMonth: PA.lastBasicMonth + extraMonths,
    extraMonthsPremature: extraMonths,
  }

  const balances = months.map((m) => m.balance)
  const minBalance = Math.min(initialBalance, ...balances)
  const minBalanceMonth = minBalance === initialBalance ? 0 : months[balances.indexOf(minBalance)].index
  const total = (pick: (m: MonthRow) => number) => round2(months.reduce((s, m) => s + pick(m), 0))
  const estimatedTaxableIncome = estimateTaxableIncome(config, activeParents)

  const result: SimulationResult = {
    birth,
    dueDate: config.dueDate,
    horizon,
    maternity,
    maternityRate,
    months,
    parents,
    activeParents,
    blocks,
    entitlement,
    childcare: { startMonthIndex: childcareStartIndex, annualIncomeByYear },
    estimatedTaxableIncome,
    vacation: computeVacation(config, months, activeParents),
    longTerm: computeLongTerm(config, months, parents, activeParents, birth),
    totals: {
      income: total((m) => m.income),
      preBirthIncome: total((m) => m.preBirthIncome),
      delta: total((m) => m.delta),
      childBenefit: total((m) => m.childBenefit),
      parentalAllowance: total((m) => m.a.parentalAllowance + m.b.parentalAllowance),
      maternityBenefit: total((m) => m.a.maternityBenefit),
      expenses: total((m) => m.expenses),
      initialBalance,
      finalBalance: months[months.length - 1]?.balance ?? initialBalance,
      minBalance,
      minBalanceMonth,
      deficitMonths: months.filter((m) => m.balanceChange < 0).length,
    },
    issues: [],
  }
  result.issues = [
    ...evaluateRules({
      config,
      blocks,
      months,
      activeParents,
      parents,
      entitlement,
      parallelBasicAllowed,
      estimatedTaxableIncome,
    }),
    ...evaluateTips(config, result, result.vacation),
  ]
  return result
}

function eur(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function pct(rate: number): string {
  return `${(rate * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}
