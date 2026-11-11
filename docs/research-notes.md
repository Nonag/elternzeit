# Research notes – Elterngeld / Elternzeit planner

Status: 2026-11-09. Scope: births in 2027; Kita and local authorities: Cologne (NRW), as in the app.
Tags: **[LAW]** in force · **[DRAFT]** bill/ordinance not final · **[FORECAST]** official projection · **[DERIVED]** own arithmetic.
German legal terms are kept where they are the precise term.

## 0. Legal baseline

- Current BEEG applies to births before 2027-11-01. The BEEG reform (4+6+4 model, 80/50 % replacement, 330–1,900 EUR, no Partnerschaftsbonus) is only a Referentenentwurf (2026-10-29) and targets births **from 2027-11-01** (new § 27 Abs. 1c keeps old law for births before). [DRAFT]
- No paid partner leave after birth ("Familienstartzeit") – not enacted, not planned by the coalition.
- Elternzeit/Elternteilzeit requests only need **Textform** (e-mail ok) for births from 2025-05-01 (§ 16 Abs. 1, § 15 Abs. 4–7, § 28 Abs. 1b BEEG). Proof of receipt still matters.

## 1. Key dates (relative to the birth)

| Item | Rule | Basis |
|---|---|---|
| Mutterschutz before birth | 6 weeks (42 days) before the due date | § 3 Abs. 1 MuSchG |
| Mutterschutz after birth | 8 weeks from the day after the birth (12 weeks for premature births, multiples, disability) | § 3 Abs. 2 MuSchG |
| Elternzeit request must arrive | 7 weeks before the start, also for Elternzeit from the birth or right after the Mutterschutz | § 16 Abs. 1 BEEG |
| Kündigungsschutz starts at the earliest | 8 weeks before the start | § 18 BEEG |
| Elterngeld application must arrive | by the end of the 3rd LM after the first LM with Elterngeld (3 LM retroactive) | § 7 Abs. 1 BEEG |
| Kindergeld application must arrive | by the end of the 6th month after the birth month (6 months retroactive) | § 70 Abs. 1 EStG |
| Kita legal claim (Rechtsanspruch) | from the 1st birthday | § 24 Abs. 2 SGB VIII |
| Last day of Elternzeit before 3rd birthday | the day before the 3rd birthday | § 15 Abs. 2 BEEG |
| Kindererziehungszeiten (pension) | 36 months from the month after the birth month | § 56 SGB VI |
| Tax return for the birth year (mandatory) | 31 July of the following year (with adviser: end of February of the year after) | § 149 AO |
| Bemessungszeitraum | 12 calendar months before the birth month; months with Mutterschutz are skipped and replaced by earlier ones | § 2b BEEG |
| Steuerklasse change relevant for Elterngeld | applies from the month after the application and must cover most months of the Bemessungszeitraum | § 2c Abs. 3 BEEG, § 39 Abs. 6 EStG |

Lebensmonate (LM): LM n ends the day before the birth-date day in month n; if that day does not exist, LM ends at month end and the next LM starts on the 1st. Birth on 15.03. → LM1 = 15.03.–14.04., LM2 = 15.04.–14.05.

## 2. Elterngeld (BEEG)

### 2.1 Amount (§§ 2, 2a, 4a)
- Basis = rate × Elterngeld-Netto N; min 300, max 1,800 EUR (max reached at N ≈ 2,769.23).
- Rate (always from pre-birth N): N < 1,000: 67 % + 0.1 pp per full 2 EUR below 1,000 (max 100 %); 1,000–1,200: 67 %; 1,200–1,240: 67 % − 0.1 pp per full 2 EUR above 1,200; ≥ 1,240: 65 %.
- Income after birth: EG = rate × (min(N, 2,770) − N_after). N_after averaged over all LM with income, **separately for Basis LM and Plus LM** (Bonus counts as Plus). Min 300 still applies.
- ElterngeldPlus: same formula, capped at ½ of Basis without income; minimum 150. Range 150–900.
- Geschwisterbonus +10 % (min 75 / Plus 37.50); Mehrlingszuschlag +300 (Plus 150) per extra child.
- Income limit: zvE > 175,000 EUR (both parents added) in VZ 2026 → no Elterngeld (§ 1 Abs. 8).

### 2.2 Elterngeld-Netto (§§ 2b–2f)
- Gross = average **laufender** Arbeitslohn of Bemessungszeitraum; sonstige Bezüge (bonus, 13th salary, Urlaubs-/Weihnachtsgeld) excluded.
- Deduct 1/12 Arbeitnehmer-Pauschbetrag 2026 = 102.50 EUR/month (not from tax base; PAP deducts its own).
- Taxes via **PAP 2026** (PAP of the year before birth). Vorsorgepauschale: GKV-type KV/PV parts always (no PKV part), RV part only if RV-pflichtig, AV part; BBG apply inside PAP; KV-Zusatzbeitrag = average of year before birth (2.9 %); no PV childless surcharge, no child reductions. Steuerklasse VI ignored. Soli per SolZG. **Kirchensteuer flat 8 %** (also in NRW).
- Social contributions flat on full gross, **no BBG**: 9 % KV/PV (if GKV-pflichtig), 10 % RV (if RV-pflichtig, incl. Versorgungswerk), 2 % AV. Freiwillig GKV / PKV: no 9 %.
- Steuerklasse: class valid in most months of Bemessungszeitraum (tie → latest). After-birth income uses the **same Abzugsmerkmale** (changing class after birth has no Elterngeld effect).
- Example (deutschrechner): 3,500 EUR gross, class IV, church, birth 2027 → N = 2,217.99 EUR.

### 2.3 Entitlement rules (§§ 4–4c)
- 12 Basis jointly + 2 Partnermonate if a parent has reduced income in 2 LM → 14. Per parent max 12 Basis (+ max 4 Bonus). Per parent min 2 LM.
- 1 Basis = 2 Plus. Basis only until LM14. Plus until LM32, from LM15 only in consecutive LM by at least one parent.
- **Parallel Basis of both parents only in one of LM1–12** (§ 4 Abs. 6). Basis + Plus or Plus + Plus in parallel: unlimited. Exceptions: multiples, premature (≥ 6 weeks), disability, Geschwisterbonus for disabled sibling.
- **LM with Mutterschaftsleistungen count as Basis months of the mother** (§ 4 Abs. 4 S. 3) → LM1–2 locked as mother's Basis. A father's Basis in LM1/LM2 uses up the one parallel month.
- Partnerschaftsbonus (§ 4b): both 24–32 h/week (monthly average), simultaneously, 2–4 consecutive LM; each gets Plus amounts. Single parents can take it alone.
- Max 32 h/week in any Elterngeld LM.
- Premature birth (§ 4 Abs. 5): ≥ 6/8/12/16 weeks early → 13/14/15/16 Basis months, Basis window extended.
- Single parents (§ 4c): 14 months alone if Entlastungsbetrag conditions apply.

### 2.4 Mutterschaftsleistungen
- GKV: Mutterschaftsgeld 13 EUR/day + Arbeitgeberzuschuss = average net of last 3 months before Mutterschutz ÷ 90 − 13 per day. PKV/familienversichert: max 210 EUR total (Bundesamt für Soziale Sicherung) + Zuschuss.
- Offset day by day against Elterngeld (§ 3); 210 EUR from BAS not offset. A partly covered LM keeps Elterngeld for the uncovered days (e.g. 2 of 28 days → 2/28 of the monthly Basis).
- Tax-free, Progressionsvorbehalt; Zuschuss free of social contributions.

### 2.5 Application / payment
- Apply after birth; retroactive 3 LM before the LM of receipt. Plan changes possible until end of Bezugszeitraum (not for paid months, except Plus→Basis).
- Paid during the LM. Tax-free, Progressionsvorbehalt → mandatory tax return.
- Cologne: Elterngeldstelle der Stadt Köln; online via Familienportal.NRW / Behörden-Serviceportal (BundID). Not ElterngeldDigital.
- GKV-pflichtversichert: contribution-free during Elterngeld/Elternzeit (§§ 192, 224 SGB V). Freiwillig GKV: minimum contribution (2026: KV 222.80–230.71 + PV ~47) unless family-insurable via GKV spouse. PKV: full premium, no employer subsidy.

## 3. Elternzeit / Elternteilzeit (§§ 15–19 BEEG, TzBfG)
- 3 years per parent until 3rd birthday; up to 24 months transferable to 3rd–8th birthday (13 weeks notice). Mutterschutz after birth counts against mother's 3 years.
- Notice 7 weeks (until 3rd birthday), in Textform; first request must state all periods within the next **2 years** (binding; changes need consent).
- Max **3 sections** per parent without employer consent (3rd section in 3–8 window may be refused).
- Extension / early end only with consent (§ 16 Abs. 3).
- Kündigungsschutz from request, at most 8 weeks (14 weeks for 3–8) before start; also in Elternteilzeit at own employer.
- Elternteilzeit: ≤ 32 h/week. Legal claim (max **2×**): employer > 15 employees, employed > 6 months, ≥ 2 months, **15–32 h**, no urgent operational reasons, 7 weeks notice. Employer must refuse in Textform within 4 weeks (8 for 3–8), else deemed approved. Automatic return to old hours after Elternzeit.
- After Elternzeit: § 8 TzBfG (permanent part-time, 3 months notice, > 15 employees, no return right) or § 9a Brückenteilzeit (> 45 employees, 1–5 years).
- Tip (valid): stay in Elternzeit until 3rd birthday with Elternteilzeit ≤ 32 h → return right + Kündigungsschutz + no vacation cut; cost: uses Elternzeit budget for age 3–8.

## 4. Vacation (§ 17 BEEG)
- Employer may cut 1/12 per **full calendar month** of Elternzeit (declaration required; not before request, not after employment ended). No rounding (e.g. 27.5 days).
- No cut for months with Elternteilzeit at own employer. Mutterschutz counts as worked (§ 24 MuSchG).
- Remaining vacation carried over to current or next year after Elternzeit.
- Fewer working days/week → entitlement recalculated pro rata for that period (days earned before keep value).
- LM-aligned Elternzeit covers fewer full calendar months: e.g. 15.01.–14.03. = only February → 1/12 instead of 2/12.

## 5. Childcare (NRW / Cologne)
- Registration: KiBiz § 5 – notify need ≥ 6 months before start. Kita year starts 1 August. Cologne portal "Little Bird": requests only **after birth**, city Kitas allocate by registration date → register immediately after birth. Offers ≥ 8 months before start, 2 weeks to accept.
- Hours 25/35/45 (KiBiz 5-hour steps from 2027-08-01; Cologne fee table will likely be amended).
- Fee category: "under 2" until Dec 2028, "2 to under 3" from Jan 2029, "3+" from Jan 2030 (lower fee from birthday month). Fee-free from 2031-08-01 (last 2 years before school).
- Income for fees: positive Einkünfte of both parents in the calendar year incl. Elterngeld > 300 EUR/month, Mutterschaftsgeld; Kindergeld not counted. No proof → highest bracket. Full fee also for a partial first month.
- Meals (city Kitas): 14.10 / 28.20 / 42.20 / 56.30 / 70.40 EUR per month for 1–5 days/week.
- Eingewöhnung: plan ~4 weeks before returning to work.

Cologne Elternbeiträge (Satzung 2025-04-17, EUR/month):

| Annual income up to | <2: 25h | 35h | 45h | 2–3: 25h | 35h | 45h | 3+: 25h | 35h | 45h |
|---|---|---|---|---|---|---|---|---|---|
| 24,542 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 36,813 | 120.02 | 133.36 | 148.18 | 120.02 | 133.36 | 148.18 | 31.52 | 35.03 | 42.00 |
| 49,084 | 190.73 | 211.92 | 235.47 | 181.65 | 201.83 | 224.26 | 70.73 | 78.59 | 123.67 |
| 61,355 | 268.64 | 298.49 | 331.65 | 244.22 | 271.35 | 301.50 | 112.85 | 125.39 | 193.94 |
| 78,000 | 331.51 | 368.35 | 409.29 | 276.26 | 306.96 | 341.07 | 148.46 | 164.96 | 256.36 |
| 100,000 | 430.96 | 478.86 | 532.06 | 331.51 | 368.35 | 409.28 | 178.15 | 197.95 | 307.63 |
| 120,000 | 517.15 | 574.63 | 638.48 | 397.81 | 442.02 | 491.14 | 213.78 | 237.54 | 369.16 |
| 140,000 | 594.72 | 660.82 | 734.25 | 457.48 | 508.32 | 564.81 | 245.85 | 273.17 | 424.53 |
| 160,000 | 620.58 | 689.56 | 766.18 | 477.37 | 530.42 | 589.37 | 256.54 | 285.05 | 442.99 |
| > 160,000 | 672.30 | 747.02 | 830.02 | 517.15 | 574.63 | 638.48 | 277.91 | 308.80 | 479.91 |

## 6. Kindergeld and income tax

| | 2026 | 2027 | 2028 |
|---|---|---|---|
| Kindergeld EUR/month | 259 [LAW] | 267 [DRAFT] | 272 [DRAFT] |
| Kinderfreibetrag + BEA, joint | 9,756 [LAW] | 10,056 [DRAFT] | 10,236 [DRAFT] |
| Grundfreibetrag | 12,348 [LAW] | 12,564 [DRAFT] | 12,900 [DRAFT] |
| Arbeitnehmer-Pauschbetrag | 1,230 | 1,430 [DRAFT] | 1,430 [DRAFT] |

- EStReformG 2027 (BT-Drs. 21/8235) still in parliament.
- § 32a tariff 2026: zones 12,348 / 17,799 / 69,878 / 277,825; zone 2 (914.51·y + 1,400)·y; zone 3 (173.10·z + 2,397)·z + 1,034.87; zone 4 0.42·x − 11,135.63; zone 5 0.45·x − 19,470.38. Splitting 2 × T(zvE/2).
- § 32a tariff 2027 [DRAFT]: 12,564 / 17,799 / 70,600 / 249,999 / 279,999; zone 2 (952.24·y + 1,400)·y; zone 3 (170.74·z + 2,397)·z + 993.86; zone 4 0.42·x − 11,241.73; zone 5 0.45·x − 18,741.70; zone 6 0.47·x − 24,341.68.
- Soli: Freigrenze 20,350 / 40,700 (joint); Milderungszone 11.9 %; base computed with child allowances. Church tax NRW 9 %.
- Kindergeld from birth month; Günstigerprüfung (§ 31) automatic in assessment; unmarried: each parent half.
- Antragsloses Kindergeld: first children only from end of 2027 → births in 2027 still need a normal application.
- Kinderbetreuungskosten (§ 10 Abs. 1 Nr. 5): 80 %, max 4,800 EUR/child/year; child < 14; invoice + bank transfer; care only (no meals). Married joint: irrelevant who pays. Unmarried: only the parent who bears the costs and has the child in household; contract + payment by one parent → only that parent (BFH III R 79/09); both paid → each up to half cap unless agreed otherwise.
- Employer Kita subsidy (§ 3 Nr. 33): tax- and contribution-free on top of salary (not via salary conversion).
- Progressionsvorbehalt (§ 32b): Elterngeld, Mutterschaftsgeld, AG-Zuschuss. > 410 EUR → mandatory return (§ 46).
- Steuerklassen: married IV/IV default, III/V, IV-Faktor; unmarried cohabiting: both I (no II); single parent II (Entlastungsbetrag 4,260). Change effective from following month, no limit per year. Abolition of III/V not legislated.
- Kinderfreibetragszähler (ELStAM) affects only Soli/KiSt.

## 7. Social insurance parameters

| | 2026 [LAW] | 2027 [DRAFT/VO pending] |
|---|---|---|
| BBG RV/AV month | 8,450 | 8,850 |
| BBG KV month | 5,812.50 | 6,375 |
| BBG PV month | 5,812.50 | 6,375 (if Pflegeneuordnungsgesetz passes, else 6,075) |
| JAEG year | 77,400 | 84,150 |
| Bezugsgröße month | 3,955 | 4,130 |
| Durchschnittsentgelt (provisional) | 51,944 | 53,452 |
| Minijob limit | 603 | 633 |

- Rates: KV 14.6 % + average Zusatzbeitrag 2.9 % (2026 and 2027); PV 3.6 % (employee 1.8 %), childless surcharge 0.6 % (2026) / 0.9 % (2027, DRAFT) – ends from birth month for both parents (proof via automated procedure or within 6 months); RV 18.6 %; AV 2.6 %.

## 8. Pension
- Aktueller Rentenwert: 40.79 (from 2025-07-01), **42.52 (from 2026-07-01)**, ~44.26 forecast 2027.
- Kindererziehungszeiten: 36 months from month after birth, 1/12 EP per month, added to own EP up to BBG. Assigned to one parent (default: main carer, else mother); joint declaration (form V0820) only 2 months retroactive, can split by periods.
- Berücksichtigungszeiten until 10th birthday (only parent with KEZ).
- Voluntary contributions only when not compulsorily insured (not during own KEZ); 2027 range ~117.74–1,646.10 EUR/month; cost per EP ≈ 9,661 (2026) / 9,942 (2027) [DERIVED].
- Rentensplitting only for married couples.

## 9. Health insurance of the child
- Family insurance free with a GKV parent. Married + other parent PKV + income > JAEG/12 and higher than GKV spouse → child cannot be family-insured (§ 10 Abs. 3 SGB V). Unmarried: exclusion does not apply.
- Kinderkrankengeld requires parent and child GKV-insured. Days per parent per child: 15 in 2026, **10 in 2027** (single parent 20), unless extended.

## 10. Retirement saving
- Altersvorsorgereformgesetz from 2027 [LAW]: new Altersvorsorgedepot; child bonus 1 EUR per EUR saved, max 300 EUR/child/year; goes to Kindergeld recipient (married: mother unless both choose father).
- Frühstart-Rente [DRAFT, Bundesrat pending]: 10 EUR/month from age 6 to 18.

## 11. Unmarried parents
- Vaterschaftsanerkennung and Sorgeerklärung possible before birth (Jugendamt, free). Without Sorgeerklärung mother has sole custody; Elternzeit of non-custodial parent requires consent.

## 12. Existing tools – UX references
- Official BMBFSFJ Elterngeldrechner mit Planer (familienportal.de; source: gitlab.opencode.de/digitalservicebund/elterngeldrechner, EUPL-1.2): LM × parent grid (Basis/Plus/Bonus), locked Mutterschutz months, "X von Y" counters, presets, validation messages, income per LM. Lacks household cash flow, costs, deadlines, vacation, pension, variants.
- Budget spreadsheets: rows = LM, per-parent status/net/Elterngeld, household Kindergeld/costs/balance, red/green months, status-quo comparison; no Elterngeld calculation or rule checks.
- Other ideas: deadline calculators with letter templates, optimizers (Basis vs Plus), side-by-side variants, starting balance and minimum reserve, ICS export.

## 13. Technical references
- Lohnsteuer: npm `lohnsteuerrechner` (MIT, PAP 2025/2026, decimal.js, validated against BMF interface). PAP 2027 only draft (BMF letter 2026-10-08); final XML expected mid/late Nov 2026.
- Official PAP XML 2026: https://www.bmf-steuerrechner.de/javax.faces.resource/daten/xmls/Lohnsteuer2026.xml.xhtml
- Official Elterngeld engine + test cases (Excel): gitlab.opencode.de/digitalservicebund/elterngeldrechner (`src/elterngeldrechner`, `src/monatsplaner`, `src/lebensmonatrechner`).

## 14. One-time employer payments (bonus, premium)
- **Elterngeld:** payments treated as sonstige Bezüge in payroll neither raise the Elterngeld (Bemessungszeitraum) nor
  reduce it during receipt (§ 2c Abs. 1 Satz 2 BEEG; BSG 14.12.2017 – B 10 EG 7/17 R, 08.03.2018 – B 10 EG 8/16 R).
  Components paid monthly with the salary are laufender Arbeitslohn and count.
- **Social insurance (§ 23a SGB IV):** booked in the payout month, during Ruhen (Elternzeit) in the last payroll period
  of the current year. Contributions only up to the pro-rata ceiling, which counts only days with contributory salary;
  Mutterschutz, Elterngeld and Elternzeit do not count → no contributions in a year without salary so far.
  März-Klausel: a payout from January to March above this year's pro-rata ceiling belongs to the previous year (for
  compulsory KV members only the KV ceiling decides, Abs. 5); free as well if the previous year had no salary (DRV GRA).
- **Wage tax:** sonstiger Bezug with the annual table (§ 39b Abs. 3 EStG, PAP inputs JRE4/SONSTB). Final tax via the
  assessment; Elterngeld and Mutterschaftsleistungen raise the rate (§ 32b EStG), an unused Arbeitnehmer-Pauschbetrag
  reduces them (§ 32b Abs. 2 Nr. 1 EStG).
- **Cologne Kita fee:** counts as positive income in the payout year.

## Sources (selection)
- BEEG: https://www.gesetze-im-internet.de/beeg/ (§§ 1–4c, 7, 15–18, 27, 28)
- BEEG Richtlinien 07/2026: https://www.bmbfsfj.bund.de/resource/blob/243236/a81e922c7e43128d76c4299778d83e89/richtlinien-zum-beeg-data.pdf
- Reform draft: https://www.bmbfsfj.bund.de/bmbfsfj/ministerium/gesetze/entwurf-eines-gesetzes-zur-aenderung-des-bundeselterngeld-und-elternzeitgesetzes-zur-weiterentwicklung-und-vereinfachung-des-elterngeldes-sowie-des-mutterschutzgesetzes-298792
- Familienportal FAQ: https://familienportal.de/familienportal/familienleistungen/elterngeld/faq
- MuSchG: https://www.gesetze-im-internet.de/muschg_2018/
- § 23a SGB IV: https://www.gesetze-im-internet.de/sgb_4/__23a.html · DRV GRA: https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/01_GRA_SGB/04_SGB_IV/pp_0001_25/gra_sgb004_p_0023a.html
- EStG / SolZG / AO: https://www.gesetze-im-internet.de/estg/ · /solzg_1995/ · /ao_1977/
- EStReformG 2027: https://dserver.bundestag.de/btd/21/082/2108235.pdf
- SV-Rechengrößen 2027: https://www.bmas.de/DE/Service/Gesetze-und-Gesetzesvorhaben/sozialversicherungs-rechengroessenverordnung-2027.html
- DRV Kindererziehung: https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Familie-und-Kinder/Kindererziehung
- Kinderkrankengeld: https://www.bundesgesundheitsministerium.de/themen/praevention/kindergesundheit/faq-kinderkrankengeld
- Cologne Elternbeiträge: https://www.stadt-koeln.de/service/produkte/00405/index.html (Satzung PDF: https://www.stadt-koeln.de/mediaasset/content/satzungen/elternbeitraege_20250417.pdf)
- Little Bird Cologne FAQ: https://www.stadt-koeln.de/artikel/65229/index.html
- KiBiz NRW: https://recht.nrw.de/lrgv/gesetz/01082026-gesetz-zur-fruehen-bildung-und-foerderung-von-kindern-kinderbildungsgesetz
- Destatis child consumption (2018: couples, child < 6: 679 EUR/month incl. childcare): https://www.destatis.de/DE/Presse/Pressemitteilungen/Zahl-der-Woche/2021/PD21_26_p002.html
