# Rule card — P08 School Result Processing and GPA Engine

One page. Every rule id used anywhere in the engine, its text, and whether it
came from the brief or was declared to fill a gap the brief left open. The
single source of truth for these is `backend/src/engine/rules.ts` — this file is a
human-readable mirror of it, not a second copy to keep in sync by hand.

## From the brief

| Id | Title | Text |
|---|---|---|
| **R-10** | Letter grade | A+ = 5.00, A = 4.00–4.99, A- = 3.50–3.99, B = 3.00–3.49, C = 2.00–2.99, D = 1.00–1.99, F = fail. |
| **R-11** | Theory/practical pass marks | Theory is out of 75, pass 25. Practical is out of 25, pass 8. Failing either part fails the subject: grade point 0. |
| **R-12** | Absent | Absent in a compulsory subject: show AB, subject grade point 0, overall result F. Absent in the optional subject: it contributes 0 and the student appears on the checking list. |
| **R-13** | GPA formula and cancellation | GPA = (sum of the compulsory grade points + the larger of 0 and the optional grade point minus 2) divided by 6, capped at 5.00, shown to 2 decimal places. Any compulsory failure gives GPA 0.00 and letter F; the uncancelled average stays visible in the calculation trace. |
| **R-29** | Checking lists | Optional list = optional grade point ≤ 2.0, inclusive (an absent optional counts). Practical fail list = a practical part below 8 in any subject. Absent list = AB in any subject. A student can be on more than one list. |

## Declared assumptions

The brief doesn't state these. Each is isolated to one place in
`backend/src/engine/rules.ts` — correcting one changes every downstream grade and
nothing else.

| Id | Title | Text | Consequence if wrong |
|---|---|---|---|
| **R-GP** | Mark → grade point | 80+ = 5.0, 70–79 = 4.0, 60–69 = 3.5, 50–59 = 3.0, 40–49 = 2.0, 33–39 = 1.0, below 33 = 0.0. A practical subject's mark is theory + practical. This is the only scale under which the R-10 letter bands and the A+ = 5.00 ceiling line up. | Every published grade point and GPA changes. Fix: edit `GRADE_SCALE` in `rules.ts`. |
| **R-PS** | Non-practical pass mark | A subject with no practical part passes at 33/100 — the same proportion as the 25/75 theory pass. It changes no grade point: R-GP already gives 0 below 33. | None if R-GP is confirmed; the two are the same boundary. |

## All eight assumptions (A1–A8), with consequences

Full reasoning for each is in `docs/spec.md` → *Assumptions I'm making*; this
is the reproduction with what breaks if the assumption is wrong.

| # | Assumption | Consequence if wrong |
|---|---|---|
| A1 | The 60-student roster is the supplied dataset (25 cases, 60–80 students each), verified per case by the D1 audit rather than a hand-built roster invented on top of it. | A hand-written roster would be marked against nothing; the audit would need to run against that roster instead, unchanged otherwise. |
| A2 | Mark → grade point is the national scale (`R-GP`). | Every published grade point and GPA changes. Isolated to `GRADE_SCALE` in `rules.ts`. |
| A3 | A subject with no practical part passes at 33/100 (`R-PS`). | None if A2 holds — R-GP already gives 0 below 33, so this is the same boundary, not a second one. |
| A4 | `AB` is subject-level, never part-level, and lists on the absent list only, never the practical-fail list. | If wrong, `checklists.ts` would need a part-level absent concept, and the practical-fail count (305 in the real dataset) would shift. |
| A5 | The GPA is capped at 5.00 *before* cancellation, and that capped value is the "uncancelled average" shown in the trace. | If cancellation applied before the cap, a capped-and-failed student's uncancelled average would read wrong on the trace. Isolated to `gpa.ts`'s `aggregate()`. |
| A6 | The optional checking-list threshold is inclusive: grade point ≤ 2.0 lists the student (an absent optional, at 0.0, is included). | A strict `< 2.0` reading would drop every student whose optional lands exactly on 2.0 from the checking list. |
| A7 | Rounding is half-up at 2 decimals, done in integer hundredths — no binary float touches a grade or a GPA. | A GPA on a band edge (3.495, 4.995) could round the wrong way under float arithmetic; `divideHalfUp` in `rules.ts` is the one place this happens. |
| A8 | Cancellation applies to compulsory failures only; a failed or absent optional contributes 0 and lists the student, but never makes the result F. | If the optional could cancel a result, 25 more students (those absent in their optional) would show F instead of a real GPA. |

Measured across the real dataset: 525 cancelled by a compulsory failure, 268
hit the 5.00 cap before cancellation, 886 have their GPA moved by the
optional rule, 305 fail a practical while passing theory, 25 are absent in
their optional subject, 301 land on more than one checking list.

## Where each rule fires, in the code

```
backend/src/engine/format.ts      parses a RawMark; throws on anything malformed
backend/src/engine/grade.ts       R-12 → R-11 → R-PS → R-GP, in that precedence order
backend/src/engine/gpa.ts         R-13 aggregation, R-10 letter
backend/src/engine/checklists.ts  R-29 lists
backend/src/engine/audit.ts       D1 — proves the dataset meets the brief's shape
```

Every `SubjectTrace` carries the `ruleId` that decided its grade point and a
plain-words `reason`. Nothing is graded without both.
