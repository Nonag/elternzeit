# AGENTS.md

Guide for coding agents and developers. What the app does and how to deploy it: [README.md](README.md).

## Overview

Vue 3 app for planning German Elterngeld and Elternzeit for births in 2027. Everything is calculated in the browser;
the build is one self-contained `dist/index.html`. An optional Node server (`server/`) serves that file and stores
plannings so several people can open and save them. Results are estimates, not legal or tax advice.

Stack: Vite, Vue 3, TypeScript, Tailwind 4, shadcn-vue (reka-ui), Unovis charts, `@tanstack/vue-table`,
`@vueuse/core`, `lohnsteuerrechner` (wage tax), `vite-plugin-singlefile`. Node 24 for the server.

## Commands

```bash
npm install
npm run dev        # Vite on :5173, /api is proxied to :8080 (start npm run server for server features)
npm run server     # sync server on :8080, serves dist/index.html, data in ./elternzeit
npm test           # Vitest: engine, store migration, planning diff, server API
npm run build      # vue-tsc typecheck + dist/index.html
npm run docker     # builds the image locally and runs it with docker compose (.env.docker) on :8080
```

Before every commit run `npm test` and `npm run build`. Spec files under `src/` are excluded from the typecheck, so keep
them type-correct by hand. Check UI changes in a browser, in light and dark mode. To try the server without touching
`./elternzeit`, use another port and data folder: `PORT=8091 DATA_DIR=/tmp/elternzeit-test npm run server`.

## Structure

```
src/
  engine/              pure TypeScript calculation core, no Vue, unit-tested
    types.ts           inputs of a variant: VariantConfig, ParentConfig, PlanPeriod …
    example.ts         example values (exampleConfig) for new variants and "Auf Beispielwerte zurücksetzen"
    simulate.ts        simulate(config) → SimulationResult (result.ts): monthly rows, summaries, issues
    params.ts          legal parameters per year; EXPECTED_CHANGES lists what is not law yet
    payroll.ts, tax.ts gross → net (PAP 2026 via lohnsteuerrechner plus the draft 2027 tariff)
    parentalAllowance.ts, maternity.ts, oneTimePayments.ts, childcare.ts, vacation.ts, pension.ts
    plan.ts            plan periods and presets (PLAN_PRESETS)
    rules.ts, tips.ts  rule checks and tips; deadlines.ts: Fristen; dates.ts: ISO dates and Lebensmonate
  stores/variants.ts   variants of this browser (localStorage), current variant, file format and migration
  stores/planning.ts   open, create, save and delete the planning on the server
  lib/                 planningApi.ts (HTTP client), planningDiff.ts (conflict summary), dialogs.ts, format.ts
  components/          inputs/ (sidebar), plan/ (plan card), results/ (table, charts, tabs), dialogs/, fields/,
                       ui/ (shadcn-vue, generated)
  App.vue, AdminApp.vue   main app and the /admin page; main.ts picks one by path
server/                main.ts (environment), server.ts (HTTP API), store.ts (SQLite)
docs/research-notes.md legal research with sources
```

## UI terms in code

| UI (German) | Code |
|---|---|
| Planung: all variants, exported or saved on the server | `PlanningData`, `usePlanning()` |
| Variante | `Variant` with `config: VariantConfig`, `useVariants()` |
| Plan (periods in the plan card) | `config.periods`: `PlanPeriod[]` per parent, `PeriodEditor`, `PlanTimeline` |
| Vorlage | `PLAN_PRESETS[].outline` (`PlanOutline`), `periodsFromOutline()` |
| Basiselterngeld / ElterngeldPlus / Partnerschaftsbonus | `allowance: AllowanceType` = `basic` / `plus` / `bonus` |
| Art: Elternzeit / Arbeit | `PlanPeriod.kind` = `leave` / `work` |
| Tage (working days per week) | `PlanPeriod.workDays` |
| Urlaub (whole weeks below the periods) | `config.vacation`: `VacationPeriod[]` per parent; days per calendar year in `vacation.ts` |
| Mutter / Vater (renamable) | parents `a` / `b`; `a` has the Mutterschutz |
| Lebensmonat | `lifeMonth()`, 1-based month index |
| Beispielwerte | `exampleConfig()` |
| Fixkosten pro Monat / Kontostand zur Geburt / Mindestreserve | `fixedCosts` / `balanceAtBirth` / `minReserve` |
| Kita | `childcare` |
| Familie & Freunde | `familyCare` (`FamilyCarePeriod`) |
| Einmalzahlungen | `oneTimePayments` |
| Monatsplan | `MonthlyTable`, `result.months` |
| Hinweise & Tipps | `IssuesPanel`, `result.issues` from `rules.ts` and `tips.ts` |
| Fristen | `DeadlinesPanel`, `computeDeadlines()`, ticked off in `config.doneDeadlines` |
| Rente & Vermögen | `LongTermPanel`, `result.longTerm`; Kindererziehungszeiten für = `childRaisingCreditTo` |
| Rechtsstand | `LegalBasisPanel` |
| nicht gespeichert | `unsaved` (differs from the last opened or saved server state) |
| Planung öffnen | `openSession()` → session token |

## Conventions

- **Language:** code, comments, logs and internal errors in English; German legal terms (Lebensmonat,
  Bemessungszeitraum …) are fine. All UI text is German.
- **UI text:** short and plain, using the terms above; no new terms, no pointers to other places in the app.
- **"…"** ends every entry that asks for more input, confirmations included. "Planung speichern …" only when saving
  will ask for a name or the password.
- **Plannings** are opened and saved, never "angemeldet". Remembering is the checkbox "Passwort auf diesem Gerät merken".
- **Components:** use shadcn-vue (`npx shadcn-vue@latest add <name>`) and what reka-ui, @vueuse/core or
  @tanstack/vue-table offer before building your own. Dialogs only via `src/lib/dialogs.ts` (`confirmDialog`,
  `promptDialog`, `messageDialog`), never `window.alert`, `confirm` or `prompt`.
- **Availability:** never show or hide UI depending on the environment. Keep it visible, disabled, with a tooltip that
  says why (e.g. server entries when the file is opened from disk).
- **Layout:** no horizontal scrollbar in the plan card; mother and father periods side by side; date pickers stay
  open until a click outside; monthly table with sticky header and 12 visible months; KPI cards wrap evenly; one open
  sidebar section at a time.
- **Engine:** no Vue imports; components read `config` and `result` from `useVariants()`.
- **Law:** "voraussichtlich geltendes Recht" = enacted law plus `EXPECTED_CHANGES`. No full income tax assessment,
  only rough hints in the tips.
- **Colour mode:** `useColorMode` from @vueuse/core; the inline script in `index.html` applies the stored mode before
  the first paint and must use the same key.
- **Commits:** Conventional Commits (`feat(ui):`, `fix(engine):`, `refactor:`, `docs:`, `build(docker):` …), small,
  each one passing tests and build.
- **No personal data** in code, tests, docs or commits: no real names, birth dates, salaries, addresses or host paths.

## Stored data and migration

- The browser keeps its state in localStorage under `elternzeit-planer:v1` (the key stays for compatibility).
- Export files and the server store `PlanningData`: `{ app: 'elternzeit-planer', version: 2, variants }`.
- Everything loaded goes through `parsePlanning()` / `migrateConfig()` in `src/stores/variants.ts`: missing fields get
  the example value, fields that no longer exist are dropped.
- Renaming a config field: add `old: 'new'` to `RENAMED_FIELDS`. Changing a field's meaning: convert it in
  `migrateConfig()`. Cover both in `src/stores/variants.spec.ts`. Bump `version` only if the file shape changes.

## Sync server

No npm dependencies; Node runs the TypeScript directly (type stripping, `erasableSyntaxOnly`): no enums, no parameter
properties, imports with `.ts`. The Dockerfile copies the server files one by one, so add new ones there.

| Endpoint | Purpose |
|---|---|
| `GET /api/status` | admin password set, number of plannings, limit |
| `POST /api/admin/setup` | sets the admin password once (asked on the first visit) |
| `GET /api/admin/plannings`, `POST /api/admin/plannings/delete` | admin page, Basic auth |
| `POST /api/planning` | creates a planning (name, password, data), returns a session token |
| `POST /api/planning/session` | opens a planning with name and password, returns a session token |
| `GET`, `PUT`, `DELETE /api/planning` | load, save, delete with the Bearer token; `PUT` sends `baseVersion` and gets 409 with the server state on conflicts, `force` overwrites |

Other paths serve `dist/index.html`. Environment: `PORT` (8080), `DATA_DIR` (`./elternzeit`), `MAX_PLANNINGS` (50).

## Docker and CI

- `Dockerfile`: tests and builds in a Node 24 stage; the runtime image holds Node, `dist/index.html` and the server.
  It listens on port 80 with data in `/data`, mounted from `${CONFIG_ROOT}/elternzeit` (`docker-compose.yaml`).
- `.github/workflows/docker.yml`: every push to `main` builds amd64 and arm64 and pushes the image to GHCR with the
  tags `latest` and `sha-<commit>`.
- `./elternzeit` (git-ignored) holds the locally saved plannings; don't delete it.

## Time-sensitive

Legal state: 2026-11-10, details and sources in `docs/research-notes.md`.

- `lohnsteuerrechner` covers PAP 2025/2026 only; `src/engine/tax.ts` adds the draft 2027 tariff. Switch to the PAP 2027
  once it is published.
- Move `EXPECTED_CHANGES` (EStReformG 2027, SV-Rechengrößen 2027, Pflegereform) to law or correct them once decided.
- The BEEG reform draft for births from 2027-11-01 is not modelled.
- Kita fees use the Cologne statute of 2025-04-17; KiBiz changes the hour steps from 2027-08-01.
