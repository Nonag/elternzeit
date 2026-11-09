import { addMonthsToKey, monthKey } from './dates'
import type { ChildcareHours } from './types'

/** Age categories of the Cologne fee statute (Satzung 2025-04-17, § 3 Abs. 2). */
export type CologneAgeCategory = 'under2' | 'age2' | 'age3plus'

interface FeeBracket {
  /** Upper income limit (inclusive); null = no limit. */
  upTo: number | null
  /** Fees per age category for 25 / 35 / 45 hours per week. */
  fees: Record<CologneAgeCategory, [number, number, number]>
}

/** Elternbeiträge Köln (EUR per month), valid since 2025-08-01. */
export const COLOGNE_FEES: FeeBracket[] = [
  { upTo: 24542, fees: { under2: [0, 0, 0], age2: [0, 0, 0], age3plus: [0, 0, 0] } },
  { upTo: 36813, fees: { under2: [120.02, 133.36, 148.18], age2: [120.02, 133.36, 148.18], age3plus: [31.52, 35.03, 42.0] } },
  { upTo: 49084, fees: { under2: [190.73, 211.92, 235.47], age2: [181.65, 201.83, 224.26], age3plus: [70.73, 78.59, 123.67] } },
  { upTo: 61355, fees: { under2: [268.64, 298.49, 331.65], age2: [244.22, 271.35, 301.5], age3plus: [112.85, 125.39, 193.94] } },
  { upTo: 78000, fees: { under2: [331.51, 368.35, 409.29], age2: [276.26, 306.96, 341.07], age3plus: [148.46, 164.96, 256.36] } },
  { upTo: 100000, fees: { under2: [430.96, 478.86, 532.06], age2: [331.51, 368.35, 409.28], age3plus: [178.15, 197.95, 307.63] } },
  { upTo: 120000, fees: { under2: [517.15, 574.63, 638.48], age2: [397.81, 442.02, 491.14], age3plus: [213.78, 237.54, 369.16] } },
  { upTo: 140000, fees: { under2: [594.72, 660.82, 734.25], age2: [457.48, 508.32, 564.81], age3plus: [245.85, 273.17, 424.53] } },
  { upTo: 160000, fees: { under2: [620.58, 689.56, 766.18], age2: [477.37, 530.42, 589.37], age3plus: [256.54, 285.05, 442.99] } },
  { upTo: null, fees: { under2: [672.3, 747.02, 830.02], age2: [517.15, 574.63, 638.48], age3plus: [277.91, 308.8, 479.91] } },
]

/** Meal flat rates of the city-run Kitas in Cologne for 0–5 days per week. */
export const COLOGNE_MEAL_FEES = [0, 14.1, 28.2, 42.2, 56.3, 70.4]

const HOURS_INDEX: Record<ChildcareHours, number> = { 25: 0, 35: 1, 45: 2 }

/** From the month of the 2nd (3rd) birthday the fee of the next category applies. */
export function cologneAgeCategory(birth: string, month: string): CologneAgeCategory {
  const birthMonth = monthKey(birth)
  if (month >= addMonthsToKey(birthMonth, 36)) return 'age3plus'
  if (month >= addMonthsToKey(birthMonth, 24)) return 'age2'
  return 'under2'
}

export function cologneFeeBracket(annualIncome: number): FeeBracket {
  return COLOGNE_FEES.find((b) => b.upTo === null || annualIncome <= b.upTo) ?? COLOGNE_FEES[COLOGNE_FEES.length - 1]
}

export function cologneFee(annualIncome: number, category: CologneAgeCategory, hours: ChildcareHours): number {
  return cologneFeeBracket(annualIncome).fees[category][HOURS_INDEX[hours]]
}

export const AGE_CATEGORY_LABELS: Record<CologneAgeCategory, string> = {
  under2: 'unter 2 Jahre',
  age2: '2 bis unter 3 Jahre',
  age3plus: 'ab 3 Jahre',
}
