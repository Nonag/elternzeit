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
import { computeOneTimePayments } from './oneTimePayments'
import { PARENTAL_ALLOWANCE as PA, WORKING_TIME, yearParameters } from './params'
import {
  basicWithIncome,
  computeAllowanceBase,
  computeAllowanceNet,
  plusWithIncome,
  type AllowanceSupplements,
} from './parentalAllowance'
import { euro, percent } from './format'
import { round2 } from './math'
import { computePayroll, voluntaryMinimumContribution } from './payroll'
import { computeLongTerm } from './pension'
import { expandPeriods, normalizePeriods, type MonthPlan } from './plan'
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
import type { ParentConfig, ParentKey, PlanPeriod, RelationshipStatus, VariantConfig, TaxClass } from './types'
import { computeVacation, planVacation, type PlannedVacation, type WorkMonth } from './vacation'

const PARENT_KEYS: ParentKey[] = ['a', 'b']

const EMPTY_MONTH: ParentMonth = {
  active: false,
  leave: false,
  vacationDays: 0,
  vacationShare: 0,
  hours: 0,
  workDays: 0,
  allowance: 'none',
  maternityDays: 0,
  maternityLocked: false,
  grossSalary: 0,
  netSalary: 0,
  maternityBenefit: 0,
  parentalAllowance: 0,
  oneTimePayments: 0,
  oneTimePensionBase: 0,
  allowanceNetAfter: 0,
  allowanceNote: '',
  healthCosts: 0,
  fullTimeNet: 0,
  total: 0,
  periodId: null,
}

/** Kinderfreibetragszähler after birth (only affects Soli and church tax). */
function childAllowanceCount(relationship: RelationshipStatus | null, taxClass: TaxClass, children: number): number {
  if (taxClass >= 5) return 0
  return (relationship === 'married' ? 1 : 0.5) * children
}

/** Additional Basis months after a premature birth (§ 4 Abs. 5 BEEG). */
function prematureExtraMonths(dueDate: string, birth: string): number {
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

/**
 * Care per week, day by day. Parents place their working days so that as few as possible fall on the same weekday;
 * on those shared days (every working day of a single parent) the child needs care for the shorter working day.
 * The Kita spreads its hours over the weekdays, family and friends come on whole days, and both only help there.
 */
function careCoverage(parents: ParentMonth[], family: { days: number; hours: number }, childcare: number, settlingIn: boolean): CareCoverage {
  const working = parents.map((m) => (m.hours > 0 ? { days: m.workDays * (1 - m.vacationShare), perDay: m.hours / m.workDays } : { days: 0, perDay: 0 }))
  const [first, second] = working
  const days = second ? Math.min(Math.max(0, first.days + second.days - WORKING_TIME.weekdays), first.days, second.days) : first.days
  const perDay = days > 0 ? Math.min(...working.map((w) => w.perDay)) : 0
  const childcarePerDay = Math.min(perDay, childcare / WORKING_TIME.weekdays)
  const familyPerDay = family.days > 0 ? Math.min(perDay - childcarePerDay, family.hours / family.days) : 0
  const need = days * perDay
  const childcareCovered = days * childcarePerDay
  const familyCovered = Math.min(days, family.days) * familyPerDay
  return {
    need: round2(need),
    family: round2(family.hours),
    childcare,
    familyCovered: round2(familyCovered),
    childcareCovered: round2(childcareCovered),
    gap: round2(Math.max(0, need - childcareCovered - familyCovered)),
    settlingIn,
  }
}

function effectivePeriods(config: VariantConfig): Record<ParentKey, PlanPeriod[]> {
  return {
    a: normalizePeriods(config.periods.a),
    b: config.relationship === 'single' ? [] : normalizePeriods(config.periods.b),
  }
}

/** Rough zvE estimate for the income limit check (wages minus lump sums and social contributions). */
function estimateTaxableIncome(config: VariantConfig, activeParents: ParentKey[]): number {
  let total = 0
  for (const key of activeParents) {
    const parent = config.parents[key]
    const gross = parent.grossMonthly
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

export function simulate(config: VariantConfig): SimulationResult {
  const birth = config.birthDate ?? config.dueDate
  const horizon = Math.min(96, Math.max(12, Math.round(config.horizonMonths)))
  const lms = lifeMonths(birth, horizon)
  const activeParents: ParentKey[] = config.relationship === 'single' ? ['a'] : ['a', 'b']
  const isActive = (key: ParentKey) => activeParents.includes(key)
  const periods = effectivePeriods(config)
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
      const allowanceNet = computeAllowanceNet({ ...allowanceNetInput, gross: parent.grossMonthly })
      const base = computeAllowanceBase(allowanceNet.net, supplements)
      const plan: MonthPlan[] = expandPeriods(periods[key], horizon, parent.weeklyHours)
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

  // Paid vacation, day by day (none during Elternzeit without work and Mutterschutz)
  const plannedVacation = Object.fromEntries(
    PARENT_KEYS.map((key) => {
      const contractDays = config.parents[key].workDaysPerWeek
      const months: WorkMonth[] = lms.map((lm, i) => {
        const plan = setup[key].plan[i]
        const workDays = plan.hours > 0 && plan.workDays !== null ? plan.workDays : contractDays
        return { start: lm.start, end: lm.end, leave: plan.leave, hours: plan.hours, workDays }
      })
      return [key, planVacation(isActive(key) ? config.vacation[key] : [], lms, months, key === 'a' ? maternity.end : null)]
    }),
  ) as Record<ParentKey, PlannedVacation>

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
        vacationDays: round2(plannedVacation[key].days[lm.index - 1]),
        vacationShare: plannedVacation[key].shares[lm.index - 1],
        hours: round2(hours * workFraction),
        workDays: hours > 0 && planMonth.workDays !== null ? planMonth.workDays : parent.workDaysPerWeek,
        allowance: maternityLocked ? 'basic' : planMonth.allowance,
        maternityDays,
        maternityLocked,
        grossSalary,
        netSalary,
        maternityBenefit,
        parentalAllowance: 0,
        oneTimePayments: 0,
        oneTimePensionBase: 0,
        allowanceNetAfter: 0,
        allowanceNote: '',
        healthCosts: round2(healthCosts),
        fullTimeNet: reference.net,
        total: 0,
        periodId: planMonth.periodId,
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
        ? `${variantLabel} mit Zuverdienst: ${percent(base.rate)} × (${euro(Math.min(base.netBefore, PA.incomeCapForDifference), true)} − Ø ${euro(
            (isBasic ? avgBasic : avgPlus) ?? 0,
            true,
          )} Elterngeld-Netto) = ${euro(amount, true)}${isBasic ? '' : ' (max. halbes Basiselterngeld)'}`
        : `${variantLabel}: ${percent(base.rate)} × ${euro(base.netBefore, true)} Elterngeld-Netto${isBasic ? '' : ' ÷ 2'} = ${euro(amount, true)}`
      if (month.maternityDays > 0) {
        const daily = amount / lm.days
        const uncovered = lm.days - month.maternityDays
        const covered = month.maternityDays * Math.max(0, daily - maternityRate.totalDaily)
        const reduced = uncovered * daily + covered
        note += `; Mutterschaftsleistungen werden tageweise angerechnet (${month.maternityDays} von ${lm.days} Tagen) → ${euro(reduced, true)}`
        amount = reduced
      }
      month.parentalAllowance = round2(amount)
      month.allowanceNote = note
    })
  }

  // One-time employer payments (no effect on Elterngeld)
  const oneTimePayments = computeOneTimePayments({
    config,
    birth,
    maternity,
    maternityDaily: maternityRate.totalDaily,
    lms,
    parentMonths,
    activeParents,
    childAllowances: {
      a: childAllowanceCount(config.relationship, config.parents.a.taxClassAfterBirth ?? config.parents.a.taxClass, children),
      b: childAllowanceCount(config.relationship, config.parents.b.taxClassAfterBirth ?? config.parents.b.taxClass, children),
    },
  })
  for (const payment of oneTimePayments) {
    if (payment.lifeMonth < 1 || payment.lifeMonth > horizon) continue
    const month = parentMonths[payment.parent][payment.lifeMonth - 1]
    month.oneTimePayments = round2(month.oneTimePayments + payment.net)
    month.oneTimePensionBase = round2(month.oneTimePensionBase + payment.pensionBase)
  }

  for (const key of PARENT_KEYS) {
    for (const month of parentMonths[key]) {
      month.total = round2(month.netSalary + month.maternityBenefit + month.parentalAllowance + month.oneTimePayments)
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
  // One-time payments count in the year of the payout, without annualising.
  for (const payment of oneTimePayments) {
    const year = Number(payment.month.slice(0, 4))
    const entry = incomeByYear.get(year)
    if (!entry) continue
    const lumpSum = entry.earners.has(payment.parent) ? 0 : Math.min(payment.gross, yearParameters(year).employeeLumpSum)
    entry.earners.add(payment.parent)
    annualIncomeByYear[year] = Math.max(0, Math.round(annualIncomeByYear[year] + payment.gross - lumpSum))
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
    config.balanceAtBirth -
      config.oneTimeCosts.filter((c) => c.month <= 0).reduce((sum, c) => sum + c.amount, 0) +
      oneTimePayments.filter((p) => p.lifeMonth === 0).reduce((sum, p) => sum + p.net, 0),
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
    const expenses = round2(config.fixedCosts + childCosts + childcareFee[i] + healthCosts + oneTimeCosts)
    const balanceChange = round2(income - expenses)
    balance = round2(balance + balanceChange)

    const family = config.familyCare.reduce(
      (sum, period) => {
        if (!period.from || !period.to) return sum
        const share = overlapDays(lm.start, lm.end, period.from, period.to) / lm.days
        return { days: sum.days + share * period.daysPerWeek, hours: sum.hours + share * period.daysPerWeek * period.hoursPerDay }
      },
      { days: 0, hours: 0 },
    )
    const settlingIn = childcareStartIndex === lm.index
    const childcareHours =
      childcareStartIndex !== null && lm.index >= childcareStartIndex
        ? config.childcare.hoursPerWeek * (settlingIn ? 0.5 : 1)
        : 0
    const care = careCoverage(activeParents.length === 1 ? [a] : [a, b], family, childcareHours, settlingIn)

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
      fixedCosts: config.fixedCosts,
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
    periods,
    entitlement,
    childcare: { startMonthIndex: childcareStartIndex, annualIncomeByYear },
    estimatedTaxableIncome,
    oneTimePayments,
    vacation: computeVacation(config, months, activeParents, plannedVacation),
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
      periods,
      months,
      activeParents,
      parents,
      entitlement,
      parallelBasicAllowed,
      estimatedTaxableIncome,
      vacation: result.vacation,
    }),
    ...evaluateTips(config, result, result.vacation),
  ]
  return result
}
