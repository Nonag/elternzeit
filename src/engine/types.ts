import type { IsoDate } from './dates'

export type ParentKey = 'a' | 'b'
export type TaxClass = 1 | 2 | 3 | 4 | 5 | 6
export type RelationshipStatus = 'married' | 'unmarried' | 'single'
export type HealthInsurance = 'statutory' | 'statutoryVoluntary' | 'private'
export type AllowanceType = 'none' | 'basic' | 'plus' | 'bonus'
export type OutlineAllowance = 'none' | 'basic' | 'plus'
/** "Art" of a plan period: Elternzeit or work with other hours. */
export type PeriodKind = 'leave' | 'work'

export interface ParentConfig {
  name: string
  /** Regular monthly gross salary at contract hours (laufender Arbeitslohn). */
  grossMonthly: number
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
  /** null until entered; incomplete entries are left out of the calculation. */
  gross: number | null
  /** Calendar month of the payout ('YYYY-MM'), '' until picked. */
  month: string
}

export interface PlanPeriod {
  id: string
  /** First life month (1-based). */
  from: number
  /** Last life month (inclusive). */
  to: number
  kind: PeriodKind
  /** Weekly working hours in this period (null = not entered yet). */
  hours: number | null
  /** Working days per week while working (null = as in the contract); sets the vacation entitlement. */
  workDays: number | null
  allowance: AllowanceType
}

export interface ParentPlanOutline {
  start: number
  leaveMonths: number
  leaveAllowance: OutlineAllowance
  partTimeMonths: number
  partTimeHours: number
  partTimeAllowance: OutlineAllowance
}

export interface PlanOutline {
  a: ParentPlanOutline
  b: ParentPlanOutline
  bonusMonths: number
  /** First life month of the Partnerschaftsbonus (null = directly after both full-time leaves). */
  bonusStart: number | null
  bonusHours: number
}

/** Paid vacation in whole weeks ("Urlaub"); empty dates until the weeks are picked. */
export interface VacationPeriod {
  id: string
  /** Monday of the first week. */
  from: IsoDate
  /** Sunday of the last week; only Monday to Friday cost vacation days. */
  to: IsoDate
}

export interface FamilyCarePeriod {
  id: string
  label: string
  /** '' until picked; incomplete entries are left out of the calculation. */
  from: IsoDate
  to: IsoDate
  daysPerWeek: number | null
  hoursPerDay: number | null
}

export interface CostItem {
  id: string
  label: string
  /** null until entered; incomplete entries are left out of the calculation. */
  monthly: number | null
  fromMonth: number | null
  /** Last life month (inclusive); null = until the end of the horizon. */
  toMonth: number | null
}

export interface OneTimeCost {
  id: string
  label: string
  /** null until entered; incomplete entries are left out of the calculation. */
  amount: number | null
  /** Life month in which the cost occurs; 0 = before birth, null until picked. */
  month: number | null
}

export type ChildcareHours = 25 | 35 | 45

export interface ChildcareConfig {
  enabled: boolean
  /** First month of childcare ('YYYY-MM'), '' until picked. */
  startMonth: string
  /** null until picked; without start and hours there is no childcare in the calculation. */
  hoursPerWeek: ChildcareHours | null
  feeMode: 'cologne' | 'manual'
  manualFee: number
  mealDaysPerWeek: number
}

export interface VariantConfig {
  /** null until it is chosen in a new planning. */
  relationship: RelationshipStatus | null
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
  periods: Record<ParentKey, PlanPeriod[]>
  vacation: Record<ParentKey, VacationPeriod[]>
  parents: Record<ParentKey, ParentConfig>
  fixedCosts: number
  childCosts: CostItem[]
  oneTimeCosts: OneTimeCost[]
  childcare: ChildcareConfig
  familyCare: FamilyCarePeriod[]
  balanceAtBirth: number
  minReserve: number
  employerReducesVacation: boolean
  /** Parent who receives the Kindererziehungszeiten (pension credits). */
  childRaisingCreditTo: ParentKey
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
