import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { aggregate } from './gpa.js';
import { gradeSubject } from './grade.js';
import { divideHalfUp, letterFor } from './rules.js';
import type { SubjectDef } from './types.js';

const P = (code: string): SubjectDef => ({ code, name: code, practical: true });
const N = (code: string): SubjectDef => ({ code, name: code, practical: false });

const COMP: SubjectDef[] = [P('BAN'), N('ENG'), N('MAT'), P('PHY'), P('CHE'), P('BIO')].map(
  (s, i) => (i < 2 ? N(s.code) : s),
);
// COMP: BAN, ENG, MAT non-practical; PHY, CHE, BIO practical — 3 and 3, matches real dataset shape.

function pass(subject: SubjectDef, total = 70): ReturnType<typeof gradeSubject> {
  const raw = subject.practical ? { theory: Math.round(total * 0.7), practical: total - Math.round(total * 0.7) } : total;
  return gradeSubject(subject, raw as never, 'compulsory');
}

describe('R-13 arithmetic', () => {
  test('six passes at grade point 4.0 plus no optional', () => {
    const traces = COMP.map((s) => pass(s, 75)); // 75 -> 4.0
    const result = aggregate(traces, null);
    assert.equal(result.gpa.compulsorySum, '24.0');
    assert.equal(result.gpa.publishedGpa, '4.00');
    assert.equal(result.letter, 'A');
  });

  test('optional carries only what is above 2.0', () => {
    const traces = COMP.map((s) => pass(s, 75)); // sum 24.0
    const optional = gradeSubject(P('HMT'), { theory: 50, practical: 16 }, 'optional'); // 66 -> 3.5
    const result = aggregate(traces, optional);
    assert.equal(result.gpa.optionalGradePoint, '3.5');
    assert.equal(result.gpa.optionalContribution, '1.5');
    assert.equal(result.gpa.publishedGpa, '4.25'); // (24.0 + 1.5) / 6
    assert.equal(result.optionalChangedResult, true);
  });

  test('optional at exactly 2.0 contributes exactly 0 and does not change the GPA', () => {
    const traces = COMP.map((s) => pass(s, 75));
    const optional = gradeSubject(P('HMT'), { theory: 30, practical: 12 }, 'optional'); // 42 -> 2.0
    const result = aggregate(traces, optional);
    assert.equal(result.gpa.optionalGradePoint, '2.0');
    assert.equal(result.gpa.optionalContribution, '0.0');
    assert.equal(result.optionalChangedResult, false);
  });

  test('a failed optional contributes 0, never negative', () => {
    const traces = COMP.map((s) => pass(s, 75));
    const optional = gradeSubject(P('HMT'), { theory: 10, practical: 2 }, 'optional');
    const result = aggregate(traces, optional);
    assert.equal(result.gpa.optionalContribution, '0.0');
    assert.equal(result.cancelled, false, 'the optional can never fail the student');
  });

  test('the GPA caps at 5.00 after the optional is added', () => {
    const top = { theory: 70, practical: 24 }; // 94 -> 5.0
    const traces = [
      gradeSubject(N('BAN'), 95, 'compulsory'),
      gradeSubject(N('ENG'), 95, 'compulsory'),
      gradeSubject(N('MAT'), 95, 'compulsory'),
      gradeSubject(P('PHY'), top, 'compulsory'),
      gradeSubject(P('CHE'), top, 'compulsory'),
      gradeSubject(P('BIO'), top, 'compulsory'),
    ];
    const optional = gradeSubject(P('HMT'), top, 'optional');
    const result = aggregate(traces, optional);
    assert.equal(result.gpa.compulsorySum, '30.0');
    assert.equal(result.gpa.rawGpa, '5.50');
    assert.equal(result.gpa.capped, true);
    assert.equal(result.gpa.publishedGpa, '5.00');
    assert.equal(result.letter, 'A+');
  });

  test('a compulsory failure cancels the GPA but keeps the uncancelled average visible', () => {
    const traces = [
      pass(N('BAN'), 88), pass(N('ENG'), 85), pass(N('MAT'), 91),
      gradeSubject(P('PHY'), { theory: 62, practical: 22 }, 'compulsory'),
      gradeSubject(P('CHE'), { theory: 24, practical: 21 }, 'compulsory'), // theory 1 short
      gradeSubject(P('BIO'), { theory: 60, practical: 20 }, 'compulsory'),
    ];
    const optional = gradeSubject(P('HMT'), { theory: 58, practical: 19 }, 'optional');
    const result = aggregate(traces, optional);
    assert.equal(result.cancelled, true);
    assert.equal(result.gpa.publishedGpa, '0.00');
    assert.equal(result.letter, 'F');
    assert.equal(result.gpa.uncancelledGpa, '4.50', 'still visible in the trace');
    assert.deepEqual(result.failingSubjects.map((t) => t.code), ['CHE']);
    assert.ok(result.gpa.steps.some((s) => s.text.includes('CHE') || s.text.includes(traces[4]!.name)));
  });
});

describe('R-10 letter bands, both sides of every boundary', () => {
  const pairs: Array<[number, number, string, string]> = [
    [499, 500, 'A', 'A+'],
    [399, 400, 'A-', 'A'],
    [349, 350, 'B', 'A-'],
    [299, 300, 'C', 'B'],
    [199, 200, 'D', 'C'],
    [99, 100, 'F', 'D'],
  ];
  for (const [below, at, lowLetter, highLetter] of pairs) {
    test(`${below} -> ${lowLetter}, ${at} -> ${highLetter}`, () => {
      assert.equal(letterFor(below, false), lowLetter);
      assert.equal(letterFor(at, false), highLetter);
    });
  }
  test('cancelled is always F regardless of the number', () => {
    assert.equal(letterFor(500, true), 'F');
    assert.equal(letterFor(0, true), 'F');
  });
});

describe('divideHalfUp', () => {
  test('exact halves round up, negatives mirror', () => {
    assert.equal(divideHalfUp(1, 2), 1);
    assert.equal(divideHalfUp(3, 2), 2);
    assert.equal(divideHalfUp(-1, 2), -1);
    assert.equal(divideHalfUp(-3, 2), -2);
    assert.equal(divideHalfUp(4995, 1000) * 0, 0); // sanity: no exception on larger denominators
  });

  test('4.995 vs 4.999 style edges round the way a person would expect', () => {
    // simulate GPA*1000 style precision by scaling: 4995/1000 rounds to 5 (i.e. 5.00) at 0 dp
    assert.equal(divideHalfUp(4995, 1000), 5);
    assert.equal(divideHalfUp(5005, 1000), 5);
    assert.equal(divideHalfUp(5015, 1000), 5);
  });
});
