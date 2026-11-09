# Elternzeit-Planer

Local planning tool for German parental allowance (Elterngeld) and parental leave (Elternzeit) for a child due on
2027-01-28. All data stays in the browser (localStorage); there is no backend and no deployment.

## Usage

```bash
npm install
npm run dev          # http://localhost:5173 with live reload
npm run build        # dist/index.html – single self-contained file, open it by double-click
npm test             # engine unit tests (Vitest)
npm run typecheck
```

## What it does

- **Plan** parental leave per parent as periods (life months, Elternzeit yes/no, weekly hours,
  Basis/Plus/Partnerschaftsbonus) directly in the plan card; presets for common models.
- **Calculates** real net pay (BMF Programmablaufplan 2026 via `lohnsteuerrechner`, plus the draft 2027/2028
  tariff), Elterngeld-Netto and
  Elterngeld (§§ 2–4 BEEG incl. income averaging, Plus cap, Mutterschaftsgeld offset per day), Kindergeld,
  Cologne Kita fees, health insurance costs during leave and a simulated account balance.
- **Checks** Elterngeld and Elternzeit rules (parallel Basis, LM 14/32 limits, continuity, Partnerschaftsbonus,
  sections, part-time claims, income limit) plus care gaps and reserve warnings.
- **Shows** tips with an estimated euro effect, deadlines (with checklist), vacation reduction (§ 17 BEEG),
  pension points incl. Kindererziehungszeiten, lost savings and a 50/50 compensation proposal.
- **Scenarios** can be saved, duplicated, exported/imported as JSON and compared.

## Structure

```
src/engine/        pure TypeScript calculation core (no Vue), unit-tested
  params.ts        legal parameters per year, enacted or expected (see EXPECTED_CHANGES)
  dates.ts         ISO date helpers, Lebensmonate
  payroll.ts       gross → net (wage tax, Soli, church tax, social contributions, Midijob)
  parentalAllowance.ts, maternity.ts, plan.ts, childcare.ts
  simulate.ts      config → monthly rows, summaries, issues
  rules.ts, tips.ts, deadlines.ts, vacation.ts, pension.ts
src/stores/        scenario store (localStorage, autosave)
src/components/    inputs, plan timeline/editor, results (table, charts, panels); ui/ = shadcn-vue
docs/              research notes with sources
```

## Legal basis

"Voraussichtlich geltendes Recht" as of 2026-11-10: enacted law plus expected changes for 2027/2028 that are not
final yet (Einkommensteuerreformgesetz 2027 with Kindergeld 267/272 €, SV-Rechengrößen 2027, Pflegereform) – see
`EXPECTED_CHANGES` in `src/engine/params.ts` and `docs/research-notes.md`. Wage tax for 2027+ is the official PAP 2026
plus the tariff change of the draft (`src/engine/tax.ts`) until the PAP 2027 is published. Elterngeld for a 2027 birth
is based on the 2026 values by law. Results are estimates, not legal or tax advice.
