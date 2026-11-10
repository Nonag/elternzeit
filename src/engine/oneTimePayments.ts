import { calculate } from 'lohnsteuerrechner'
import {
  addDays,
  addMonthsToKey,
  daysInMonth,
  lastDayOfMonth,
  lifeMonthForCalendarMonth,
  monthKey,
  monthKeyToIso,
  overlapDays,
  parseIso,
  primaryCalendarMonth,
  type IsoDate,
  type LifeMonth,
} from './dates'
import type { MaternityPeriod } from './maternity'
import { CONTRIBUTION_RATES, yearParameters } from './params'
import { maxPrivateEmployerSubsidy, PAP_YEAR, round2 } from './payroll'
import type { OneTimePaymentResult, ParentMonth } from './result'
import { annualWageTaxAdjustment, incomeTax } from './tax'
import type { OneTimePayment, ParentConfig, ParentKey, ScenarioConfig } from './types'

/*
 * One-time payments from the employer (bonus, premium) are sonstige Bezüge:
 * - wage tax with the annual table (§ 39b Abs. 3 EStG) via the PAP,
 * - social contributions only up to the pro-rata contribution ceiling of the calendar year, which grows only in months
 *   with contributory salary; Mutterschutz and Elternzeit do not count (§ 23a SGB IV incl. the März-Klausel),
 * - no effect on Elterngeld (§ 2c Abs. 1 Satz 2 BEEG).
 */

export interface PaymentContext {
  config: ScenarioConfig
  birth: IsoDate
  maternity: MaternityPeriod
  /** Mutterschaftsgeld plus employer top-up per day. */
  maternityDaily: number
  lms: LifeMonth[]
  parentMonths: Record<ParentKey, ParentMonth[]>
  activeParents: ParentKey[]
  /** Kinderfreibetragszähler after the birth. */
  childAllowances: Record<ParentKey, number>
}

interface CalendarIncome {
  /** Regular gross salary of the calendar month. */
  gross: number
  /** Share of the month with contributory salary. */
  insured: number
}

type IncomeLookup = (month: string) => CalendarIncome

interface Contributions {
  health: number
  care: number
  pension: number
  unemployment: number
  pensionBase: number
  contributionYear: number
  insuredMonths: number
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const ALTERNATIVE_OFFSETS = [-1, 1, -2, 2, -3, 3]
const MIN_SAVING = 50

function cents(value: number): number {
  return Math.round(value * 100)
}

function keyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function yearOf(month: string): number {
  return parseIso(monthKeyToIso(month)).year
}

function byMonth(a: OneTimePayment, b: OneTimePayment): number {
  return a.month < b.month ? -1 : a.month > b.month ? 1 : 0
}

/** Regular salary per calendar month: simulated life months, before them the contract salary, after them the last month. */
function calendarIncome(ctx: PaymentContext, key: ParentKey): IncomeLookup {
  const parent = ctx.config.parents[key]
  const indexByMonth = new Map(ctx.lms.map((lm, i) => [primaryCalendarMonth(lm), i]))
  const first = primaryCalendarMonth(ctx.lms[0])
  const fromLifeMonth = (i: number): CalendarIncome => {
    const month = ctx.parentMonths[key][i]
    const lm = ctx.lms[i]
    return { gross: month.grossSalary, insured: month.grossSalary > 0 ? (lm.days - month.maternityDays) / lm.days : 0 }
  }
  return (month) => {
    const index = indexByMonth.get(month)
    if (index !== undefined) return fromLifeMonth(index)
    if (month > first) return fromLifeMonth(ctx.lms.length - 1)
    const { year, month: m } = parseIso(monthKeyToIso(month))
    const days = daysInMonth(year, m)
    const protectedDays = key === 'a' ? overlapDays(monthKeyToIso(month), lastDayOfMonth(month), ctx.maternity.start, ctx.maternity.end) : 0
    const share = (days - protectedDays) / days
    return { gross: parent.grossMonthly * share, insured: parent.grossMonthly > 0 ? share : 0 }
  }
}

/** Pro-rata contribution ceiling minus the regular contributory salary from January until `untilMonth`. */
function contributionRoom(income: IncomeLookup, year: number, untilMonth: number, ceilingMonthly: number) {
  let free = 0
  let insuredMonths = 0
  for (let m = 1; m <= untilMonth; m++) {
    const { gross, insured } = income(keyOf(year, m))
    if (insured <= 0) continue
    insuredMonths++
    free += Math.max(0, ceilingMonthly * insured - gross)
  }
  return { free, insuredMonths }
}

/** Employee social contributions on one parent's payments, processed in payout order (§ 23a SGB IV). */
function assignContributions(
  payments: OneTimePayment[],
  parent: ParentConfig,
  income: IncomeLookup,
  birthMonth: string,
): Map<string, Contributions> {
  const used = new Map<number, { health: number; pension: number }>()
  const usedIn = (year: number) => used.get(year) ?? { health: 0, pension: 0 }
  // Only the KV ceiling decides for compulsory members, otherwise the pension ceiling (§ 23a Abs. 5 SGB IV).
  const decisive = parent.healthInsurance === 'statutory' ? 'health' : 'pension'
  const available = (year: number, untilMonth: number) => {
    const p = yearParameters(year)
    const health = contributionRoom(income, year, untilMonth, p.healthCeilingMonthly)
    const pension = contributionRoom(income, year, untilMonth, p.pensionCeilingMonthly)
    return {
      health: Math.max(0, health.free - usedIn(year).health),
      pension: Math.max(0, pension.free - usedIn(year).pension),
      insuredMonths: health.insuredMonths,
    }
  }

  const result = new Map<string, Contributions>()
  for (const payment of payments) {
    const { year, month } = parseIso(monthKeyToIso(payment.month))
    let contributionYear = year
    let room = available(year, month)
    // März-Klausel: a payout from January to March above this year's ceiling counts for the previous year.
    if (month <= 3 && payment.gross > room[decisive]) {
      contributionYear = year - 1
      room = available(contributionYear, 12)
    }
    const healthBase = parent.healthInsurance === 'private' ? 0 : Math.min(payment.gross, room.health)
    const pensionBase = parent.pensionInsured ? Math.min(payment.gross, room.pension) : 0
    const before = usedIn(contributionYear)
    used.set(contributionYear, { health: before.health + healthBase, pension: before.pension + pensionBase })
    const childless = payment.month < birthMonth
    const careRate = CONTRIBUTION_RATES.careEmployee + (childless ? yearParameters(contributionYear).careChildlessSurcharge : 0)
    result.set(payment.id, {
      health: round2(healthBase * ((CONTRIBUTION_RATES.healthGeneral / 2 + parent.healthAdditionalRate / 2) / 100)),
      care: round2(healthBase * (careRate / 100)),
      pension: round2(pensionBase * (CONTRIBUTION_RATES.pension / 2 / 100)),
      unemployment: round2(pensionBase * (CONTRIBUTION_RATES.unemployment / 2 / 100)),
      pensionBase: round2(pensionBase),
      contributionYear,
      insuredMonths: room.insuredMonths,
    })
  }
  return result
}

function contributionTotal(contributions: Map<string, Contributions>): number {
  let total = 0
  for (const c of contributions.values()) total += c.health + c.care + c.pension + c.unemployment
  return round2(total)
}

interface PaymentTax {
  tax: number
  solidarity: number
  churchBase: number
}

const taxCache = new Map<string, PaymentTax>()

/** Wage tax on a sonstiger Bezug with the annual table; 2027+ adds the tariff change like the monthly wage tax. */
function paymentWageTax(input: {
  year: number
  /** Expected annual wage without this payment (regular salary plus earlier payments of the year). */
  annualWage: number
  gross: number
  parent: ParentConfig
  afterBirth: boolean
  childAllowances: number
}): PaymentTax {
  const { parent } = input
  const taxClass = input.afterBirth ? (parent.taxClassAfterBirth ?? parent.taxClass) : parent.taxClass
  const isPrivate = parent.healthInsurance === 'private'
  const subsidy = isPrivate ? Math.min(parent.privatePremium / 2, maxPrivateEmployerSubsidy(input.year)) : 0
  const usesFactor = taxClass === 4 && parent.taxFactor != null && parent.taxFactor > 0 && parent.taxFactor < 1
  const inputs = {
    LZZ: 1,
    RE4: cents(input.annualWage),
    JRE4: cents(input.annualWage),
    SONSTB: cents(input.gross),
    STKL: taxClass,
    ZKF: taxClass <= 4 ? input.childAllowances : 0,
    R: parent.churchTax ? 1 : 0,
    KVZ: parent.healthAdditionalRate,
    PVZ: input.afterBirth ? 0 : 1,
    PVA: 0,
    PKV: isPrivate ? 1 : 0,
    PKPV: isPrivate ? cents(parent.privatePremium) : 0,
    PKPVAGZ: isPrivate ? cents(subsidy) : 0,
    KRV: parent.pensionInsured ? 0 : 1,
    ALV: parent.pensionInsured ? 0 : 1,
    ...(usesFactor ? { af: 1, f: parent.taxFactor ?? 1 } : {}),
  }
  const key = `${input.year}|${JSON.stringify(inputs)}`
  const cached = taxCache.get(key)
  if (cached) return cached

  const result = calculate(PAP_YEAR, inputs)
  const adjustmentInput = {
    year: input.year,
    taxClass,
    pensionInsured: parent.pensionInsured,
    healthInsurance: parent.healthInsurance,
    healthAdditionalRate: parent.healthAdditionalRate,
    privatePremium: parent.privatePremium,
    privateEmployerSubsidy: subsidy,
    childless: !input.afterBirth,
  }
  const adjustment =
    annualWageTaxAdjustment({ ...adjustmentInput, annualGross: input.annualWage + input.gross }) -
    annualWageTaxAdjustment({ ...adjustmentInput, annualGross: input.annualWage })
  const value: PaymentTax = {
    tax: Math.max(0, result.STS / 100 - adjustment),
    solidarity: result.SOLZS / 100,
    churchBase: Math.max(0, result.BKS / 100 - adjustment),
  }
  if (taxCache.size > 2000) taxCache.clear()
  taxCache.set(key, value)
  return value
}

/** Income tax with Progressionsvorbehalt (§ 32b EStG) and splitting for married couples. */
function taxWithProgression(taxable: number, benefits: number, year: number, splitting: boolean): number {
  if (taxable <= 0) return 0
  const tariff = (x: number) => (splitting ? 2 * incomeTax(x / 2, year) : incomeTax(x, year))
  if (benefits <= 0) return tariff(taxable)
  const total = taxable + benefits
  return Math.floor((taxable * tariff(total)) / total)
}

/** Deductible social contributions (Vorsorgeaufwendungen), roughly from the annual wage. */
function deductibleContributions(parent: ParentConfig, annualGross: number, year: number): number {
  const p = yearParameters(year)
  const pension = parent.pensionInsured ? Math.min(annualGross, p.pensionCeilingMonthly * 12) * (CONTRIBUTION_RATES.pension / 2 / 100) : 0
  if (parent.healthInsurance === 'private') return pension + (parent.privatePremium * 12) / 2
  const rate = CONTRIBUTION_RATES.healthReduced / 2 + parent.healthAdditionalRate / 2 + CONTRIBUTION_RATES.careEmployee
  return pension + Math.min(annualGross, p.healthCeilingMonthly * 12) * (rate / 100)
}

/**
 * Rough effect of a payment on the tax return of its year: income tax with the payment minus without it,
 * minus the tax withheld at the payout. Ignores Werbungskosten, other deductions and the Soli.
 */
function estimateTaxReturn(
  ctx: PaymentContext,
  key: ParentKey,
  payment: OneTimePayment,
  deductible: number,
  withheld: number,
  incomes: Record<ParentKey, IncomeLookup>,
  payments: Map<ParentKey, OneTimePayment[]>,
): { effect: number; benefits: number } {
  const year = yearOf(payment.month)
  const married = ctx.config.relationship === 'married'
  const scope = married ? ctx.activeParents : [key]
  const lumpSum = yearParameters(year).employeeLumpSum

  const benefitsOf = (k: ParentKey) => {
    let sum = 0
    ctx.lms.forEach((lm, i) => {
      if (yearOf(primaryCalendarMonth(lm)) === year) sum += ctx.parentMonths[k][i].parentalAllowance + ctx.parentMonths[k][i].maternityBenefit
    })
    if (k === 'a') sum += overlapDays(`${year}-01-01`, `${year}-12-31`, ctx.maternity.start, addDays(ctx.birth, -1)) * ctx.maternityDaily
    return sum
  }

  const parts = (k: ParentKey, extra: number, extraDeductible: number) => {
    let wages = 0
    for (let m = 1; m <= 12; m++) wages += incomes[k](keyOf(year, m)).gross
    for (const other of payments.get(k) ?? []) {
      if (other.id !== payment.id && yearOf(other.month) === year) wages += other.gross
    }
    const provision = deductibleContributions(ctx.config.parents[k], wages, year) + extraDeductible
    const total = wages + extra
    const usedLumpSum = Math.min(total, lumpSum)
    return {
      taxable: Math.max(0, total - usedLumpSum - provision - 36),
      // An unused Arbeitnehmer-Pauschbetrag reduces Elterngeld and Mutterschaftsleistungen (§ 32b Abs. 2 Nr. 1 EStG).
      benefits: Math.max(0, benefitsOf(k) - (lumpSum - usedLumpSum)),
    }
  }

  const total = (withPayment: boolean) =>
    scope
      .map((k) => (withPayment && k === key ? parts(k, payment.gross, deductible) : parts(k, 0, 0)))
      .reduce((sum, p) => ({ taxable: sum.taxable + p.taxable, benefits: sum.benefits + p.benefits }), { taxable: 0, benefits: 0 })
  const without = total(false)
  const withPayment = total(true)
  const taxDifference =
    taxWithProgression(withPayment.taxable, withPayment.benefits, year, married) - taxWithProgression(without.taxable, without.benefits, year, married)
  const church = ctx.config.parents[key].churchTax ? 1 + ctx.config.churchTaxRate : 1
  return { effect: round2(taxDifference * church - withheld), benefits: round2(scope.reduce((sum, k) => sum + benefitsOf(k), 0)) }
}

function validPayments(payments: OneTimePayment[] | undefined): OneTimePayment[] {
  return (payments ?? []).filter((p) => MONTH_PATTERN.test(p.month) && p.gross > 0).sort(byMonth)
}

export function computeOneTimePayments(ctx: PaymentContext): OneTimePaymentResult[] {
  const birthMonth = monthKey(ctx.birth)
  const incomes = {} as Record<ParentKey, IncomeLookup>
  const payments = new Map<ParentKey, OneTimePayment[]>()
  for (const key of ctx.activeParents) {
    incomes[key] = calendarIncome(ctx, key)
    payments.set(key, validPayments(ctx.config.parents[key].oneTimePayments))
  }

  const results: OneTimePaymentResult[] = []
  for (const key of ctx.activeParents) {
    const parent = ctx.config.parents[key]
    const list = payments.get(key) ?? []
    if (!list.length) continue
    const income = incomes[key]
    const contributions = assignContributions(list, parent, income, birthMonth)
    const currentTotal = contributionTotal(contributions)
    const paidBefore = new Map<number, number>()

    for (const payment of list) {
      const year = yearOf(payment.month)
      let annualWage = paidBefore.get(year) ?? 0
      for (let m = 1; m <= 12; m++) annualWage += income(keyOf(year, m)).gross
      paidBefore.set(year, (paidBefore.get(year) ?? 0) + payment.gross)

      const afterBirth = payment.month >= birthMonth
      const wageTax = paymentWageTax({
        year,
        annualWage,
        gross: payment.gross,
        parent,
        afterBirth,
        childAllowances: afterBirth ? ctx.childAllowances[key] : 0,
      })
      const churchTax = parent.churchTax ? wageTax.churchBase * ctx.config.churchTaxRate : 0
      const tax = round2(wageTax.tax + wageTax.solidarity + churchTax)
      const c = contributions.get(payment.id)!
      const contributionSum = round2(c.health + c.care + c.pension + c.unemployment)

      // Nearby payout months with lower social contributions; the other payments keep their months.
      let betterMonth: OneTimePaymentResult['betterMonth'] = null
      for (const offset of ALTERNATIVE_OFFSETS) {
        const month = addMonthsToKey(payment.month, offset)
        const moved = list.map((p) => (p.id === payment.id ? { ...p, month } : p)).sort(byMonth)
        const saving = round2(currentTotal - contributionTotal(assignContributions(moved, parent, income, birthMonth)))
        if (saving >= MIN_SAVING && (!betterMonth || saving > betterMonth.saving)) betterMonth = { month, saving }
      }

      const estimate = estimateTaxReturn(ctx, key, payment, c.pension + c.health + c.care, tax, incomes, payments)
      results.push({
        id: payment.id,
        parent: key,
        label: payment.label.trim() || 'Einmalzahlung',
        month: payment.month,
        lifeMonth: lifeMonthForCalendarMonth(ctx.birth, payment.month),
        gross: round2(payment.gross),
        tax,
        contributions: contributionSum,
        net: round2(payment.gross - tax - contributionSum),
        pensionBase: c.pensionBase,
        contributionYear: c.contributionYear,
        insuredMonths: c.insuredMonths,
        betterMonth,
        taxReturnEffect: estimate.effect,
        benefitsInTaxYear: estimate.benefits > 0,
      })
    }
  }
  return results
}
