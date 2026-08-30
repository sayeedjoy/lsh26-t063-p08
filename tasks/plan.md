# Implementation Plan: P08 — School Result Processing and GPA Engine

Spec: `docs/spec.md`. Read the assumptions table there before touching `rules.ts`.

## Overview

Build the grading engine bottom-up in `@p08/shared` as pure integer arithmetic, prove
it against hand-computed golden students and dataset-wide invariants, then expose it
twice: as a JSON API + export CLI in `@p08/backend`, and as the office-facing UI in
`@p08/frontend`. The engine is the product; the server and the UI are two views of it.

Current state: `shared/src/types.ts` and `shared/src/rules.ts` already exist and are
complete — all output shapes and every rule constant, band and rule text are written.
`backend/src` is empty. `frontend/src` is a bare Vite + shadcn scaffold. The dataset
sits at `data/P08_school_results_public.json`.

## Architecture Decisions

- **Integer tenths and hundredths, never floats.** Grade points as tenths (`45` = 4.5),
  GPA as hundredths (`408` = 4.08). 155 students sit exactly on total 33 and 237 exactly
  on practical 8; a float that drifts by 1e-15 changes a real result. `divideHalfUp`
  already exists in `rules.ts` for this.
- **The trace is a first-class output, not logging.** `gradeSubject` returns a
  `SubjectTrace` — the grade point and the rule that decided it are produced together, so
  they cannot disagree. There is no separate "explain" pass to fall out of sync.
- **One rule file.** Any threshold or band is referenced from `rules.ts`. If a judge
  disputes the declared `R-GP` scale, the fix is one array.
- **Cancellation is applied last and kept separate from the arithmetic.** `GpaWorking`
  carries `uncancelledGpa` and `publishedGpa` side by side, which is exactly what `R-13`
  asks to stay visible.
- **Zero runtime dependencies in `shared` and `backend`.** `node:http` for the server,
  `node:test` for tests. An auditor should not have to trust a transitive dependency to
  believe a GPA.
- **Evaluate once at boot, cache in memory.** 1765 students across 25 cases is small; the
  whole dataset evaluates in well under a second, so every route reads from one immutable
  evaluated snapshot and the API stays trivially deterministic.
- **Vertical slices after the foundation.** Once the engine exists, each remaining slice
  (overview, trace, checklists, audit) goes engine → API → UI in one task so every task
  ends with something the office can actually look at.

## Dependency Graph

```
rules.ts + types.ts  [already written]
        │
        ├── format.ts ──────────────┐
        │                           │
        └── grade.ts  (R-11/12/GP/PS)
                │                   │
                └── gpa.ts (R-13/R-10)
                        │           │
                        └── engine.ts ◄┘
                                │
                ┌───────────────┼────────────────┬─────────────┐
                │               │                │             │
          checklists.ts    summary.ts        audit.ts       index.ts
             (R-29)                            (D1)            │
                └───────────────┴────────────────┴─────────────┘
                                │
                    backend/dataset.ts (load + validate + evaluate + cache)
                                │
                ┌───────────────┴───────────────┐
                │                               │
          backend/routes.ts + server.ts    backend/export.ts (CLI artifacts)
                │
          frontend/api.ts
                │
        ┌───────┼────────┬──────────────┐
    Overview  Trace   Checklists     Rules page
```

Bottom-up order: grading before aggregation, aggregation before lists, engine before
any transport, API contract before the frontend consumes it.

## Task List

### Phase 1: Engine foundation (the risky part, done first)

- [ ] Task 1: Mark parsing and display formatting (`format.ts`)
- [ ] Task 2: Per-subject grading with trace — R-11, R-12, R-GP, R-PS (`grade.ts`)
- [ ] Task 3: GPA aggregation, cap, cancellation and letter — R-13, R-10 (`gpa.ts`)
- [ ] Task 4: Compose `evaluateStudent` / `evaluateCase` (`engine.ts`, `index.ts`)

### Checkpoint: Engine
- [ ] `pnpm --filter @p08/shared run test` passes, including every boundary pair
      (theory 24/25, practical 7/8, total 32/33, 79/80, optional gp exactly 2.0, GPA cap).
- [ ] Four golden students — one per hard-edge archetype — match hand-computed values
      written longhand in the test file.
- [ ] `pnpm run typecheck` clean.
- [ ] **Review with human before proceeding.** This is where the declared `R-GP`
      assumption becomes load-bearing across everything downstream.

### Phase 2: Case-level outputs

- [ ] Task 5: R-29 checking lists (`checklists.ts`)
- [ ] Task 6: Case and per-class summaries (`summary.ts`)
- [ ] Task 7: D1 dataset audit and hard-edge classification (`audit.ts`)
- [ ] Task 8: Dataset-wide invariant tests over all 25 cases (`dataset.test.ts`)

### Checkpoint: Engine complete
- [ ] All 25 cases evaluate with zero invariant violations.
- [ ] The audit reports AC1 and AC2 satisfied for every case, naming the students that
      occupy each hard edge.
- [ ] Expected magnitudes hold (sanity, from the spec's dataset audit): ~525 cancelled,
      ~268 capped, ~886 moved by the optional rule, ~305 practical-fail-with-passing-theory,
      25 absent optionals, ~301 students on more than one list.

### Phase 3: Backend — API and export

- [ ] Task 9: Dataset loader, validation and evaluated cache (`dataset.ts`)
- [ ] Task 10: HTTP server and routes (`server.ts`, `routes.ts`)
- [ ] Task 11: Export CLI producing the judged artifacts (`export.ts`)

### Checkpoint: Backend
- [ ] `pnpm start` serves every documented route; `/api/health` reports 25 cases.
- [ ] `pnpm run export` run twice produces byte-identical `output/`.
- [ ] Backend tests pass.

### Phase 4: Frontend — the office's four screens

- [ ] Task 12: API client, app shell, case picker (`api.ts`, shell, routing)
- [ ] Task 13: Case overview — summary, per-class rollup, student table
- [ ] Task 14: Per-student trace page (D3)
- [ ] Task 15: Checking lists page (D4)
- [ ] Task 16: Rules page — brief rules vs declared assumptions

### Checkpoint: End to end
- [ ] From a cold `pnpm install && pnpm run build && pnpm start`, the office flow works:
      pick case → find student → read trace → open checking lists → print.
- [ ] A cancelled high-average student's trace names the subject that caused it.

### Phase 5: Delivery

- [ ] Task 17: `docs/rules.md` rule card and README with the assumptions table
- [ ] Task 18: Dockerfile — single image, one port, `pnpm start`

### Checkpoint: Complete
- [ ] Every success criterion in `docs/spec.md` ticked.
- [ ] `docker run` reproduces the local behaviour.
- [ ] Ready for review.

## Parallelization

- **Sequential (do not parallelize):** Tasks 1 → 4. Each is the input to the next and
  they all touch the same arithmetic conventions.
- **Parallel after Task 4:** Tasks 5, 6 and 7 are independent readers of `StudentResult`.
- **Parallel after Task 10:** Tasks 13, 14, 15 and 16 are separate pages over a frozen
  API contract. Task 11 (export) can run alongside them — it uses the engine, not the API.
- **Coordination point:** the API contract in `docs/spec.md` must be settled at Task 10
  before any two frontend tasks run at once.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The declared `R-GP` scale is not what the judges use | **High** — every grade point changes | Isolated in one array in `rules.ts`; surfaced as `source: 'declared'` in the UI and `docs/rules.md`; raised as Open Question 1 in the spec |
| Float drift moves a student across a band | High — 155 sit on total 33, 237 on practical 8 | Integer tenths/hundredths throughout; `divideHalfUp` tested on exact halves; a lint-style test asserts no `/` in the grading path |
| "Uncancelled average" misread | Medium — D3 is marked on it | `GpaWorking` carries both values explicitly; Open Question 2 flags the ambiguity rather than burying it |
| Trace and grade point drift apart | Medium | They are produced by one function call, not two passes |
| Absent-in-a-practical-subject miscategorised on the checking lists | Medium | Decided in A4 and pinned by a dedicated test: `AB` lists absent-only |
| Scope creep into UI polish before the engine is proven | Medium | Phase 1 checkpoint is a hard human review gate |
| Adding a framework "just for routing" | Low | Boundary: dependencies are ask-first |

## Open Questions

- Spec Open Questions 1–4 are unresolved and carried here: the `R-GP` scale, which
  "average" prints for a high-average failure, whether the uncancelled GPA appears on the
  published sheet, and whether a hand-built roster is wanted alongside the supplied cases.
- Does the office need printed PDF output, or is browser print of the checking lists enough?
  Assumed: browser print.
