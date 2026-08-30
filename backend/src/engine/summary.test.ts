import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { evaluateCase } from './engine.js';
import { summarise } from './summary.js';
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

const student = (id: string, klass: string, overrides: Partial<Record<string, unknown>> = {}): RawStudent => ({
  id, name: id, class: klass, optional: 'HMT',
  marks: {
    BAN: 70, ENG: 70, MAT: 70,
    PHY: { theory: 55, practical: 20 }, CHE: { theory: 55, practical: 20 },
    BIO: { theory: 55, practical: 20 }, HMT: { theory: 55, practical: 20 },
    ...overrides,
  } as never,
});

describe('summarise', () => {
  test('counts, pass rate and grade spread cover the whole case with zeros included', () => {
    const caseDef: RawCase = {
      case_id: 'SUM', subjects: SUBJECTS, compulsory: ['BAN', 'ENG', 'MAT', 'PHY', 'CHE', 'BIO'],
      students: [
        student('S1', 'Class 9'),                                  // pass, 4.00 -> A
        student('S2', 'Class 9', { BIO: 'AB' }),                    // fail
        student('S3', 'Class 10'),                                  // pass, 4.00 -> A
      ],
    };
    const results = evaluateCase(caseDef);
    const summary = summarise('SUM', results);

    assert.equal(summary.students, 3);
    assert.deepEqual(summary.classes, ['Class 10', 'Class 9']);
    assert.equal(summary.passed, 2);
    assert.equal(summary.failed, 1);
    assert.equal(summary.passRate, '66.7');
    assert.equal(
      Object.values(summary.gradeSpread).reduce((a, b) => a + b, 0),
      3,
    );
    assert.equal(summary.gradeSpread.F, 1);
    assert.ok('A+' in summary.gradeSpread, 'zero-count letters are still present');
  });

  test('average GPA is over published GPA, cancelled students count as 0.00', () => {
    const caseDef: RawCase = {
      case_id: 'SUM2', subjects: SUBJECTS, compulsory: ['BAN', 'ENG', 'MAT', 'PHY', 'CHE', 'BIO'],
      students: [student('S1', 'Class 9')], // published GPA 4.00, passed
    };
    const results = evaluateCase(caseDef);
    const summary = summarise('SUM2', results);
    // 6 compulsory at 70-79 -> 4.0 each = 24.0, optional HMT 75 -> 4.0 contributes 2.0.
    // (24.0 + 2.0) / 6 = 4.3333... -> 4.33.
    assert.equal(summary.averageGpa, '4.33');
  });

  test('byClass counts sum to the case total', () => {
    const caseDef: RawCase = {
      case_id: 'SUM3', subjects: SUBJECTS, compulsory: ['BAN', 'ENG', 'MAT', 'PHY', 'CHE', 'BIO'],
      students: [
        student('S1', 'Class 9'),
        student('S2', 'Class 9'),
        student('S3', 'Class 10', { BIO: 'AB' }),
      ],
    };
    const results = evaluateCase(caseDef);
    const summary = summarise('SUM3', results);
    const total = summary.byClass.reduce((n, c) => n + c.students, 0);
    assert.equal(total, 3);
    const c10 = summary.byClass.find((c) => c.class === 'Class 10')!;
    assert.equal(c10.failed, 1);
  });
});
