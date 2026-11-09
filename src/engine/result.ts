import type { IsoDate } from './dates'
import type { MaternityBenefitRate, MaternityPeriod } from './maternity'
import type { AllowanceBase, AllowanceNetResult } from './parentalAllowance'
import type { LongTermResult } from './pension'
import type { AllowanceVariant, ParentKey, PlanBlock } from './types'
import type { VacationSummary } from './vacation'

export interface ParentMonth {
  active: boolean
  leave: boolean
  /** Weekly working hours (0 while not working). */
  hours: number
  allowance: AllowanceVariant
  maternityDays: number
  /** Allowance forced to Basiselterngeld because of Mutterschaftsleistungen. */
  maternityLocked: boolean
  grossSalary: number
  netSalary: number
  maternityBenefit: number
  parentalAllowance: number
  /** Elterngeld-Netto of the income in this month (basis for the income average). */
  allowanceNetAfter: number
  allowanceNote: string
  /** Extra health insurance costs while not earning (private premium, voluntary minimum contribution). */
  healthCosts: number
  /** Net pay at contract hours after birth (used for the personal income loss). */
  fullTimeNet: number
  total: number
  blockId: string | null
}

export interface CareCoverage {
  /** Hours per week in which both parents work at the same time. */
  need: number
  family: number
  childcare: number
  gap: number
  settlingIn: boolean
}

export type MonthMarker = 'maternity' | 'childcareStart' | 'birthday' | 'lastBasic' | 'lastPlus'

export interface MonthRow {
  index: number
  start: IsoDate
  end: IsoDate
  days: number
  calendarMonth: string
  a: ParentMonth
  b: ParentMonth
  childBenefit: number
  income: number
  /** Household net pay before the birth (both at contract hours). */
  preBirthIncome: number
  /** Income minus net pay before the birth. */
  delta: number
  fixedCosts: number
  childCosts: number
  childcareFee: number
  healthCosts: number
  oneTimeCosts: number
  expenses: number
  balanceChange: number
  balance: number
  care: CareCoverage
  markers: MonthMarker[]
}

export interface AllowanceCounts {
  basic: number
  plus: number
  bonus: number
  /** Used Monatsbeträge: Basis + Plus / 2 (without Partnerschaftsbonus). */
  entitlement: number
  allowanceMonths: number
  leaveMonths: number
  partTimeLeaveMonths: number
}

export interface ParentSummary {
  key: ParentKey
  name: string
  active: boolean
  allowanceNet: AllowanceNetResult
  base: AllowanceBase
  realNetBefore: number
  realNetAfter: number
  averageNetAfterBasic: number | null
  averageNetAfterPlus: number | null
  counts: AllowanceCounts
  totals: {
    netSalary: number
    maternityBenefit: number
    parentalAllowance: number
    fullTimeNet: number
    income: number
    /** Full-time net after birth minus actual income (net pay, Mutterschaftsleistungen, Elterngeld). */
    loss: number
  }
}

export type IssueSeverity = 'error' | 'warning' | 'info' | 'success'
export type IssueCategory = 'allowance' | 'leave' | 'care' | 'finance' | 'general'

export interface Issue {
  id: string
  severity: IssueSeverity
  category: IssueCategory
  title: string
  detail?: string
  parent?: ParentKey
  months?: number[]
  /** Estimated effect in euros (positive = possible gain). */
  impact?: number
}

export interface EntitlementSummary {
  available: number
  used: number
  perParent: Record<ParentKey, number>
  perParentMax: number
  bonus: Record<ParentKey, number>
  lastBasicMonth: number
  extraMonthsPremature: number
}

export interface SimulationResult {
  birth: IsoDate
  dueDate: IsoDate
  horizon: number
  maternity: MaternityPeriod
  maternityRate: MaternityBenefitRate
  months: MonthRow[]
  parents: Record<ParentKey, ParentSummary>
  activeParents: ParentKey[]
  blocks: Record<ParentKey, PlanBlock[]>
  entitlement: EntitlementSummary
  childcare: {
    startMonthIndex: number | null
    annualIncomeByYear: Record<number, number>
  }
  estimatedTaxableIncome: number
  vacation: Record<ParentKey, VacationSummary>
  longTerm: LongTermResult
  totals: {
    income: number
    preBirthIncome: number
    delta: number
    childBenefit: number
    parentalAllowance: number
    maternityBenefit: number
    expenses: number
    initialBalance: number
    finalBalance: number
    minBalance: number
    minBalanceMonth: number
    deficitMonths: number
  }
  issues: Issue[]
}
