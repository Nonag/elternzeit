import { periodsFromOutline, PLAN_PRESETS } from './plan'
import type { ParentConfig, VariantConfig } from './types'

function exampleParent(name: string, grossMonthly: number): ParentConfig {
  return {
    name,
    grossMonthly,
    weeklyHours: 40,
    workDaysPerWeek: 5,
    taxClass: 4,
    taxClassAfterBirth: null,
    taxFactor: null,
    churchTax: false,
    healthInsurance: 'statutory',
    healthAdditionalRate: 2.9,
    privatePremium: 0,
    pensionInsured: true,
    vacationDaysPerYear: 30,
    employerOver15: true,
    employedOver6Months: true,
    oneTimePayments: [],
  }
}

export function exampleConfig(): VariantConfig {
  const classic = PLAN_PRESETS[0].outline
  return {
    relationship: 'married',
    dueDate: '2027-01-15',
    birthDate: null,
    children: 1,
    extendedMaternity: false,
    siblingBonus: false,
    churchTaxRate: 0.09,
    horizonMonths: 36,
    periods: periodsFromOutline(classic, 'married'),
    vacation: { a: [], b: [] },
    parents: {
      a: exampleParent('Mutter', 3800),
      b: exampleParent('Vater', 4500),
    },
    fixedCosts: 2800,
    childCosts: [
      { id: 'cost-diapers', label: 'Windeln & Pflege', monthly: 60, fromMonth: 1, toMonth: 30 },
      { id: 'cost-food', label: 'Babynahrung', monthly: 60, fromMonth: 1, toMonth: null },
      { id: 'cost-clothes', label: 'Kleidung & Ausstattung', monthly: 50, fromMonth: 1, toMonth: null },
      { id: 'cost-misc', label: 'Sonstiges (Freizeit, Kurse, Rücklage)', monthly: 50, fromMonth: 1, toMonth: null },
    ],
    oneTimeCosts: [{ id: 'once-equipment', label: 'Erstausstattung (Kinderwagen, Bett, Sitz …)', amount: 2000, month: 0 }],
    childcare: {
      enabled: true,
      startMonth: '2028-08',
      hoursPerWeek: 45,
      feeMode: 'cologne',
      manualFee: 500,
      mealDaysPerWeek: 5,
    },
    familyCare: [],
    balanceAtBirth: 15000,
    minReserve: 5000,
    employerReducesVacation: true,
    childRaisingCreditTo: 'a',
    assumptions: { returnRate: 5, yearsToRetirement: 30, retirementYears: 20 },
    doneDeadlines: [],
  }
}
