/**
 * Task 8 — dataset-wide invariants, run over all 25 real cases (1765 students).
 *
 * This is the one test file allowed to read the supplied dataset directly:
 * everywhere else the engine is exercised with hand-built fixtures. The exact
 * aggregate figures here are quoted in docs/spec.md and were computed by this
 * same engine — they are pinned, not estimated.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditCase } from './audit.js';
import { buildChecklists } from './checklists.js';
import { evaluateCase } from './engine.js';
import { summarise } from './summary.js';
import type { RawDataset, StudentResult } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(here, '../../data/P08_school_results_public.json');

const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8')) as RawDataset;

const allResults: StudentResult[] = [];
for (const c of raw.cases) allResults.push(...evaluateCase(c));

describe('dataset shape', () => {
  test('25 cases, 1765 students total', () => {
    assert.equal(raw.cases.length, 25);
    assert.equal(allResults.length, 1765);
  });
});

describe('per-student invariants, checked over every one of the 1765 students', () => {
  test('GPA is within [0.00, 5.00] and never negative', () => {
    for (const r of allResults) {
      assert.ok(r.gpaHundredths >= 0 && r.gpaHundredths <= 500, `${r.id} GPA out of range: ${r.gpaValue}`);
    }
  });

  test('letter is consistent with GPA and cancellation', () => {
    for (const r of allResults) {
      if (!r.passed) {
        assert.equal(r.letter, 'F', `${r.id} is cancelled but letter is ${r.letter}`);
        assert.equal(r.gpaValue, '0.00', `${r.id} is cancelled but GPA is ${r.gpaValue}`);
      } else {
        assert.notEqual(r.letter, 'F', `${r.id} passed but letter is F`);
      }
    }
  });

  test('cancelled if and only if some compulsory grade point is 0', () => {
    for (const r of allResults) {
      const anyCompulsoryZero = r.subjects.some((s) => s.role === 'compulsory' && s.gradePointTenths === 0);
      assert.equal(!r.passed, anyCompulsoryZero, `${r.id} cancellation disagrees with compulsory zero check`);
    }
  });

  test('every trace row has a rule id and a non-empty reason', () => {
    for (const r of allResults) {
      for (const s of r.subjects) {
        assert.ok(s.ruleId, `${r.id} ${s.code} has no ruleId`);
        assert.ok(s.reason.length > 0, `${r.id} ${s.code} has an empty reason`);
      }
    }
  });

  test('a cancelled student names its failing subjects and keeps the uncancelled GPA visible', () => {
    for (const r of allResults) {
      if (!r.passed) {
        assert.ok(r.failingSubjects.length > 0, `${r.id} is cancelled with no failingSubjects`);
        assert.ok(r.gpa.uncancelledGpa.length > 0);
      }
    }
  });
});

describe('checking-list membership matches a from-scratch recomputation', () => {
  test('every case', () => {
    for (const c of raw.cases) {
      const results = evaluateCase(c);
      const lists = buildChecklists(results);

      for (const r of results) {
        const shouldBeOptional = r.subjects.some((s) => s.role === 'optional' && s.gradePointTenths <= 20);
        const shouldBePracticalFail = r.subjects.some((s) => s.practicalFailed);
        const shouldBeAbsent = r.subjects.some((s) => s.absent);

        assert.equal(r.flags.optional, shouldBeOptional, `${c.case_id}/${r.id} optional flag`);
        assert.equal(r.flags.practicalFail, shouldBePracticalFail, `${c.case_id}/${r.id} practical flag`);
        assert.equal(r.flags.absent, shouldBeAbsent, `${c.case_id}/${r.id} absent flag`);
      }

      assert.equal(lists.optional.length, results.filter((r) => r.flags.optional).length);
      assert.equal(new Set(lists.absent.map((r) => r.id)).size, results.filter((r) => r.flags.absent).length);
    }
  });
});

describe('every case passes the D1 audit (AC1 and AC2)', () => {
  for (const c of raw.cases) {
    test(`${c.case_id}`, () => {
      const results = evaluateCase(c);
      const audit = auditCase(c, results);
      const failing = audit.criteria.filter((crit) => !crit.pass);
      assert.equal(audit.pass, true, `${c.case_id} failed: ${failing.map((f) => `${f.id} (${f.detail})`).join('; ')}`);
      assert.ok(audit.hardEdgeStudents.length >= 8);
    });
  }
});

describe('aggregate sanity — figures quoted in docs/spec.md, computed by this engine', () => {
  test('compulsory-failure cancellations: 525', () => {
    assert.equal(allResults.filter((r) => !r.passed).length, 525);
  });

  test('hit the 5.00 cap before cancellation: 268', () => {
    assert.equal(allResults.filter((r) => r.gpa.capped).length, 268);
  });

  test('GPA moved by the optional rule: 886', () => {
    assert.equal(allResults.filter((r) => r.optionalChangedResult).length, 886);
  });

  test('practical fail with passing theory: 305', () => {
    let count = 0;
    for (const r of allResults) {
      for (const s of r.subjects) {
        if (s.hasPractical && !s.absent && s.theory !== null && s.theory >= 25 && s.practicalFailed) count += 1;
      }
    }
    assert.equal(count, 305);
  });

  test('absent in the optional subject: exactly 25', () => {
    const count = allResults.filter((r) => {
      const opt = r.subjects.find((s) => s.role === 'optional');
      return opt !== undefined && opt.absent;
    }).length;
    assert.equal(count, 25);
  });

  test('students on more than one checking list: 301', () => {
    let count = 0;
    for (const c of raw.cases) {
      count += buildChecklists(evaluateCase(c)).multiple.length;
    }
    assert.equal(count, 301);
  });
});

describe('performance (AC7)', () => {
  test('recomputing all 25 cases takes under 2 seconds', () => {
    const started = performance.now();
    for (const c of raw.cases) {
      const results = evaluateCase(c);
      summarise(c.case_id, results);
      buildChecklists(results);
      auditCase(c, results);
    }
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 2000, `took ${elapsed.toFixed(1)}ms`);
  });
});
