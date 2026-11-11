# Elternzeit-Planer

Planning tool for German parental allowance (Elterngeld) and parental leave (Elternzeit), built for births in 2027.
The browser keeps the working copy (localStorage). An optional small server stores plannings so several
people can open and save them; without it the app runs as a single offline file.

Wording: a **Plan** is the leave periods in the plan card, a **Variante** is one complete set of inputs including its
plan, and a **Planung** is all variants together. A Planung is what gets exported or saved on the server.

## Usage

```bash
npm install
npm run dev          # http://localhost:5173 with live reload; /api is proxied to localhost:8080
npm run server       # sync server on http://localhost:8080 (serves dist/, data in ./elternzeit)
npm run docker       # builds the image from the sources and runs it with docker compose (.env.docker), port 8080
npm run build        # dist/index.html – single self-contained file, open it by double-click
npm test             # unit tests (Vitest) for engine, server and helpers
npm run typecheck
```

## Server and Docker

`server/` is a small Node server without dependencies (Node 24: `node:sqlite`, `scrypt`, TypeScript type stripping).
It serves the app and stores plannings in SQLite:

- A planning is saved under a name and a password. Saving only works on top of the version that was loaded;
  otherwise the app shows what differs and lets the user take the server state or overwrite it.
- "Passwort auf diesem Gerät merken" keeps a session token in the browser (localStorage), otherwise it lasts for the
  tab only.
- Whoever has opened a planning can delete it ("Planung löschen …"); the variants stay in the browser.
- On the first visit the app asks for an admin password. `/admin` lists all plannings (created, last opened, last
  saved) and deletes selected ones. At most `MAX_PLANNINGS` (default 50) plannings can exist.

Every push to `main` builds a multi-arch image (amd64, arm64) and pushes it to the GitHub Container Registry, tagged
`latest` and `sha-<commit>` (`.github/workflows/docker.yml`). To run it on a server, copy `docker-compose.yaml` into
a folder and add a `.env` next to it:

```bash
CONFIG_ROOT="/srv/elternzeit"   # data in ${CONFIG_ROOT}/elternzeit
PORT=8080                       # host port
MAX_PLANNINGS=50                # optional
```

Without `CONFIG_ROOT` the data folder is `./elternzeit` next to the compose file.

## What it does

- **Plan** parental leave per parent as periods (life months, Elternzeit yes/no, weekly hours,
  Basis/Plus/Partnerschaftsbonus) directly in the plan card; presets for common models.
- **Calculates** real net pay (BMF Programmablaufplan 2026 via `lohnsteuerrechner`, plus the draft 2027/2028
  tariff), Elterngeld-Netto and
  Elterngeld (§§ 2–4 BEEG incl. income averaging, Plus cap, Mutterschaftsgeld offset per day), Kindergeld,
  Cologne Kita fees, health insurance costs during leave and a simulated account balance.
- **One-time payments** from the employer (bonus, premium) per parent and calendar month: wage tax with the annual
  table, social contributions per § 23a SGB IV incl. März-Klausel; Elterngeld stays unchanged (§ 2c BEEG).
- **Checks** Elterngeld and Elternzeit rules (parallel Basis, LM 14/32 limits, continuity, Partnerschaftsbonus,
  sections, part-time claims, income limit) plus care gaps and reserve warnings.
- **Shows** tips with an estimated euro effect, deadlines (with checklist), vacation reduction (§ 17 BEEG),
  pension points incl. Kindererziehungszeiten, lost savings and a 50/50 compensation proposal.
- **Variants** can be copied, compared and exported/imported as a JSON planning, or saved on the server.

## Development

Code structure, the code names of the UI terms, conventions and checks are in [AGENTS.md](AGENTS.md).

## Legal basis

"Voraussichtlich geltendes Recht" as of 2026-11-10: enacted law plus expected changes for 2027/2028 that are not
final yet (Einkommensteuerreformgesetz 2027 with Kindergeld 267/272 €, SV-Rechengrößen 2027, Pflegereform) – see
`EXPECTED_CHANGES` in `src/engine/params.ts` and `docs/research-notes.md`. Wage tax for 2027+ is the official PAP 2026
plus the tariff change of the draft (`src/engine/tax.ts`) until the PAP 2027 is published. Elterngeld for a 2027 birth
is based on the 2026 values by law. Results are estimates, not legal or tax advice.
