import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildChecklists } from './checklists.js';
import { evaluateStudent } from './engine.js';
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
  case_id: 'CHK', subjects: SUBJECTS, compulsory: ['BAN', 'ENG', 'MAT', 'PHY', 'CHE', 'BIO'],
};
const base = (overrides: Partial<RawStudent['marks']> = {}, optional = 'HMT'): RawStudent => ({
  id: 'S1', name: 'Test', class: 'Class 9', optional,
  marks: {
    BAN: 70, ENG: 70, MAT: 70,
    PHY: { theory: 55, practical: 20 }, CHE: { theory: 55, practical: 20 },
    BIO: { theory: 55, practical: 20 }, HMT: { theory: 55, practical: 20 },
    ...overrides,
  },
});

describe('optional list', () => {
  test('grade point at or below 2.0 is listed, above is not', () => {
    const low = evaluateStudent(CASE, base({ HMT: { theory: 30, practical: 12 } })); // 42 -> 2.0
    const high = evaluateStudent(CASE, base({ HMT: { theory: 40, practical: 15 } })); // 55 -> 3.0
    const lists = buildChecklists([low, high]);
    assert.equal(lists.optional.length, 1);
    assert.equal(lists.optional[0]!.id, 'S1');
  });

  test('an absent optional counts as 0 and is listed', () => {
    const r = evaluateStudent(CASE, base({ HMT: 'AB' }));
    const lists = buildChecklists([r]);
    assert.equal(lists.optional.length, 1);
    assert.match(lists.optional[0]!.reason, /Absent/);
  });
});

describe('practical fail list', () => {
  test('a numeric practical below 8 is listed', () => {
    const r = evaluateStudent(CASE, base({ CHE: { theory: 55, practical: 5 } }));
    const lists = buildChecklists([r]);
    assert.equal(lists.practicalFail.length, 1);
    assert.equal(lists.practicalFail[0]!.subject, 'Chemistry');
  });

  test('AB is not on the practical-fail list (A4)', () => {
    const r = evaluateStudent(CASE, base({ CHE: 'AB' }));
    const lists = buildChecklists([r]);
    assert.equal(lists.practicalFail.length, 0);
    assert.equal(lists.absent.length, 1);
  });
});

describe('absent list', () => {
  test('AB in a compulsory or the optional subject both list', () => {
    const compAbsent = evaluateStudent(CASE, base({ BIO: 'AB' }));
    const optAbsent = evaluateStudent(CASE, base({ HMT: 'AB' }));
    const lists = buildChecklists([compAbsent, optAbsent]);
    assert.equal(lists.absent.length, 2);
  });
});

describe('a student can be on more than one list', () => {
  test('all three at once', () => {
    const r = evaluateStudent(CASE, base({
      CHE: { theory: 55, practical: 5 },
      HMT: 'AB',
    }));
    const lists = buildChecklists([r]);
    assert.equal(lists.optional.length, 1, 'AB optional counts as 0, listed');
    assert.equal(lists.practicalFail.length, 1);
    assert.equal(lists.absent.length, 1);
    assert.equal(lists.multiple.length, 1);
    assert.deepEqual(lists.multiple[0]!.lists, ['optional', 'practical fail', 'absent']);
  });

  test('appears once per list, once in multiple, not duplicated', () => {
    const r = evaluateStudent(CASE, base({ PHY: { theory: 55, practical: 5 }, CHE: { theory: 55, practical: 4 } }));
    const lists = buildChecklists([r]);
    assert.equal(lists.practicalFail.length, 2, 'once per failing subject');
    assert.equal(lists.multiple.length, 0, 'only one distinct list type (practical), not "multiple"');
  });
});
