# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A deterministic school-result engine (hackathon problem P08): raw subject marks
in, a grade point per subject, a GPA and letter per student, a full calculation
trace, and the office checking lists out. It runs against a fixed supplied
dataset of 25 cases / 1,765 students.

`README.md` covers deployment and configuration in depth. `docs/spec.md` holds
the acceptance criteria and API contract; `docs/rules.md` is the rule card.

## Two independent apps, not a monorepo

**There is no root `package.json`, no workspace and no root lockfile.**
`backend/` and `frontend/` each have their own `package.json`, lockfile and
Dockerfile, and neither depends on the other at install time. Run `pnpm`
commands from *inside* the app directory — `pnpm install` at the repo root will
fail.

```bash
# backend/  (API on :3000)
pnpm install
pnpm run dev          # tsx watch
pnpm run build        # tsc -> dist/
pnpm test             # builds first, then node:test over dist/
pnpm run typecheck
pnpm run export       # writes output/ artifacts for judging

# frontend/  (Vite on :5173, proxies /api -> :3000)
pnpm install
pnpm run dev
pnpm run build        # tsc -b && vite build
pnpm run lint
pnpm run typecheck
pnpm start            # node server.mjs, serves dist/ on :8080

# repo root (no package.json — these are run directly)
node scripts/sync-engine.mjs --check
docker compose up --build      # db (host :55432) + api (:3100) + web (:8080)
```

Local dev needs no configuration: Vite proxies `/api` to `:3000`, so the app
talks to the backend same-origin.

### Running one test

`pnpm test` compiles to `dist/` first, so a focused run needs a build and then
points `node --test` at the **compiled** file, not the `.ts` source:

```bash
cd backend
pnpm run build
node --test dist/engine/gpa.test.js
```

Database-backed tests are skipped unless a connection string is present, so
`pnpm test` stays green without PostgreSQL:

```bash
cd backend && TEST_DATABASE_URL=postgres://p08:p08@localhost:55432/p08 pnpm test
```

## The engine is vendored, not linked — read this before editing it

`backend/src/engine/` is the **source of truth**. `frontend/src/engine/` is a
generated copy, and every file in it carries a `GENERATED FILE — do not edit`
banner. The frontend needs its own copy because the Calculator page grades a
typed-in mark sheet in the browser with the *same* engine the server runs, so
the live preview cannot drift from the published result — and with no workspace
there is nothing to link through.

```bash
node scripts/sync-engine.mjs           # after ANY edit to backend/src/engine
node scripts/sync-engine.mjs --check   # exit 1 on drift — belongs in CI
```

Editing `frontend/src/engine/` directly is always wrong; the next sync silently
overwrites it. The script also deletes vendored files the backend no longer has.

**Because the same sources compile under both tsconfigs, engine code is
constrained by the stricter one.** The frontend sets `erasableSyntaxOnly`, so
the engine may not use TypeScript constructor parameter properties, `enum`, or
namespaces — see the explicit-fields comment in `engine/format.ts`. The backend
alone would accept them; the frontend build will not.

## Engine architecture

The engine is pure and dependency-free. Nothing in it does I/O, reads
`process.env`, or imports from outside `src/engine/`.

**All arithmetic is integer.** Grade points are carried as tenths (`45` ===
4.5), GPA as hundredths (`408` === 4.08), and `divideHalfUp` in `rules.ts` does
exact half-up integer division. No binary float touches the grading path, so a
mark can never land on the wrong side of a band because of `0.1 + 0.2`. Keep it
that way: introducing a float anywhere in `grade.ts`/`gpa.ts` defeats the point
of the whole design.

**`engine/rules.ts` is the only place a marking rule lives.** Pass marks, the
mark→grade-point scale, letter bands, the R-13 cap and deduction, and the
`RULES` documentation table are all there. Two rules are *declared assumptions*
rather than things the brief said (`R-GP`, `R-PS`); they are tagged
`source: 'declared'` and surfaced as such in the app's Rules page and
`docs/rules.md`. Preserve that tag — never let a declared assumption read as if
the brief stated it.

Rough data flow, source of truth first:

```
rules.ts (constants + rule docs)
  -> format.ts   parse a RawMark for a subject; all display strings
  -> grade.ts    one subject -> grade point + deciding rule id + reason
  -> gpa.ts      six compulsory + optional -> GPA, cap, cancellation, working
  -> engine.ts   evaluateStudent / evaluateCase
  -> checklists.ts (R-29 lists) · summary.ts (rollups) · audit.ts (D1 proof)
```

`engine/index.ts` is the public surface; internal helpers are deliberately not
re-exported. Import from there, not from individual modules.

### Traces are a product, not a debug aid

Every result carries the reasoning that produced it: `SubjectTrace` names the
mark used, the grade point, the deciding `ruleId` and a plain-English `reason`;
`GpaWorking` carries the step-by-step arithmetic with a rule id per step. The UI
and the exported `traces.txt` both render these. When changing grading, update
the trace text with it — a rule that fires without explaining itself is a
regression.

A cancelled result keeps its **uncancelled average** visible (R-13). Both
numbers matter and the UI shows both; do not "simplify" that to a bare 0.00.

### invariants.test.ts pins the real dataset

`backend/src/engine/invariants.test.ts` is the one test allowed to read the
supplied dataset directly (everything else uses hand-built fixtures). It asserts
exact aggregate figures over all 1,765 students — 525 cancelled, 268 capped, 886
moved by the optional rule, and so on. Those numbers are quoted in `README.md`
and `docs/spec.md`.

If a change makes these fail, that is the test doing its job. Decide whether the
behaviour change is intended; if it is, update the assertions **and** the figures
quoted in the README and spec together.

## Server

`node:http` only — no Express, no framework. `src/routes.ts` holds the whole API
as a pure `route()` function over method + path segments; `src/server.ts` only
wires sockets, CORS, body reading and static fallback to it. Routes are testable
without a socket, which is what `routes.test.ts` does.

`src/dataset.ts` loads the JSON once, validates it (every failure names the
case, student and field), evaluates every case once, and holds an immutable
snapshot. **Routes never re-run the engine or touch raw JSON** — they read the
cache. Evaluation cost is paid at boot and reported in the startup log.

### The database is optional, by design

PostgreSQL backs exactly two things: saved ad-hoc calculations, and the office's
hand-check sign-off on the checking lists. Nothing the engine does needs it.

With no `DATABASE_URL` the server still boots and every grading route works;
persistence routes return a `503 database_unavailable` with a message saying
what to set, and the UI hides those controls with an explanation. Preserve this:
a new database-backed route must go through the same `noDatabase()` guard, and a
new UI feature that needs one must degrade rather than break. `GET /api/health`
reports `connected | not configured | error`.

`POST /api/calculations` **re-evaluates the submitted sheet server-side** before
storing. A stored row can never disagree with the engine, and a client's claimed
result is never trusted.

### API surface

All under `/api`. `:id` is a case id such as `PUB-01`. Routes marked (db) return
503 without a database.

| Method | Path |
|---|---|
| GET | `/health`, `/rules`, `/cases` |
| GET | `/cases/:id`, `/cases/:id/students/:studentId`, `/cases/:id/checklists`, `/cases/:id/audit` |
| GET | `/cases/:id/verifications` (db), `/calculations` (db), `/calculations/:id` (db) |
| POST | `/calculate` — grade an ad-hoc sheet, **no database needed** |
| POST | `/calculations` (db), `/cases/:id/verifications` (db) |
| DELETE | `/calculations/:id` (db), `/cases/:id/verifications/:studentId/:listName` (db) |

`frontend/src/api.ts` is the typed client and returns the shared engine types
directly — it redeclares no result shapes. Changing a response shape means
changing the engine type, re-running the sync script, and letting the frontend
typecheck catch the fallout.

## Frontend

React 19 + Vite + Tailwind v4. No router: `hooks/use-route.ts` syncs app state
to plain query params (`?case=PUB-01&page=trace&student=S001`) via
`useSyncExternalStore`, and caches the parsed route object against the query
string that produced it — `getSnapshot` must be referentially stable or React
throws before anything mounts.

`hooks/use-async.ts` is the single data-fetch hook and ignores results from
stale runs by generation counter.

### The design system is deliberate — extend it, don't reinvent

The UI is themed as a **tabulation register** (an exam-office ledger). Two files
own that vocabulary and new UI should be built from them rather than from raw
Tailwind:

- `components/ledger.tsx` — the shapes: `Sheet` (a ruled sheet, with an optional
  `cite` margin), `SheetHead`, `Ruled`/`Th`/`Tr`/`Td` (ruled tables), `Figure`,
  `StruckFigure`, `Mark`, `Cite`, `Empty`, `SheetSkeleton`, `Pagination`.
- `index.css` — design tokens plus the component classes `.label-form`,
  `.heading-register`, `.heading-masthead`, `.cite`, `.struck`, `.badge-live`.

Conventions worth keeping:

- **Oxide red is spent on one thing only: a cancelled result.** Not on generic
  errors, not on decoration. `seal` (green) is pass/verified, `ochre` is
  checking-list attention.
- **Every figure is `font-mono` and tabular.** Numbers are the product; they must
  not shift width between renders.
- **Rule ids live in the left citation margin**, in the same column position on
  every page, so a citation seen on a trace can be found on the Rules page by
  running down the edge.
- Light, dark and **print** palettes are all defined in `index.css`. The checking
  lists are meant to leave the screen as paper — the print block forces a light
  palette, releases table `min-width` so no column clips, un-scrolls scroll
  containers, and turns the sign-off checkbox into an empty box to initial by
  hand. Check print output when touching table layout.

Verify layout changes at 320/390px. `Ruled`'s wrapper is `relative` on purpose —
an absolutely positioned descendant (a `sr-only` label, say) otherwise escapes
the scroller and reserves the table's full width as dead horizontal page scroll.

## Split deployment

The two apps deploy as two containers on two origins and find each other only
through two variables — get them wrong and the UI loads while every request
fails CORS:

- backend `CORS_ORIGIN` — the frontend's public URL (unset means no CORS headers
  at all, which is correct only when served same-origin)
- frontend `API_URL` — the backend's public URL. **Runtime, not build-time**:
  `server.mjs` renders it into `/env.js` per request, so one image points at any
  backend. `VITE_API_URL` remains a build-time fallback for static hosts.

`backend/src/env.ts` is a dependency-free `.env` loader in which **real
environment variables always win** over the file, so one image works locally and
on a platform that injects config. It logs which keys came from the file *by
name only* — never add value logging there; a connection string carries a
password.

## Existing agent configuration

No Cursor or Copilot rules are present in this repo. An OpenAI Codex config does
exist at `~/.codex/config.toml` (plus a `~/.gemini` directory). If you want those
user-level settings — MCP servers, slash commands, subagents, skills,
instructions — brought into Claude Code, reply `/import` to scan and list what is
importable, then `/import --yes=<digest>` with the digest that scan prints to
apply it. If `/import` is unavailable on this surface, run `claude import` from a
terminal instead.
