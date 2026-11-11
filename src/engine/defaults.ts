import { generateQuickPlan, PLAN_PRESETS } from './plan'
import type { ParentConfig, ScenarioConfig } from './types'

export function defaultParent(name: string, grossMonthly: number): ParentConfig {
  return {
    name,
    grossMonthly,
    allowanceGross: null,
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

export function defaultScenario(): ScenarioConfig {
  const classic = PLAN_PRESETS[0].quick
  return {
    version: 1,
    relationship: 'married',
    dueDate: '2027-01-01',
    birthDate: null,
    children: 1,
    extendedMaternity: false,
    siblingBonus: false,
    churchTaxRate: 0.09,
    horizonMonths: 36,
    blocks: generateQuickPlan(classic, 'married'),
    parents: {
      a: defaultParent('Mutter', 3800),
      b: defaultParent('Vater', 4500),
    },
    fixedCostsBefore: 2800,
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
    support: [],
    startBalance: 15000,
    minReserve: 5000,
    employerReducesVacation: true,
    pensionCreditTo: 'a',
    assumptions: { returnRate: 5, yearsToRetirement: 30, retirementYears: 20 },
    doneDeadlines: [],
  }
}
