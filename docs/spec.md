# Spec: P08 — School Result Processing and GPA Engine

Status: draft, awaiting review
Owner: Sayeed Joy
Dataset: `data/P08_school_results_public.json` (schema 2.1, 25 cases, 1765 students)

---

## Assumptions I'm making

These are the gaps the brief leaves open. Everything here is a decision I made, not
something the brief said. Correct any of them and the engine changes in one file
(`backend/src/engine/rules.ts`), not everywhere.

| # | Assumption | Why |
|---|---|---|
| A1 | **The 60 students already exist.** Deliverable 1 says "create at least 60 students across two classes"; the supplied dataset gives 25 cases, each 60–80 students across exactly `Class 9` and `Class 10`. We treat the dataset as the roster and *verify* the requirement per case rather than inventing a second roster. A case that fails the check is reported, not silently passed. | Judges mark against the supplied cases (`PUB-01`..`PUB-25`); a hand-written roster would be marked against nothing. |
| A2 | **Mark → grade point scale (`R-GP`, declared).** The brief fixes pass marks and letter bands but never the per-subject scale. We use the national scale: `80+ = 5.0`, `70–79 = 4.0`, `60–69 = 3.5`, `50–59 = 3.0`, `40–49 = 2.0`, `33–39 = 1.0`, `<33 = 0.0`. Subject mark for a practical subject = theory + practical. | It is the only scale under which the `R-10` letter bands and the `A+ = 5.00` ceiling line up. |
| A3 | **Non-practical subjects pass at 33/100 (`R-PS`, declared).** | Same proportion as the 25/75 theory pass, and it changes no grade point: `R-GP` already gives 0 below 33. |
| A4 | **`AB` is subject-level**, never part-level. An absent subject has no theory/practical split to test; it is grade point 0 by `R-12`, and it counts toward the **absent list only** — not the practical-fail list. | The practical-fail list is defined as "a practical part **below 8**"; `AB` is not a number below 8. |
| A5 | **Cap before cancellation.** GPA is computed, capped at 5.00, and *that* capped value is the "uncancelled average" shown in the trace. Cancellation (`R-13`) then replaces the published GPA with 0.00 / `F`. | The brief says the uncancelled average "stays visible"; it is only meaningful if it is the same number the student would have received. |
| A6 | **Optional list threshold is inclusive**: optional grade point **≤ 2.0** lists the student, so a `2.0` optional (which contributes exactly 0 after the −2) is listed, and an absent optional (0.0) is listed. | `R-29` says "2.0 or below". |
| A7 | **Rounding is half-up at 2 decimal places**, done in integer hundredths. No binary float ever touches a grade or a GPA. | A GPA that lands on a band edge (`3.495`, `4.995`) must not move because of `0.1 + 0.2`. |
| A8 | **Cancellation applies to compulsory failures only** — a failed or absent optional never makes the result `F`; it contributes 0 and lists the student. | `R-12`, `R-13`. |

The dataset makes every one of these load-bearing. Measured across all 25 cases:
525 students are cancelled by a compulsory failure, 268 hit the 5.00 cap before
cancellation, 886 have their GPA moved by the optional rule, 305 fail a practical
while passing theory, 25 are absent in their optional, 120 sit exactly on theory 25,
237 exactly on practical 8, 155 exactly on total 33, 207 exactly on total 80.

---

## Objective

Build a deterministic engine that turns the published mark sheet into a publishable
result sheet, and shows its working well enough that a teacher can re-check any
number by hand.

**User:** the exam office of a school. Not a developer. They need to publish results
and, before publishing, hand-verify the students the rules treated unusually.

**Success looks like:** the office opens one page, picks a case, and sees every
student's GPA and letter, can open any student to see how each grade point was
decided and which rule decided it, and can print three checking lists.

### The four deliverables

| D | Brief | What we ship |
|---|---|---|
| **D1** | ≥60 students, two classes, 6 compulsory + 1 optional, split theory/practical marks, ≥8 hard-edge students | A dataset audit that *proves* each case meets this, naming the students that occupy each of the four hard edges. Fails loudly if a case doesn't. |
| **D2** | Grade point per subject, then GPA and letter | The engine: `R-11`, `R-12`, `R-GP`, `R-PS` per subject; `R-13` for GPA; `R-10` for the letter. |
| **D3** | Per-student trace: mark used, grade point, deciding rule; a high-average failure must name the subject that caused it | `SubjectTrace[]` + `GpaWorking`, rendered per student in the UI and in a plain-text trace file. |
| **D4** | Office checking list: optional-rule / practical-fail / absent | Three `R-29` lists, plus a combined view marking students on more than one list (301 students across the dataset). |

### Acceptance criteria (D1–D4 as testable conditions)

- **AC1** For every case: `students ≥ 60`, exactly 2 distinct classes, every student has exactly 7 marks = 6 compulsory + their named optional, and the optional is one of the case's non-compulsory subject codes.
- **AC2** For every case, the audit names ≥1 student in each of the four hard-edge archetypes and ≥8 hard-edge students in total:
  - *strong-average failure* — a cancelled result whose uncancelled GPA is ≥ 3.50,
  - *practical fail with passing theory* — some subject with `theory ≥ 25` and `practical < 8`,
  - *optional below the helping point* — optional grade point ≤ 2.0,
  - *absent* — at least one `AB`.
- **AC3** Every subject in every trace carries a `ruleId` and a one-sentence reason; no trace row is blank or unexplained.
- **AC4** Every cancelled student's trace names its `failingSubjects` and still shows the uncancelled GPA.
- **AC5** GPA is printed to exactly 2 decimals, never above `5.00`, never negative; letter is derived only from the printed GPA plus the cancellation flag.
- **AC6** The three checking lists are reproducible: re-running the export on the same input yields byte-identical output.
- **AC7** Recomputing all 25 cases takes < 2s on a laptop and the API responds in < 200ms per case after load.

---

## Tech Stack

- **Runtime:** Node ≥ 20, ESM (`"type": "module"`), TypeScript ~6, `strict` + `noUncheckedIndexedAccess`.
- **Layout:** two independent apps, not a workspace — `backend/` (the engine in `src/engine/` plus the server) and `frontend/`, each with its own `package.json`, lockfile and `Dockerfile`, deployed as two containers. They share only the engine, and share it by copy: `scripts/sync-engine.mjs` generates `frontend/src/engine/` from `backend/src/engine/` (the source of truth) so the browser runs the same rules without pulling in any server code, and `--check` fails the build if the copy has drifted.
- **Engine (`backend/src/engine/`):** zero dependencies of its own. Pure functions, integer arithmetic. Nothing in it imports `pg` or anything else.
- **Backend:** `node:http` only — no Express, no framework. Serves the JSON API, with a `CORS_ORIGIN` allowlist because the UI is on its own origin.
- **Database:** PostgreSQL via a `DATABASE_URL` connection string, using `pg` — the one runtime dependency in `backend`, added deliberately (see *Persistence* below). the engine itself imports nothing.
- **Frontend:** React 19, Vite 8, Tailwind v4, shadcn/base-ui components, `lucide-react` icons (all already installed). Served in production by `server.mjs`, a dependency-free `node:http` static server that also renders `/env.js` from `API_URL` at request time, making the API origin a runtime setting rather than a baked-in one.
- **Tests:** `node:test` + `node:assert/strict`. No test framework dependency.

Dependency-light is deliberate: the grading rules must be auditable, and an auditor
should not have to trust a transitive dependency to believe a GPA. `pg` is used only by
`backend/src/db.ts` — no dependency reaches `src/engine/`, so everything that
decides a grade is still readable end to end with nothing to trust but the
standard library.

## Persistence

The database stores what people *do* with results, never the results themselves —
every published grade is recomputed from `data/` at boot, so the database can be
wiped without changing a single GPA.

| Table | Holds | Why it exists |
|---|---|---|
| `saved_calculations` | An ad-hoc mark sheet typed into the calculator, plus the full `StudentResult` the engine computed for it | Lets the office try "what if this student had passed the practical?" and keep the answer |
| `verifications` | Who hand-checked which student on which R-29 list, when, with an optional note | Completes D4: the brief asks for a list "so a teacher can verify those by hand" — this records that the verification actually happened |

Two properties worth stating:

- **The database is optional.** With no `DATABASE_URL` every grading route, trace,
  checking list and the calculator itself still work; only saving and sign-off
  return a `503` explaining what to set. A judge with no Postgres loses nothing
  the brief asked for.
- **Saved results are recomputed server-side, never trusted from the client.**
  `POST /api/calculations` re-runs the engine on the submitted marks and stores
  *that*, so a saved row can never disagree with the engine.

## Commands

Run inside `backend/` or `frontend/` — there is no root package.

```
backend/   pnpm install
           pnpm run dev        # tsx watch, api :3000
           pnpm run build      # engine + server -> dist/
           pnpm start          # node dist/server.js
           pnpm test           # engine + server tests
           pnpm run typecheck
           pnpm run export     # writes backend/output/ artifacts for judging

frontend/  pnpm install
           pnpm run dev        # vite, web :5173 (proxies /api to :3000)
           pnpm run build      # tsc -b && vite build -> dist/
           pnpm start          # node server.mjs, serves dist/ on :8080

root/      node scripts/sync-engine.mjs [--check]
           docker compose up --build      # db + backend + frontend
```

Focused test runs while working:

```
cd backend
pnpm run build
node --test dist/engine/gpa.test.js
node --test $(ls dist/*.test.js dist/engine/*.test.js)
```

## Project Structure

```
data/                       Supplied dataset (read-only, committed)
docs/spec.md                This document
docs/rules.md               Rule card: every rule id, its text, brief or declared
tasks/plan.md               Implementation plan
tasks/todo.md               Ordered task checklist

backend/src/engine/
  types.ts                  Raw dataset shapes + engine output shapes      [exists]
  rules.ts                  Every constant, band and rule text. One file.  [exists]
  grade.ts                  Per-subject grading: R-11, R-12, R-GP, R-PS
  gpa.ts                    R-13 aggregation + R-10 letter
  engine.ts                 evaluateStudent / evaluateCase — composes the above
  checklists.ts             R-29 lists
  summary.ts                Per-case and per-class rollups
  audit.ts                  D1 dataset audit + hard-edge classification
  format.ts                 Display formatting (AB, 52+19, 2 decimals)
  index.ts                  Public surface; copied to frontend/src/engine by scripts/sync-engine.mjs
  *.test.ts                 Co-located tests, compiled to dist and run there

backend/src/
  dataset.ts                Load + validate the JSON, evaluate once, cache
  routes.ts                 API surface
  server.ts                 node:http server, CORS allowlist
  export.ts                 CLI: writes output/ artifacts
  *.test.ts

frontend/src/
  api.ts                    Typed fetch client for the API
  pages/                    Overview, Audit, StudentTrace, Checklists, Calculator, Rules
  components/               Tables, trace rows, list badges, case picker
  components/ui/            shadcn primitives                              [exists]

backend/.env.example        Committed template; backend/.env is git-ignored
frontend/.env.example       Committed template; frontend/.env is git-ignored
output/                     Generated, git-ignored
```

## API surface

```
GET /api/cases                        → [{ caseId, students, classes, passRate, averageGpa }]
GET /api/cases/:id                    → EvaluatedCase (results + summary)
GET /api/cases/:id/students/:sid      → StudentResult (full trace)
GET /api/cases/:id/checklists         → { optional[], practicalFail[], absent[], multiple[] }
GET /api/cases/:id/audit              → D1 audit result for that case
GET /api/rules                        → RULES, brief vs declared
GET /api/health                       → { ok, cases, students, evaluatedInMs, database }

POST   /api/calculate                 → grade an ad-hoc mark sheet (no database needed)
POST   /api/calculations              → grade it and save it
GET    /api/calculations              → saved calculations, newest first
GET    /api/calculations/:id          → one saved calculation
DELETE /api/calculations/:id          → delete one

GET    /api/cases/:id/verifications                    → R-29 sign-off state for a case
POST   /api/cases/:id/verifications                    → record a hand-check
DELETE /api/cases/:id/verifications/:sid/:list         → clear a hand-check
```

Routes that need the database return `503 database_unavailable` when
`DATABASE_URL` is unset, never a crash.

## Code Style

Grade points are integer **tenths** (`45` === 4.5); GPA is integer **hundredths**
(`408` === 4.08). Floats appear only in the final `.toFixed()`. Every derived value
carries the rule id that produced it.

```ts
/** R-11 + R-GP: grade one subject, and say which rule decided it. */
export function gradeSubject(subject: SubjectDef, raw: RawMark, role: SubjectRole): SubjectTrace {
  if (raw === ABSENT) {
    return traceOf(subject, role, {
      gradePointTenths: 0,
      ruleId: 'R-12',
      reason: role === 'compulsory'
        ? 'Absent in a compulsory subject — grade point 0 and the result is cancelled.'
        : 'Absent in the optional subject — contributes 0 and goes on the checking list.',
      absent: true,
    });
  }

  const { theory, practical, total } = partsOf(subject, raw);

  if (theory !== null && theory < THEORY_PASS) {
    return traceOf(subject, role, {
      gradePointTenths: 0,
      ruleId: 'R-11',
      reason: `Theory ${theory} is below the pass mark of ${THEORY_PASS}, so the subject fails.`,
      theoryFailed: true,
    });
  }
  // ...practical, then the R-GP band
}
```

Conventions:

- One rule, one place. A number that comes from the brief lives in `rules.ts` and is
  referenced, never re-typed at a call site.
- Engine functions are pure: `(input) => output`, no I/O, no clock, no randomness.
- `reason` strings are written for a teacher, not a developer: they quote the actual
  mark and the actual threshold.
- Names say what the rule says: `practicalFailSubjects`, `uncancelledGpa`,
  `optionalContribution`.
- No `any`. No non-null `!` in the grading path — `noUncheckedIndexedAccess` is on.

## Testing Strategy

`node:test` against compiled `dist`. Four levels:

1. **Rule unit tests** (`grade.test.ts`, `gpa.test.ts`) — one test per rule, including
   both sides of every boundary: theory 24/25, practical 7/8, total 32/33, 79/80,
   optional grade point exactly 2.0, GPA 4.995 and 5.005 against the cap, and
   `divideHalfUp` on negatives and exact halves.
2. **Golden-student tests** (`engine.test.ts`) — hand-computed expectations for one
   student of each hard-edge archetype, written out longhand in the test so the
   arithmetic is reviewable without running anything.
3. **Dataset invariants** (`dataset.test.ts`) — run over all 25 cases: GPA in
   `[0.00, 5.00]`; letter consistent with GPA and cancellation; cancelled ⟺ some
   compulsory grade point is 0; every trace row has a rule id; checking-list
   membership matches a from-scratch recomputation.
4. **API/export tests** — each route's shape, and export determinism (run twice,
   compare bytes).

Coverage expectation: 100% of `backend/src/engine/grade.ts`, `gpa.ts`, `checklists.ts`
branches. Elsewhere, tests follow risk, not percentage.

## Boundaries

**Always**
- Put any new rule, threshold or band in `backend/src/engine/rules.ts` with a rule id and a
  `source` of `brief` or `declared`.
- Run `pnpm test && pnpm run typecheck` before calling a task done.
- Keep grading arithmetic in integers.
- Give every declared assumption a visible home in the UI (`/rules`) and in `docs/rules.md`.

**Ask first**
- Adding any runtime dependency to `backend`. (`pg` was approved and added for
  persistence; `src/engine/` is still and should stay dependency-free.)
- Changing a rule's meaning, or reinterpreting a brief clause differently from this spec.
- Editing anything in `data/` — the supplied dataset is read-only evidence.
- Changing the API contract once the frontend consumes it.

**Never**
- Hard-code a grade point, threshold or band outside `rules.ts`.
- Use floating-point arithmetic to decide a band or a pass/fail.
- Special-case a specific student id or case id to make a test pass.
- Delete or skip a failing test to go green.
- Commit generated `output/`.

## Success Criteria

- [ ] `pnpm test` passes; `pnpm run typecheck` clean across all three packages.
- [ ] AC1–AC7 above hold for all 25 cases.
- [ ] `pnpm run export` produces, per case: `results.json`, `traces.txt`,
      `checklist-optional.csv`, `checklist-practical-fail.csv`, `checklist-absent.csv`,
      plus a top-level `output/P08_results.json` covering every case.
- [ ] The UI shows: case overview with per-class rollup, a student list with GPA and
      letter, a per-student trace page, the three checking lists, and a rules page
      separating brief rules from declared assumptions.
- [ ] A teacher can take any published GPA and re-derive it from the trace on paper.
- [ ] `docs/rules.md` lists every rule id with its source, and every declared
      assumption from this spec appears there.

## Open Questions

1. **A2 (the `R-GP` scale) is the biggest single risk** — every grade point depends on
   it and the brief does not state it. If the judges publish a different scale, we change
   `GRADE_SCALE` in `rules.ts` and nothing else. Confirm the national scale is intended.
2. Should the trace's "average" shown for a high-average failure be the **uncancelled GPA**
   (our choice) or the **average of the subject marks**? We currently show both; confirm
   which one the office wants printed.
3. Should the exported result sheet include the uncancelled GPA for cancelled students,
   or is that trace-only? Publishing it may confuse parents; withholding it hides the
   working. Default: trace-only, present in `results.json`, absent from the printed sheet.
4. Is a fixed roster of our own (D1 read literally) wanted *in addition to* the supplied
   cases? Default per A1: no — audit the supplied cases instead.
