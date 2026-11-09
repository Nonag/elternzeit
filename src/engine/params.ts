/**
 * Legal parameters ("voraussichtlich geltendes Recht", status 2026-11-10).
 * 2026 is enacted law. 2027/2028 include expected changes that are not final yet
 * (Einkommensteuerreformgesetz 2027, Pflegeneuordnungsgesetz, SV-Rechengrößen 2027) – see EXPECTED_CHANGES.
 * Sources: docs/research-notes.md
 */

export type ParameterStatus = 'law' | 'expected'

export interface YearParameters {
  year: number
  /** Kindergeld per child and month. */
  childBenefitMonthly: number
  /** Arbeitnehmer-Pauschbetrag. */
  employeeLumpSum: number
  /** Grundfreibetrag. */
  basicTaxAllowance: number
  /** Kinderfreibetrag + BEA-Freibetrag for both parents together. */
  childTaxAllowanceJoint: number
  /** Beitragsbemessungsgrenze RV/AV per month. */
  pensionCeilingMonthly: number
  /** Beitragsbemessungsgrenze KV per month. */
  healthCeilingMonthly: number
  /** Beitragsbemessungsgrenze PV per month. */
  careCeilingMonthly: number
  /** PV surcharge for childless employees in percent. */
  careChildlessSurcharge: number
  /** Geringfügigkeitsgrenze (Minijob). */
  minijobLimit: number
  /** Monthly Bezugsgröße (basis for minimum contributions of voluntary members). */
  referenceValueMonthly: number
  /** Average KV-Zusatzbeitrag in percent. */
  averageAdditionalHealthRate: number
  /** Provisional Durchschnittsentgelt (pension). */
  averageEarnings: number
  /** Kinderkrankentage per parent and child. */
  sickChildDaysPerParent: number
  status: ParameterStatus
  note: string
}

const YEARS: YearParameters[] = [
  {
    year: 2026,
    childBenefitMonthly: 259,
    employeeLumpSum: 1230,
    basicTaxAllowance: 12348,
    childTaxAllowanceJoint: 9756,
    pensionCeilingMonthly: 8450,
    healthCeilingMonthly: 5812.5,
    careCeilingMonthly: 5812.5,
    careChildlessSurcharge: 0.6,
    minijobLimit: 603,
    referenceValueMonthly: 3955,
    averageAdditionalHealthRate: 2.9,
    averageEarnings: 51944,
    sickChildDaysPerParent: 15,
    status: 'law',
    note: 'Geltendes Recht.',
  },
  {
    year: 2027,
    childBenefitMonthly: 267,
    employeeLumpSum: 1430,
    basicTaxAllowance: 12564,
    childTaxAllowanceJoint: 10056,
    pensionCeilingMonthly: 8850,
    healthCeilingMonthly: 6375,
    careCeilingMonthly: 6375,
    careChildlessSurcharge: 0.9,
    minijobLimit: 633,
    referenceValueMonthly: 4130,
    averageAdditionalHealthRate: 2.9,
    averageEarnings: 53452,
    sickChildDaysPerParent: 10,
    status: 'expected',
    note: 'Voraussichtlich: Steuerreform und Pflegereform als Entwurf, Beitragsgrenzen vom Kabinett beschlossen.',
  },
  {
    year: 2028,
    childBenefitMonthly: 272,
    employeeLumpSum: 1430,
    basicTaxAllowance: 12900,
    childTaxAllowanceJoint: 10236,
    pensionCeilingMonthly: 8850,
    healthCeilingMonthly: 6375,
    careCeilingMonthly: 6375,
    careChildlessSurcharge: 0.9,
    minijobLimit: 633,
    referenceValueMonthly: 4130,
    averageAdditionalHealthRate: 2.9,
    averageEarnings: 53452,
    sickChildDaysPerParent: 10,
    status: 'expected',
    note: 'Voraussichtlich: zweite Stufe der Steuerreform; Beitragsgrenzen 2028 noch unbekannt (Werte von 2027).',
  },
]

export function yearParameters(year: number): YearParameters {
  const first = YEARS[0]
  const last = YEARS[YEARS.length - 1]
  if (year <= first.year) return first
  if (year >= last.year) return last
  return YEARS.find((y) => y.year === year) ?? last
}

export const PARAMETER_YEARS = YEARS.map((y) => y.year)

/** Contribution rates in percent (general rates, unchanged 2026–2028). */
export const CONTRIBUTION_RATES = {
  healthGeneral: 14.6,
  healthReduced: 14.0,
  careTotal: 3.6,
  careEmployee: 1.8,
  pension: 18.6,
  unemployment: 2.6,
  minijobPensionEmployee: 3.6,
} as const

/** Upper limit of the Übergangsbereich (Midijob). */
export const TRANSITION_ZONE_UPPER_LIMIT = 2000

/** BEEG parameters for children born in 2027 (calculation basis: year before birth = 2026). */
export const PARENTAL_ALLOWANCE = {
  papYear: 2026,
  minBasic: 300,
  maxBasic: 1800,
  minPlus: 150,
  incomeCapForDifference: 2770,
  monthlyLumpSum: 102.5,
  churchTaxRate: 0.08,
  flatHealthRate: 0.09,
  flatPensionRate: 0.1,
  flatUnemploymentRate: 0.02,
  averageAdditionalHealthRate: 2.9,
  /** Elterngeld-specific factor F for the Übergangsbereich. */
  transitionFactor: 0.6667,
  minijobLimit: 603,
  incomeLimit: 175_000,
  siblingBonusRate: 0.1,
  siblingBonusMin: 75,
  multipleBirthSupplement: 300,
  maxBasicPerParent: 12,
  basicMonthsJoint: 12,
  partnerMonths: 2,
  minMonthsPerParent: 2,
  lastBasicMonth: 14,
  lastPlusMonth: 32,
  maxWeeklyHours: 32,
  bonusMinHours: 24,
  bonusMaxHours: 32,
  bonusMinMonths: 2,
  bonusMaxMonths: 4,
  parallelBasicWindow: 12,
} as const

export const PARENTAL_LEAVE = {
  noticeWeeksUntilThirdBirthday: 7,
  noticeWeeksAfterThirdBirthday: 13,
  maxSectionsWithoutConsent: 3,
  maxMonths: 36,
  partTimeMinHours: 15,
  partTimeMaxHours: 32,
  partTimeMinMonths: 2,
  partTimeClaims: 2,
} as const

export const MATERNITY = {
  weeksBefore: 6,
  weeksAfter: 8,
  weeksAfterExtended: 12,
  statutoryDailyMax: 13,
  privateLumpSum: 210,
} as const

export const PENSION = {
  /** Aktueller Rentenwert from 2026-07-01 (pension amounts are shown in today's value). */
  currentValue: 42.52,
  contributionRate: 18.6,
} as const

export interface ExpectedChange {
  title: string
  detail: string
  status: string
}

/** Values for 2027/2028 that are already included although the laws are not final yet. */
export const EXPECTED_CHANGES: ExpectedChange[] = [
  {
    title: 'Einkommensteuerreform 2027',
    detail:
      'Kindergeld 267 € (2027) und 272 € (2028), Arbeitnehmer-Pauschbetrag 1.430 €, höherer Grundfreibetrag und neuer Steuertarif – wirkt auf das Netto ab 2027.',
    status: 'Gesetzentwurf im Bundestag',
  },
  {
    title: 'Beitragsbemessungsgrenzen 2027',
    detail: 'Rente/Arbeitslosenversicherung 8.850 €, Kranken- und Pflegeversicherung 6.375 € im Monat.',
    status: 'vom Kabinett beschlossen, Bundesrat am 20.11.2026',
  },
  {
    title: 'Pflegereform',
    detail: 'Kinderlosenzuschlag 0,9 % (betrifft euch nach der Geburt nicht mehr), Beitragsgrenze wie bei der Krankenversicherung.',
    status: 'Gesetzentwurf',
  },
]

/** Facts that stay as they are under current law. */
export const CURRENT_LAW_NOTES = [
  'Elterngeld für eine Geburt im Januar 2027 wird nach geltendem Recht mit den Werten von 2026 berechnet. Die geplante Elterngeld-Reform gilt erst für Geburten ab November 2027.',
  'Kinderkrankentage 2027: 10 pro Elternteil und Kind (die 15-Tage-Regel galt nur 2026).',
  'Lohnsteuer: offizielles Berechnungsprogramm des Finanzministeriums für 2026; für 2027/2028 wird der neue Tarif aus dem Gesetzentwurf eingerechnet.',
]
