import { addDays, addMonths, addMonthsToKey, formatDate, formatDateRange, lastDayOfMonth, monthKey, monthKeyToIso, type IsoDate } from './dates'
import { PARENTAL_LEAVE } from './params'
import type { SimulationResult } from './result'
import { consecutiveRuns } from './math'
import type { ParentKey, VariantConfig } from './types'

export type DeadlineCategory = 'leave' | 'allowance' | 'benefits' | 'tax' | 'childcare' | 'family' | 'insurance' | 'event'
export type DeadlineStatus = 'done' | 'missed' | 'soon' | 'upcoming' | 'past-event' | 'event'

export interface Deadline {
  id: string
  /** Latest date (deadline) or date of the event. */
  date: IsoDate
  /** Earliest sensible date, if relevant. */
  earliest?: IsoDate
  title: string
  detail: string
  category: DeadlineCategory
  parent?: ParentKey
  isEvent?: boolean
  status: DeadlineStatus
}


function status(deadline: Omit<Deadline, 'status'>, today: IsoDate, done: Set<string>): DeadlineStatus {
  if (deadline.isEvent) return deadline.date < today ? 'past-event' : 'event'
  if (done.has(deadline.id)) return 'done'
  if (deadline.date < today) return 'missed'
  if (deadline.date <= addDays(today, 30)) return 'soon'
  return 'upcoming'
}

/** Deadlines and key dates derived from the plan (birth date, leave periods, childcare). */
export function computeDeadlines(config: VariantConfig, result: SimulationResult, today: IsoDate): Deadline[] {
  const items: Omit<Deadline, 'status'>[] = []
  const { birth, maternity, months } = result
  const birthMonth = monthKey(birth)
  const thirdBirthday = addMonths(birth, 36).date
  const mother = result.parents.a.name

  items.push({
    id: 'event-maternity-start',
    date: maternity.start,
    title: 'Mutterschutz beginnt',
    detail: `Sechs Wochen vor dem errechneten Termin. Nach der Geburt dauert er bis ${formatDate(maternity.end)}. In dieser Zeit zahlen Krankenkasse und Arbeitgeber zusammen etwa das bisherige Netto weiter.`,
    category: 'event',
    isEvent: true,
  })
  items.push({
    id: 'maternity-benefit',
    date: addDays(maternity.start, -1),
    earliest: addDays(config.dueDate, -49),
    title: 'Mutterschaftsgeld bei der Krankenkasse beantragen',
    detail:
      'Dafür ist eine Bescheinigung von Ärztin oder Hebamme über den errechneten Termin nötig (frühestens 7 Wochen vorher ausgestellt). Den Zuschuss des Arbeitgebers gibt es automatisch. Privat versichert: Antrag beim Bundesamt für Soziale Sicherung (einmalig 210 €).',
    category: 'benefits',
    parent: 'a',
  })

  if (config.relationship === 'married') {
    items.push({
      id: 'tax-class-allowance',
      date: lastDayOfMonth(addMonthsToKey(monthKey(maternity.start), -7)),
      title: `Spätester Steuerklassenwechsel mit Wirkung auf das Elterngeld (${mother})`,
      detail:
        'Das Elterngeld richtet sich nach der Steuerklasse, die in den 12 Monaten vor dem Mutterschutz überwiegend galt. Ein Wechsel wirkt ab dem Folgemonat und muss mindestens 6 dieser Monate gelten. Spätere Wechsel ändern nur das monatliche Netto.',
      category: 'tax',
      parent: 'a',
    })
    items.push({
      id: 'tax-class-allowance-b',
      date: lastDayOfMonth(addMonthsToKey(birthMonth, -7)),
      title: `Spätester Steuerklassenwechsel mit Wirkung auf das Elterngeld (${result.parents.b.name})`,
      detail: 'Hier zählen die 12 Kalendermonate vor dem Geburtsmonat; die neue Klasse muss mindestens 6 davon gelten.',
      category: 'tax',
      parent: 'b',
    })
  }

  if (config.relationship !== 'married') {
    items.push({
      id: 'paternity',
      date: addDays(config.dueDate, -1),
      title: 'Vaterschaft anerkennen und gemeinsames Sorgerecht erklären',
      detail:
        'Bei unverheirateten Eltern schon vor der Geburt beim Jugendamt möglich und kostenlos. Termin früh vereinbaren. Ohne Erklärung hat die Mutter das Sorgerecht allein, und der Vater braucht für seine Elternzeit ihre Zustimmung.',
      category: 'family',
    })
  }

  items.push({
    id: 'event-birth',
    date: birth,
    title: result.birth === config.dueDate ? 'Errechneter Geburtstermin' : 'Geburt',
    detail: `Der erste Lebensmonat läuft vom ${formatDate(months[0].start)} bis ${formatDate(months[0].end)}.`,
    category: 'event',
    isEvent: true,
  })
  items.push({
    id: 'birth-registration',
    date: addDays(birth, 7),
    title: 'Geburt beim Standesamt melden und Geburtsurkunden holen',
    detail: 'Meist übernimmt die Klinik die Meldung. Mehrere Urkunden anfordern, unter anderem für Elterngeld, Kindergeld und Krankenkasse.',
    category: 'family',
  })
  items.push({
    id: 'health-insurance-child',
    date: addDays(birth, 30),
    title: 'Kind bei der Krankenkasse anmelden',
    detail:
      'Bei einem gesetzlich versicherten Elternteil ist das Kind kostenlos mitversichert. Ausnahme bei Verheirateten: Ist der besser verdienende Elternteil privat versichert und verdient über 77.400 € im Jahr, muss das Kind privat versichert werden. Kinderkrankengeld gibt es nur, wenn Kind und Elternteil gesetzlich versichert sind.',
    category: 'insurance',
  })
  items.push({
    id: 'care-surcharge',
    date: lastDayOfMonth(addMonthsToKey(birthMonth, 3)),
    title: 'Geburtsurkunde beim Arbeitgeber vorlegen',
    detail: 'Dann entfällt der Zuschlag zur Pflegeversicherung für Kinderlose rückwirkend ab dem Geburtsmonat. Oft passiert das inzwischen automatisch.',
    category: 'insurance',
  })

  const firstAllowance = months.find((m) => result.activeParents.some((k) => m[k].allowance !== 'none' && m[k].parentalAllowance > 0))
  if (firstAllowance) {
    const lastMonth = months[Math.min(months.length, firstAllowance.index + 3) - 1]
    items.push({
      id: 'allowance-application',
      date: lastMonth.end,
      title: 'Elterngeld beantragen',
      detail: `Elterngeld wird nur drei Monate rückwirkend gezahlt. Deshalb früh beantragen, spätestens bis zu diesem Datum. In Köln bei der Elterngeldstelle der Stadt oder online über das Familienportal NRW. Beide Eltern unterschreiben; den Plan kann man später noch ändern.`,
      category: 'allowance',
    })
  }
  items.push({
    id: 'child-benefit',
    date: lastDayOfMonth(addMonthsToKey(birthMonth, 6)),
    title: 'Kindergeld bei der Familienkasse beantragen',
    detail:
      'Kindergeld gibt es nur sechs Monate rückwirkend. Geht der Antrag bis zu diesem Datum ein, wird auch der Geburtsmonat noch gezahlt. Die Steuer-ID des Kindes kommt automatisch per Post.',
    category: 'benefits',
  })

  for (const key of result.activeParents) {
    const name = result.parents[key].name
    const leaveMonths = months.filter((m) => m[key].leave && !m[key].maternityLocked).map((m) => m.index)
    const sections = consecutiveRuns(leaveMonths)
    sections.forEach((section, i) => {
      const firstRow = months[section[0] - 1]
      const lastRow = months[section[section.length - 1] - 1]
      const afterMaternity = key === 'a' && months[section[0] - 2]?.a.maternityLocked === true
      const start = afterMaternity ? addDays(maternity.end, 1) : firstRow.start
      const weeks = start >= thirdBirthday ? PARENTAL_LEAVE.noticeWeeksAfterThirdBirthday : PARENTAL_LEAVE.noticeWeeksUntilThirdBirthday
      // After Mutterschutz the protection period counts towards the two years (§ 16 Abs. 1 Satz 4 BEEG).
      const twoYears = addMonths(afterMaternity ? birth : start, 24).date
      const within = sections
        .filter((s) => months[s[0] - 1].start < twoYears)
        .map((s) => formatDateRange(months[s[0] - 1].start, months[s[s.length - 1] - 1].end))
        .join(', ')
      const partTime = section.filter((m) => months[m - 1][key].hours > 0)
      items.push({
        id: `leave-${key}-${section[0]}`,
        date: addDays(start, -weeks * 7),
        title: `Elternzeit beim Arbeitgeber anmelden: ${name} ab ${formatDate(start)}`,
        detail:
          `Zeitraum ${formatDateRange(start, lastRow.end)}. Spätestens ${weeks} Wochen vorher schriftlich anmelden, eine E-Mail reicht. ` +
          (i === 0
            ? `Dabei verbindlich alle Elternzeiten der nächsten zwei Jahre angeben (${within}). Spätere Änderungen sind nur mit Zustimmung des Arbeitgebers möglich. `
            : '') +
          `Ab der Anmeldung (frühestens ${weeks === 7 ? 8 : 14} Wochen vor Beginn) gilt Kündigungsschutz.` +
          (partTime.length ? ' Die geplante Teilzeit gleich mit beantragen. Lehnt der Arbeitgeber nicht innerhalb von 4 Wochen schriftlich ab, gilt sie als genehmigt.' : ''),
        category: 'leave',
        parent: key,
      })
    })

    const bonus = months.filter((m) => m[key].allowance === 'bonus')
    if (bonus.length) {
      items.push({
        id: `bonus-proof-${key}`,
        date: addDays(bonus[bonus.length - 1].end, 60),
        title: `Partnerschaftsbonus: Arbeitszeit nachweisen (${name})`,
        detail: 'Nach den Bonus-Monaten verlangt die Elterngeldstelle eine Bescheinigung des Arbeitgebers über die Wochenstunden. Stimmen sie nicht, muss der Bonus zurückgezahlt werden.',
        category: 'allowance',
        parent: key,
      })
    }

    const contract = config.parents[key].weeklyHours
    const regularPartTime = months.find((m) => !m[key].leave && m[key].hours > 0 && m[key].hours < contract && !m[key].maternityLocked)
    if (regularPartTime) {
      items.push({
        id: `tzbfg-${key}-${regularPartTime.index}`,
        date: addDays(regularPartTime.start, -91),
        title: `Teilzeit nach der Elternzeit beantragen (${name})`,
        detail:
          'Spätestens drei Monate vorher schriftlich beantragen, als dauerhafte Teilzeit oder als befristete „Brückenteilzeit“ (1 bis 5 Jahre, nur in Betrieben mit mehr als 45 Beschäftigten). Alternative: bis zum 3. Geburtstag in Elternzeit bleiben und dort in Teilzeit arbeiten.',
        category: 'leave',
        parent: key,
      })
    }
  }

  if (config.childcare.enabled && result.childcare.startMonthIndex) {
    const start = monthKeyToIso(config.childcare.startMonth)
    items.push({
      id: 'childcare-register',
      date: addDays(birth, 14),
      title: 'Kita-Platz suchen (Köln: Portal „Little Bird“)',
      detail:
        'Anfragen sind erst nach der Geburt möglich. Städtische Kitas vergeben nach Anmeldedatum, deshalb gleich anmelden. Bis zu sechs Kitas sind möglich. Zusagen kommen frühestens acht Monate vor dem Start und müssen innerhalb von zwei Wochen angenommen werden.',
      category: 'childcare',
    })
    items.push({
      id: 'childcare-need',
      date: addDays(addMonths(start, -6).date, -1),
      title: 'Spätester Termin, um den Kita-Bedarf anzumelden',
      detail: 'In NRW muss der Bedarf dem Jugendamt mindestens sechs Monate vor dem gewünschten Start bekannt sein.',
      category: 'childcare',
    })
    items.push({
      id: 'event-childcare-start',
      date: start,
      title: 'Kita-Start mit Eingewöhnung',
      detail: 'Für die Eingewöhnung zwei bis vier Wochen einplanen, in denen ein Elternteil frei hat.',
      category: 'event',
      isEvent: true,
    })
  }

  items.push({
    id: 'tax-return',
    date: `${Number(birth.slice(0, 4)) + 1}-07-31`,
    title: `Steuererklärung für ${birth.slice(0, 4)} abgeben`,
    detail:
      'Pflicht, weil Elterngeld oder Mutterschaftsgeld bezogen wurde. Beides ist steuerfrei, erhöht aber den Steuersatz auf das übrige Einkommen. Geld für eine mögliche Nachzahlung zurücklegen. Kita-Kosten und Kinderfreibetrag werden dabei automatisch berücksichtigt.',
    category: 'tax',
  })
  items.push({
    id: 'event-third-birthday',
    date: thirdBirthday,
    title: '3. Geburtstag',
    detail: 'Bis hierhin läuft die normale Elternzeit. Bis zu 24 Monate lassen sich auf die Zeit bis zum 8. Geburtstag verschieben (Anmeldung 13 Wochen vorher).',
    category: 'event',
    isEvent: true,
  })

  const done = new Set(config.doneDeadlines)
  return items
    .map((item) => ({ ...item, status: status(item, today, done) }))
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
}
