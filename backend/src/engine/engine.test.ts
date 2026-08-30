import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { StudentMarkError, evaluateCase, evaluateStudent } from './engine.js';
import type { RawCase, RawStudent, SubjectDef } from './types.js';

const SUBJECTS: SubjectDef[] = [
  { code: 'BAN', name: 'Bangla', practical: false },
  { code: 'ENG', name: 'English', practical: false },
  { code: 'MAT', name: 'Mathematics', practical: false },
  { code: 'PHY', name: 'Physics', practical: true },
  { code: 'CHE', name: 'Chemistry', practical: true },
  { code: 'BIO', name: 'Biology', practical: true },
  { code: 'HMT', name: 'Higher Mathematics', practical: true },
];

const CASE: Pick<RawCase, 'case_id' | 'subjects' | 'compulsory'> = {
  case_id: 'GOLD',
  subjects: SUBJECTS,
  compulsory: ['BAN', 'ENG', 'MAT', 'PHY', 'CHE', 'BIO'],
};

const evaluate = (student: RawStudent) => evaluateStudent(CASE, student);

describe('golden student 1 — strong-average failure', () => {
  // Marks: BAN 88, ENG 85, MAT 91, PHY 62+22, CHE 24+21 (theory one short), BIO 60+20, HMT 58+19.
  // Grade points: BAN 80+ -> 5.0, ENG 80+ -> 5.0, MAT 80+ -> 5.0, PHY 84 -> 5.0,
  //   CHE theory 24 < 25 -> R-11 -> 0.0, BIO 80 -> 5.0. Compulsory sum = 25.0.
  // Optional HMT 77 -> 4.0, contributes max(0, 4.0-2.0) = 2.0.
  // Uncancelled = (25.0 + 2.0) / 6 = 4.50. One compulsory failure (CHE) -> published 0.00, F.
  const student: RawStudent = {
    id: 'S-GOLD-1', name: 'Golden One', class: 'Class 9', optional: 'HMT',
    marks: {
      BAN: 88, ENG: 85, MAT: 91,
      PHY: { theory: 62, practical: 22 },
      CHE: { theory: 24, practical: 21 },
      BIO: { theory: 60, practical: 20 },
      HMT: { theory: 58, practical: 19 },
    },
  };

  test('matches the hand-computed values', () => {
    const r = evaluate(student);
    assert.equal(r.gpa.compulsorySum, '25.0');
    assert.equal(r.gpa.uncancelledGpa, '4.50');
    assert.equal(r.gpaValue, '0.00');
    assert.equal(r.letter, 'F');
    assert.equal(r.passed, false);
    assert.deepEqual(r.failingSubjects, ['Chemistry']);
    assert.equal(r.subjects.find((s) => s.code === 'CHE')!.ruleId, 'R-11');
  });
});

describe('golden student 2 — practical fail with passing theory', () => {
  // PHY theory 74 (passes, >=25), practical 7 (fails, <8) -> R-11, grade point 0.
  // Everything else comfortably passes. Result: cancelled by PHY alone.
  const student: RawStudent = {
    id: 'S-GOLD-2', name: 'Golden Two', class: 'Class 9', optional: 'HMT',
    marks: {
      BAN: 70, ENG: 70, MAT: 70,
      PHY: { theory: 74, practical: 7 },
      CHE: { theory: 55, practical: 20 },
      BIO: { theory: 55, practical: 20 },
      HMT: { theory: 55, practical: 20 },
    },
  };

  test('matches the hand-computed values', () => {
    const r = evaluate(student);
    const phy = r.subjects.find((s) => s.code === 'PHY')!;
    assert.equal(phy.gradePointTenths, 0);
    assert.equal(phy.ruleId, 'R-11');
    assert.equal(phy.theoryFailed, false);
    assert.equal(phy.practicalFailed, true);
    assert.equal(r.gpaValue, '0.00');
    assert.equal(r.letter, 'F');
    assert.deepEqual(r.failingSubjects, ['Physics']);
    assert.deepEqual(r.practicalFailSubjects, ['Physics']);
    assert.equal(r.flags.practicalFail, true);
  });
});

describe('golden student 3 — optional at or below the helping point', () => {
  // All six compulsory pass at 70 -> grade point 4.0 each, sum 24.0.
  // Optional HMT: theory 30 + practical 12 = 42 -> grade point 2.0 exactly.
  // Contribution = max(0, 2.0 - 2.0) = 0.0. GPA = 24.0 / 6 = 4.00.
  const student: RawStudent = {
    id: 'S-GOLD-3', name: 'Golden Three', class: 'Class 10', optional: 'HMT',
    marks: {
      BAN: 70, ENG: 70, MAT: 70,
      PHY: { theory: 55, practical: 20 },
      CHE: { theory: 55, practical: 20 },
      BIO: { theory: 55, practical: 20 },
      HMT: { theory: 30, practical: 12 },
    },
  };

  test('matches the hand-computed values', () => {
    const r = evaluate(student);
    assert.equal(r.gpa.optionalGradePoint, '2.0');
    assert.equal(r.gpa.optionalContribution, '0.0');
    assert.equal(r.gpaValue, '4.00');
    assert.equal(r.letter, 'A');
    assert.equal(r.passed, true);
    assert.equal(r.flags.optional, true, 'listed even though it changed nothing');
    assert.equal(r.optionalChangedResult, false);
  });
});

describe('golden student 4 — absent', () => {
  // BIO is AB: R-12 fires, grade point 0, and the whole result is cancelled.
  const student: RawStudent = {
    id: 'S-GOLD-4', name: 'Golden Four', class: 'Class 10', optional: 'HMT',
    marks: {
      BAN: 84, ENG: 79, MAT: 88,
      PHY: { theory: 66, practical: 23 },
      CHE: { theory: 60, practical: 21 },
      BIO: 'AB',
      HMT: { theory: 61, practical: 22 },
    },
  };

  test('matches the hand-computed values', () => {
    const r = evaluate(student);
    const bio = r.subjects.find((s) => s.code === 'BIO')!;
    assert.equal(bio.totalDisplay, 'AB');
    assert.equal(bio.ruleId, 'R-12');
    assert.equal(bio.gradePointTenths, 0);
    assert.equal(r.gpaValue, '0.00');
    assert.equal(r.letter, 'F');
    assert.deepEqual(r.absentSubjects, ['Biology']);
    assert.deepEqual(r.failingSubjects, ['Biology']);
    assert.equal(r.flags.absent, true);
  });
});

describe('malformed input names the student, subject and value', () => {
  test('a bad mark throws StudentMarkError wrapping MarkFormatError', () => {
    const student: RawStudent = {
      id: 'S-BAD', name: 'Bad Data', class: 'Class 9', optional: 'HMT',
      marks: {
        BAN: 70, ENG: 70, MAT: 70,
        PHY: { theory: 90, practical: 20 }, // theory out of range
        CHE: { theory: 55, practical: 20 },
        BIO: { theory: 55, practical: 20 },
        HMT: { theory: 55, practical: 20 },
      },
    };
    assert.throws(() => evaluate(student), (err: unknown) => {
      assert.ok(err instanceof StudentMarkError);
      assert.match(err.message, /S-BAD/);
      assert.match(err.message, /Bad Data/);
      assert.match(err.message, /PHY/);
      return true;
    });
  });
});

describe('purity', () => {
  test('evaluating the same student twice gives identical output', () => {
    const student: RawStudent = {
      id: 'S-PURE', name: 'Pure Student', class: 'Class 9', optional: 'HMT',
      marks: {
        BAN: 70, ENG: 70, MAT: 70,
        PHY: { theory: 55, practical: 20 },
        CHE: { theory: 55, practical: 20 },
        BIO: { theory: 55, practical: 20 },
        HMT: { theory: 55, practical: 20 },
      },
    };
    assert.deepEqual(evaluate(student), evaluate(student));
  });

  test('evaluateCase evaluates every student in order', () => {
    const caseDef: RawCase = {
      ...CASE,
      students: [
        { id: 'A', name: 'A', class: 'Class 9', optional: 'HMT', marks: {
          BAN: 70, ENG: 70, MAT: 70,
          PHY: { theory: 55, practical: 20 }, CHE: { theory: 55, practical: 20 },
          BIO: { theory: 55, practical: 20 }, HMT: { theory: 55, practical: 20 },
        } },
        { id: 'B', name: 'B', class: 'Class 10', optional: 'HMT', marks: {
          BAN: 40, ENG: 40, MAT: 40,
          PHY: { theory: 30, practical: 10 }, CHE: { theory: 30, practical: 10 },
          BIO: { theory: 30, practical: 10 }, HMT: { theory: 30, practical: 10 },
        } },
      ],
    };
    const results = evaluateCase(caseDef);
    assert.deepEqual(results.map((r) => r.id), ['A', 'B']);
  });
});
