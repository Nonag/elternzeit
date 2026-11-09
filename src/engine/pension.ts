import { addMonthsToKey, monthKey, parseIso } from './dates'
import { CONTRIBUTION_RATES, PENSION, yearParameters } from './params'
import { round2 } from './payroll'
import type { MonthRow, ParentSummary } from './result'
import type { ParentKey, ScenarioConfig } from './types'

export interface PensionParent {
  parent: ParentKey
  insured: boolean
  /** Entgeltpunkte from salary in the plan. */
  pointsSalary: number
  /** Entgeltpunkte if the parent had worked contract hours throughout. */
  pointsReference: number
  /** Kindererziehungszeiten credited within the horizon (capped at the contribution ceiling). */
  pointsChildRaising: number
  /** Plan (salary + Kindererziehungszeiten) minus reference (salary at 100 %). */
  pointsBalance: number
  monthlyPensionBalance: number
  lifetimeBalance: number
}

export interface Compensation {
  /** Parent who bears less of the income loss and pays the compensation. */
  from: ParentKey
  to: ParentKey
  incomeTransfer: number
  incomeTransferMonthly: number
  pointsTransfer: number
  pointsCost: number
}

export interface LongTermResult {
  pension: Record<ParentKey, PensionParent>
  costPerPoint: number
  pensionValue: number
  /** Net income lost compared to both parents working contract hours (positive = loss). */
  lostIncome: number
  /** Lost savings compounded until retirement. */
  lostIncomeAtRetirement: number
  personalLoss: Record<ParentKey, number>
  compensation: Compensation | null
}

/**
 * Pension and wealth effects within the planning horizon. Entgeltpunkte = gross / Durchschnittsentgelt;
 * Kindererziehungszeiten add 1/12 point per month for 36 months after the birth month, capped at the
 * contribution ceiling.
 */
export function computeLongTerm(
  config: ScenarioConfig,
  months: MonthRow[],
  parents: Record<ParentKey, ParentSummary>,
  activeParents: ParentKey[],
  birth: string,
): LongTermResult {
  const birthMonth = monthKey(birth)
  const creditFrom = addMonthsToKey(birthMonth, 1)
  const creditTo = addMonthsToKey(birthMonth, 36)
  const creditParent = activeParents.includes(config.pensionCreditTo) ? config.pensionCreditTo : 'a'

  const pension = {} as Record<ParentKey, PensionParent>
  for (const key of ['a', 'b'] as ParentKey[]) {
    const parent = config.parents[key]
    const insured = activeParents.includes(key) && parent.pensionInsured
    let pointsSalary = 0
    let pointsReference = 0
    let pointsChildRaising = 0
    if (insured) {
      for (const row of months) {
        const p = yearParameters(parseIso(`${row.calendarMonth}-01`).year)
        const cap = p.pensionCeilingMonthly / p.averageEarnings
        const salary = Math.min(row[key].grossSalary, p.pensionCeilingMonthly) / p.averageEarnings
        pointsSalary += salary
        pointsReference += Math.min(parent.grossMonthly, p.pensionCeilingMonthly) / p.averageEarnings
        if (key === creditParent && row.calendarMonth >= creditFrom && row.calendarMonth <= creditTo) {
          pointsChildRaising += Math.max(0, Math.min(1 / 12, cap - salary))
        }
      }
    }
    const pointsBalance = pointsSalary + pointsChildRaising - pointsReference
    pension[key] = {
      parent: key,
      insured,
      pointsSalary,
      pointsReference,
      pointsChildRaising,
      pointsBalance,
      monthlyPensionBalance: round2(pointsBalance * PENSION.currentValue),
      lifetimeBalance: round2(pointsBalance * PENSION.currentValue * 12 * config.assumptions.retirementYears),
    }
  }

  const lastYear = yearParameters(9999)
  const costPerPoint = round2((CONTRIBUTION_RATES.pension / 100) * lastYear.averageEarnings)

  const rate = config.assumptions.returnRate / 100
  const totalMonths = config.assumptions.yearsToRetirement * 12
  let lostIncome = 0
  let lostIncomeAtRetirement = 0
  for (const row of months) {
    const loss = activeParents.reduce((sum, key) => sum + row[key].fullTimeNet - row[key].total, 0)
    lostIncome += loss
    const remainingYears = Math.max(0, (totalMonths - row.index) / 12)
    lostIncomeAtRetirement += loss * (1 + rate) ** remainingYears
  }

  const personalLoss = { a: parents.a.totals.loss, b: parents.b.totals.loss }
  let compensation: Compensation | null = null
  if (activeParents.length === 2) {
    const [more, less]: ParentKey[] = personalLoss.a >= personalLoss.b ? ['a', 'b'] : ['b', 'a']
    const incomeTransfer = (personalLoss[more] - personalLoss[less]) / 2
    const pointsTransfer = Math.max(0, (pension[less].pointsBalance - pension[more].pointsBalance) / 2)
    if (incomeTransfer > 50 || pointsTransfer > 0.01) {
      compensation = {
        from: less,
        to: more,
        incomeTransfer: round2(incomeTransfer),
        incomeTransferMonthly: round2(incomeTransfer / months.length),
        pointsTransfer,
        pointsCost: round2(pointsTransfer * costPerPoint),
      }
    }
  }

  return {
    pension,
    costPerPoint,
    pensionValue: PENSION.currentValue,
    lostIncome: round2(lostIncome),
    lostIncomeAtRetirement: round2(lostIncomeAtRetirement),
    personalLoss,
    compensation,
  }
}
