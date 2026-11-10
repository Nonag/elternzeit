import type { IsoDate } from './dates'

export type ParentKey = 'a' | 'b'
export type TaxClass = 1 | 2 | 3 | 4 | 5 | 6
export type RelationshipStatus = 'married' | 'unmarried' | 'single'
export type HealthInsurance = 'statutory' | 'statutoryVoluntary' | 'private'
export type AllowanceVariant = 'none' | 'basic' | 'plus' | 'bonus'
export type QuickAllowance = 'none' | 'basic' | 'plus'

export interface ParentConfig {
  name: string
  /** Regular monthly gross salary at contract hours (laufender Arbeitslohn). */
  grossMonthly: number
  /** Average gross in the Bemessungszeitraum if it differs from `grossMonthly`. */
  allowanceGross: number | null
  weeklyHours: number
  workDaysPerWeek: number
  /** Tax class valid during the Bemessungszeitraum (and until birth). */
  taxClass: TaxClass
  /** Optional tax class from birth on (affects real net pay only, not Elterngeld). */
  taxClassAfterBirth: TaxClass | null
  taxFactor: number | null
  churchTax: boolean
  healthInsurance: HealthInsurance
  /** Individual KV-Zusatzbeitrag in percent. */
  healthAdditionalRate: number
  /** Monthly private health and care premium (only for private insurance). */
  privatePremium: number
  pensionInsured: boolean
  vacationDaysPerYear: number
  employerOver15: boolean
  employedOver6Months: boolean
  /** One-time payments from the employer (bonus, premium), taxed as sonstige Bezüge. */
  oneTimePayments: OneTimePayment[]
}

export interface OneTimePayment {
  id: string
  label: string
  gross: number
  /** Calendar month of the payout ('YYYY-MM'). */
  month: string
}

export interface PlanBlock {
  id: string
  /** First life month (1-based). */
  from: number
  /** Last life month (inclusive). */
  to: number
  /** Parental leave (Elternzeit) in this period. */
  leave: boolean
  /** Weekly working hours in this period (null = not entered yet). */
  hours: number | null
  allowance: AllowanceVariant
}

export interface QuickParentPlan {
  start: number
  leaveMonths: number
  leaveAllowance: QuickAllowance
  partTimeMonths: number
  partTimeHours: number
  partTimeAllowance: QuickAllowance
}

export interface QuickPlan {
  a: QuickParentPlan
  b: QuickParentPlan
  bonusMonths: number
  /** First life month of the Partnerschaftsbonus (null = directly after both full-time leaves). */
  bonusStart: number | null
  bonusHours: number
}

export interface SupportPeriod {
  id: string
  label: string
  from: IsoDate
  to: IsoDate
  daysPerWeek: number
  hoursPerDay: number
}

export interface CostItem {
  id: string
  label: string
  monthly: number
  fromMonth: number
  /** Last life month (inclusive); null = until the end of the horizon. */
  toMonth: number | null
}

export interface OneTimeCost {
  id: string
  label: string
  amount: number
  /** Life month in which the cost occurs; 0 = before birth. */
  month: number
}

export type ChildcareHours = 25 | 35 | 45

export interface ChildcareConfig {
  enabled: boolean
  /** First month of childcare ('YYYY-MM'). */
  startMonth: string
  hoursPerWeek: ChildcareHours
  feeMode: 'cologne' | 'manual'
  manualFee: number
  mealDaysPerWeek: number
}

export interface ScenarioConfig {
  version: 1
  relationship: RelationshipStatus
  dueDate: IsoDate
  /** Actual birth date once known; null = due date. */
  birthDate: IsoDate | null
  /** Number of children born (1 = no multiples). */
  children: number
  /** 12 instead of 8 weeks of Mutterschutz after birth (premature birth, multiples, disability). */
  extendedMaternity: boolean
  siblingBonus: boolean
  churchTaxRate: number
  horizonMonths: number
  blocks: Record<ParentKey, PlanBlock[]>
  parents: Record<ParentKey, ParentConfig>
  fixedCostsBefore: number
  childCosts: CostItem[]
  oneTimeCosts: OneTimeCost[]
  childcare: ChildcareConfig
  support: SupportPeriod[]
  startBalance: number
  minReserve: number
  employerReducesVacation: boolean
  /** Parent who receives the Kindererziehungszeiten (pension credits). */
  pensionCreditTo: ParentKey
  assumptions: LongTermAssumptions
  /** Ids of checklist deadlines marked as done. */
  doneDeadlines: string[]
}

export interface LongTermAssumptions {
  /** Annual return of savings in percent. */
  returnRate: number
  yearsToRetirement: number
  retirementYears: number
}
