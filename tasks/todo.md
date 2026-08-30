# Tasks: P08 — School Result Processing and GPA Engine

Spec: `docs/spec.md` · Plan: `tasks/plan.md`

**Definition of done — every task clears this bar before it counts as done:**
`pnpm run typecheck` clean · `pnpm test` green · no new runtime dependency ·
no threshold or band written outside `shared/src/rules.ts` · no float in the grading path.

---

## Phase 1 — Engine foundation

### Task 1: Mark parsing and display formatting
**Description:** Turn a `RawMark` into the parts the rules need (theory, practical, total,
absent) and into the strings the office reads. One place decides that a practical subject's
mark is theory + practical and that `AB` displays as `AB`.

**Acceptance criteria:**
- [x] `partsOf(subject, raw)` returns `{ theory, practical, total, absent }` with `null` for
      parts a subject does not have; a non-practical subject has `theory = null`,
      `practical = null`, `total = the whole number`.
- [x] Display helpers render `AB` for absent, `52` / `19` / `71` for a split subject and
      `—` / `—` / `68` for a plain one; grade points as `4.5`, GPA as `4.08`.
- [x] Malformed input (a split mark on a non-practical subject, a missing part, a mark out
      of range) throws a named error naming the student, subject and value.

**Verify:** `node --test shared/dist/format.test.js` · `pnpm run typecheck`
**Dependencies:** None
**Files:** `shared/src/format.ts`, `shared/src/format.test.ts`
**Scope:** S

---

### Task 2: Per-subject grading with trace (R-11, R-12, R-GP, R-PS)
**Description:** The heart of the engine. One function takes a subject definition, a raw
mark and the subject's role, and returns a complete `SubjectTrace` — grade point in tenths,
the deciding rule id, and a teacher-readable reason quoting the actual mark and threshold.

**Acceptance criteria:**
- [x] Rule precedence is fixed and tested in this order: absent (`R-12`) → theory below 25
      (`R-11`) → practical below 8 (`R-11`) → plain mark below 33 (`R-PS`) → band (`R-GP`).
- [x] Both sides of every boundary produce the right grade point: theory 24 vs 25,
      practical 7 vs 8, total 32 vs 33, 39 vs 40, 49 vs 50, 59 vs 60, 69 vs 70, 79 vs 80.
- [x] A practical fail with passing theory returns grade point 0, `ruleId: 'R-11'`,
      `practicalFailed: true`, `theoryFailed: false` — the archetype 305 students hit.
- [x] Every returned trace has a non-empty `reason` that contains the mark and the threshold.

**Verify:** `node --test shared/dist/grade.test.js` · every branch of `grade.ts` covered
**Dependencies:** Task 1
**Files:** `shared/src/grade.ts`, `shared/src/grade.test.ts`
**Scope:** M

---

### Task 3: GPA aggregation, cap, cancellation and letter (R-13, R-10)
**Description:** Take the six compulsory traces plus the optional one and produce
`GpaWorking` — the step-by-step arithmetic the office can follow — then the letter.

**Acceptance criteria:**
- [x] `GPA = (sum of compulsory tenths + max(0, optional tenths − 20)) / 6`, computed in
      hundredths with `divideHalfUp`, capped at 500, formatted to exactly 2 decimals.
- [x] `uncancelledGpa` is the capped value; `publishedGpa` is `0.00` when any compulsory
      grade point is 0; both are present on every result (A5).
- [x] `letterFor` returns `F` whenever cancelled, regardless of the arithmetic; otherwise
      the `R-10` band of the published GPA. Tested at 4.99/5.00, 3.99/4.00, 3.49/3.50,
      2.99/3.00, 1.99/2.00, 0.99/1.00.
- [x] `steps[]` records each stage with its rule id, in order, in plain words.
- [x] An optional grade point of exactly 2.0 contributes exactly 0 and does not change the GPA.

**Verify:** `node --test shared/dist/gpa.test.js`
**Dependencies:** Task 2
**Files:** `shared/src/gpa.ts`, `shared/src/gpa.test.ts`
**Scope:** M

---

### Task 4: Compose the engine
**Description:** `evaluateStudent` and `evaluateCase` wire grading and aggregation into
`StudentResult` / `EvaluatedCase`, filling the flag fields the checking lists later read.

**Acceptance criteria:**
- [x] `evaluateStudent` populates `failingSubjects`, `absentSubjects`,
      `practicalFailSubjects`, `flags` and `optionalChangedResult` (true only when the
      optional rule actually moved the published GPA).
- [x] Pure: same input → identical output, no I/O, no clock, no randomness.
- [x] Four golden students, one per hard-edge archetype, match expectations written out
      longhand in the test file so the arithmetic is reviewable on paper.
- [x] `index.ts` exports the public surface: types, rules, engine, and nothing internal.

**Verify:** `node --test shared/dist/engine.test.js` · `pnpm --filter @p08/shared run build`
**Dependencies:** Task 3
**Files:** `shared/src/engine.ts`, `shared/src/engine.test.ts`, `shared/src/index.ts`
**Scope:** M

> ### Checkpoint A — Engine
> - [x] `pnpm --filter @p08/shared run test` green; `pnpm run typecheck` clean.
> - [x] Every boundary pair in Tasks 2 and 3 is covered by a named test.
> - [x] **Human review of the declared `R-GP` scale before Phase 2.** Everything
>       downstream inherits it.

---

## Phase 2 — Case-level outputs  *(Tasks 5, 6, 7 are independent — parallelizable)*

### Task 5: R-29 checking lists
**Description:** Build the three lists the office hand-checks, plus the combined view.

**Acceptance criteria:**
- [x] Optional list = optional grade point ≤ 2.0, inclusive, with an absent optional
      included (A6); each row carries the reason it was listed.
- [x] Practical-fail list = any subject with a numeric practical part below 8. An `AB`
      subject is **not** on this list (A4).
- [x] Absent list = any `AB` in any subject, compulsory or optional.
- [x] A student on more than one list appears on each, and once in `multiple[]`.

**Verify:** `node --test shared/dist/checklists.test.js`
**Dependencies:** Task 4
**Files:** `shared/src/checklists.ts`, `shared/src/checklists.test.ts`
**Scope:** S

---

### Task 6: Case and per-class summaries
**Description:** Rollups for the overview screen: pass/fail counts, pass rate, average GPA,
grade spread, the same broken down by class, and checking-list counts.

**Acceptance criteria:**
- [x] `CaseSummary` is fully populated; `gradeSpread` covers all seven letters including zeros.
- [x] Average GPA is computed over published GPAs in integer hundredths, half-up, and stated
      as such in the UI so the office knows cancelled students count as 0.00.
- [x] `byClass` covers exactly the classes present, counts summing to the case total.

**Verify:** `node --test shared/dist/summary.test.js`
**Dependencies:** Task 4
**Files:** `shared/src/summary.ts`, `shared/src/summary.test.ts`
**Scope:** S

---

### Task 7: D1 dataset audit and hard-edge classification
**Description:** Prove deliverable 1 rather than assert it: check roster shape per case and
name the students occupying each of the four hard edges.

**Acceptance criteria:**
- [x] Checks AC1: ≥60 students, exactly 2 classes, exactly 7 marks per student = 6 compulsory
      + the named optional, optional drawn from the case's non-compulsory subjects.
- [x] Classifies each student into the four archetypes (strong-average failure,
      practical fail with passing theory, optional ≤ 2.0, absent) and reports AC2:
      ≥1 per archetype and ≥8 hard-edge students per case.
- [x] Returns a structured report, with a `pass`/`fail` verdict per case and per criterion —
      it reports, it does not throw.

**Verify:** `node --test shared/dist/audit.test.js`
**Dependencies:** Task 4
**Files:** `shared/src/audit.ts`, `shared/src/audit.test.ts`
**Scope:** M

---

### Task 8: Dataset-wide invariant tests
**Description:** Run the engine over all 25 real cases and assert the properties that must
hold for every one of the 1765 students.

**Acceptance criteria:**
- [x] For every student: GPA within `[0.00, 5.00]`; letter consistent with GPA and
      cancellation; cancelled ⟺ some compulsory grade point is 0; every trace row has a
      rule id and a reason; checking-list membership matches a from-scratch recomputation.
- [x] Every case passes the Task 7 audit (AC1 and AC2).
- [x] Aggregate sanity assertions hold: ~525 cancelled, ~268 capped, ~886 moved by the
      optional rule, ~305 practical-fail-with-passing-theory, exactly 25 absent optionals,
      ~301 on more than one list.

**Verify:** `node --test shared/dist/dataset.test.js` · full run under 2s (AC7)
**Dependencies:** Tasks 5, 6, 7
**Files:** `shared/src/dataset.test.ts`
**Scope:** S

> ### Checkpoint B — Engine complete
> - [x] All 25 cases evaluate with zero invariant violations.
> - [x] The audit names the hard-edge students per case.
> - [x] Review the aggregate numbers against the spec's dataset audit before building transports.

---

## Phase 3 — Backend

### Task 9: Dataset loader, validation and evaluated cache
**Description:** Read `data/P08_school_results_public.json`, validate it against the schema
the types describe, evaluate every case once at boot, and hold an immutable snapshot.

**Acceptance criteria:**
- [x] Validation rejects unknown subject codes, a missing optional mark, a mark count other
      than 7, and out-of-range parts, with an error naming case, student and field.
- [x] Evaluation happens once; routes read the snapshot. Boot time is reported by `/api/health`.
- [x] The dataset path is configurable by env var, defaulting to `data/`.

**Verify:** `node --test backend/dist/dataset.test.js`
**Dependencies:** Task 8
**Files:** `backend/src/dataset.ts`, `backend/src/dataset.test.ts`, `backend/package.json`, `backend/tsconfig.json`
**Scope:** M

---

### Task 10: HTTP server and routes
**Description:** A `node:http` server with a small router exposing the seven documented
routes, and static serving of the built frontend in production so the image is one process.

**Acceptance criteria:**
- [x] All routes in the spec's API surface return the documented shapes; unknown routes 404
      with a JSON body; unknown case or student ids 404, not 500.
- [x] Responses are under 200ms per case after boot (AC7).
- [x] In production, non-`/api` paths serve `frontend/dist` with SPA fallback; in dev, Vite
      proxies `/api` to port 3000.

**Verify:** `node --test backend/dist/routes.test.js` · `pnpm start` then curl each route
**Dependencies:** Task 9
**Files:** `backend/src/server.ts`, `backend/src/routes.ts`, `backend/src/routes.test.ts`, `frontend/vite.config.ts`
**Scope:** M

---

### Task 11: Export CLI
**Description:** `pnpm run export` writes the judged artifacts to `output/`.

**Acceptance criteria:**
- [x] Per case: `results.json`, `traces.txt`, and three checking-list CSVs; plus a
      top-level `output/P08_results.json` covering all 25 cases.
- [x] `traces.txt` is readable without a viewer: per student, one line per subject showing
      the mark used, the grade point, the rule id and the reason, then the GPA working, and
      for a cancelled student the subject that caused it.
- [x] Byte-identical across two consecutive runs — stable key order, no timestamps (AC6).

**Verify:** `pnpm run export && cp -r output /tmp/o1 && pnpm run export && diff -r /tmp/o1 output`
**Dependencies:** Task 9
**Files:** `backend/src/export.ts`, `backend/src/export.test.ts`
**Scope:** M

> ### Checkpoint C — Backend
> - [x] `/api/health` reports 25 cases and 1765 students.
> - [x] Export is deterministic across runs.

---

## Phase 4 — Frontend  *(Tasks 13–16 are parallelizable once Task 12 lands)*

### Task 12: API client, app shell and case picker
**Description:** A typed fetch client reusing `@p08/shared` types, plus the shell: header,
case picker, navigation between the four screens, loading and error states.

**Acceptance criteria:**
- [x] The client's return types are the shared types — no shapes redeclared in the frontend.
- [x] Selecting a case updates the URL so a trace or list can be linked to and printed.
- [x] A failed request shows an error state, not a blank screen.

**Verify:** `pnpm --filter @p08/frontend run build` · `pnpm run dev`, click through
**Dependencies:** Task 10
**Files:** `frontend/src/api.ts`, `frontend/src/App.tsx`, `frontend/src/components/case-picker.tsx`
**Scope:** M

---

### Task 13: Case overview screen
**Description:** Summary tiles, per-class rollup, and the sortable student table with GPA,
letter and list badges.

**Acceptance criteria:**
- [x] Shows students, pass/fail, pass rate, average GPA and grade spread, per case and per class.
- [x] The student table sorts by GPA, name and class, and filters by letter and by
      checking-list membership.
- [x] A cancelled student reads unambiguously as `0.00 / F`, with the uncancelled GPA shown
      as secondary text, never as the headline number.

**Verify:** `pnpm --filter @p08/frontend run build` · compare a case's tiles against `/api/cases/:id`
**Dependencies:** Task 12
**Files:** `frontend/src/pages/overview.tsx`, `frontend/src/components/student-table.tsx`, `frontend/src/components/summary-tiles.tsx`
**Scope:** M

---

### Task 14: Per-student trace page (D3)
**Description:** The deliverable-3 screen: one row per subject showing the mark used, the
grade point and the rule that decided it, then the GPA working step by step.

**Acceptance criteria:**
- [x] Every subject row shows theory, practical, total (or `AB`), grade point, rule id and
      the plain-words reason.
- [x] The GPA working shows each `R-13` step: the six compulsory terms, the optional
      contribution as `max(0, gp − 2)`, the division by 6, the cap if it bound, and the
      published GPA and letter.
- [x] For a cancelled student, the causing subject is called out at the top by name, and the
      uncancelled GPA stays visible in the working (AC4).
- [x] The page prints legibly on one sheet.

**Verify:** open a known cancelled high-average student and re-derive the GPA by hand
**Dependencies:** Task 12
**Files:** `frontend/src/pages/student-trace.tsx`, `frontend/src/components/trace-table.tsx`, `frontend/src/components/gpa-working.tsx`
**Scope:** M

---

### Task 15: Checking lists page (D4)
**Description:** The three `R-29` lists side by side, with the reason each student is listed
and a marker for students on more than one list.

**Acceptance criteria:**
- [x] Three lists render with counts matching `/api/cases/:id/checklists`.
- [x] Each row states why: the optional grade point, the failing practical subject and mark,
      or the absent subject.
- [x] Students on more than one list are marked as such, and each list links to the student's trace.
- [x] Prints as a clean hand-checking sheet.

**Verify:** counts match the API; spot-check three students against their traces
**Dependencies:** Task 12
**Files:** `frontend/src/pages/checklists.tsx`, `frontend/src/components/checklist-table.tsx`
**Scope:** M

---

### Task 16: Rules page
**Description:** Show every rule with its text and its source, separating what the brief
said from what we declared.

**Acceptance criteria:**
- [x] All rules from `RULES` render, grouped as `brief` and `declared`.
- [x] Each declared assumption states what it affects and what would change if it were wrong.
- [x] The page is reachable from every screen.

**Verify:** compare against `/api/rules` and `docs/rules.md`
**Dependencies:** Task 12
**Files:** `frontend/src/pages/rules.tsx`
**Scope:** S

> ### Checkpoint D — End to end
> - [x] `pnpm install && pnpm run build && pnpm start` from clean, and the office flow works.
> - [x] A cancelled high-average student's trace names the subject that caused it.

---

## Phase 5 — Delivery

### Task 17: Rule card and README
**Description:** `docs/rules.md` as the one-page rule card, and a README covering how to run
it, what it produces and which assumptions we declared.

**Acceptance criteria:**
- [x] Every rule id appears with its text and its `brief`/`declared` source.
- [x] The spec's assumptions table A1–A8 is reproduced with its consequences.
- [x] The README's commands are copy-pasteable and were actually run.

**Verify:** follow the README on a clean clone
**Dependencies:** Task 16
**Files:** `docs/rules.md`, `README.md`
**Scope:** S

---

### Task 18: Dockerfile
**Description:** One image: build shared, backend and frontend, then run the backend serving
both API and static assets on port 3000.

**Acceptance criteria:**
- [x] `pnpm run docker:build && pnpm run docker:run` serves the working app on :3000.
- [x] Multi-stage build; no `node_modules` or `data/` surprises; `.dockerignore` respected.
- [x] The image runs as a non-root user.

**Verify:** `pnpm run docker:build && pnpm run docker:run`, then load the app and curl `/api/health`
**Dependencies:** Task 17
**Files:** `Dockerfile`, `.dockerignore`
**Scope:** S

> ### Checkpoint E — Complete
> - [x] Every success criterion in `docs/spec.md` is ticked.
> - [x] Docker reproduces local behaviour.
> - [x] Ready for review.

---

## Phase 6 — Calculator and persistence  *(added after the initial build)*

### Task 19: PostgreSQL persistence layer
**Description:** A `pg`-backed store for what people *do* with results. The engine and
every published grade stay independent of it — the database can be wiped without
changing a single GPA.

**Acceptance criteria:**
- [x] `saved_calculations` and `verifications` tables, schema created on boot, no migration tool.
- [x] The database is **optional**: with no `DATABASE_URL` every grading route still
      works and persistence routes return `503 database_unavailable`, never a crash.
- [x] `pg` is confined to `backend`; `shared` stays dependency-free.
- [x] `GET /api/health` reports `connected | not configured | error`.

**Verify:** `TEST_DATABASE_URL=... node --test backend/dist/db.test.js` · tests skip cleanly without it
**Files:** `backend/src/db.ts`, `backend/src/db.test.ts`
**Scope:** M

---

### Task 20: Calculator API
**Description:** Grade a typed-in mark sheet, and optionally save it.

**Acceptance criteria:**
- [x] `POST /api/calculate` grades an ad-hoc sheet and needs **no** database.
- [x] `POST /api/calculations` re-evaluates server-side and stores the engine's own
      result — a saved row can never disagree with the engine.
- [x] Malformed marks are rejected with 400 naming the field, and nothing is written.
- [x] Ad-hoc input goes through the same validator as the dataset file.

**Verify:** `node --test backend/dist/routes.test.js dist/db.test.js`
**Files:** `backend/src/routes.ts`, `backend/src/dataset.ts`
**Scope:** M

---

### Task 21: Calculator UI and hand-check sign-off
**Description:** The input-and-calculate screen, and persistent verification on the
R-29 checking lists.

**Acceptance criteria:**
- [x] Per-subject inputs for theory/practical or a single mark, plus an AB toggle,
      with the range enforced per part.
- [x] Live recomputation in the browser using the *same* `@p08/shared` engine as the
      server, so the preview cannot drift from the published result.
- [x] Each subject shows its grade point, deciding rule id and plain-words reason as
      you type; a failing part is highlighted.
- [x] Saved calculations list, reloadable into the form, deletable.
- [x] Checking lists carry a per-student verified checkbox recording who checked it
      and when, with a per-list progress count.
- [x] Every database-backed control degrades with an explanation when there is no database.

**Verify:** headless render of `?page=calculator` and `?page=checklists`; live GPA and
sign-off state confirmed against the API
**Files:** `frontend/src/pages/calculator.tsx`, `frontend/src/components/mark-input.tsx`,
`frontend/src/pages/checklists.tsx`, `frontend/src/components/checklist-table.tsx`
**Scope:** L

> ### Checkpoint F — Calculator and persistence
> - [x] `pnpm test` green with and without a database (140 tests with, 128 without).
> - [x] Container connects to Postgres, and still boots and grades with no `DATABASE_URL`.
> - [x] `docker compose up` brings up app + database together.

---

## Phase 7 — Audit page  *(added after the calculator)*

### Task 22: Surface the D1 audit in the UI
**Description:** The audit was computed, tested and served at
`GET /api/cases/:id/audit`, and typed in the API client — but no screen consumed it, so
the strongest evidence in the project was invisible to anyone who did not curl for it.
Give deliverable 1 the page it was missing.

**Acceptance criteria:**
- [x] An **Audit** page renders the verdict, both criteria groups (AC1 shape, AC2 hard
      edges) and each criterion's required-vs-found detail, with failures marked.
- [x] Each of the four archetypes gets a block explaining in plain words why that edge is
      hard and which rule it exercises, naming the candidates standing on it.
- [x] Every named candidate opens their own trace — the audit is a way into the evidence,
      not a dead end.
- [x] Candidates on more than one edge are listed separately; they are the traces worth
      reading first.
- [x] The roll carries the audit's finding as a one-line endorsement at its head, linking
      through to the full examination.
- [x] A case that falls short reports the shortfall; it does not throw and is not hidden.

**Verify:** `pnpm run typecheck` clean · `pnpm run build` clean · headless render of
`?page=audit` against `PUB-01` with no console errors, counts matching
`/api/cases/PUB-01/audit`
**Dependencies:** Task 12
**Files:** `frontend/src/pages/audit.tsx`, `frontend/src/pages/overview.tsx`,
`frontend/src/App.tsx`, `frontend/src/hooks/use-route.ts`,
`frontend/src/components/command-palette.tsx`
**Scope:** M

> ### Checkpoint G — Every deliverable has a screen
> - [x] D1 audit, D2 grading, D3 trace, D4 checking lists are each reachable from the nav.
> - [x] `9 of 9 criteria` for `PUB-01`, 29 hard-edge candidates, matching the API exactly.
