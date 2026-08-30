import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ValidationError, loadDataset, resolveDatasetPath, validateCase, validateDataset } from './dataset.js';

const here = dirname(fileURLToPath(import.meta.url));
const REAL_DATA = resolveDatasetPath();

const SUBJECTS = [
  { code: 'BAN', name: 'Bangla', practical: false },
  { code: 'ENG', name: 'English', practical: false },
  { code: 'MAT', name: 'Mathematics', practical: false },
  { code: 'PHY', name: 'Physics', practical: true },
  { code: 'CHE', name: 'Chemistry', practical: true },
  { code: 'BIO', name: 'Biology', practical: true },
  { code: 'HMT', name: 'Higher Mathematics', practical: true },
];
const COMPULSORY = ['BAN', 'ENG', 'MAT', 'PHY', 'CHE', 'BIO'];

function goodStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'S001', name: 'Test Student', class: 'Class 9', optional: 'HMT',
    marks: {
      BAN: 70, ENG: 70, MAT: 70,
      PHY: { theory: 55, practical: 20 }, CHE: { theory: 55, practical: 20 },
      BIO: { theory: 55, practical: 20 }, HMT: { theory: 55, practical: 20 },
      ...overrides,
    },
  };
}
function goodCase(students: unknown[]) {
  return { case_id: 'T1', subjects: SUBJECTS, compulsory: COMPULSORY, students };
}

describe('validation rejects malformed input, naming case/student/field', () => {
  test('unknown subject code as optional', () => {
    assert.throws(
      () => validateCase(goodCase([goodStudent({ })].map((s) => ({ ...s, optional: 'XYZ', marks: { ...s.marks, XYZ: s.marks.HMT, HMT: undefined } })))),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /T1/);
        assert.match(err.message, /S001/);
        assert.match(err.message, /XYZ/);
        return true;
      },
    );
  });

  test('missing the optional mark entirely', () => {
    const s = goodStudent();
    delete (s.marks as Record<string, unknown>)['HMT'];
    assert.throws(() => validateCase(goodCase([s])), (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /S001/);
      return true;
    });
  });

  test('a mark count other than 7', () => {
    const s = goodStudent();
    (s.marks as Record<string, unknown>)['EXTRA'] = 50;
    assert.throws(() => validateCase(goodCase([s])), /expected 7 marks|expected \d+ marks/);
  });

  test('out-of-range parts', () => {
    assert.throws(() => validateCase(goodCase([goodStudent({ PHY: { theory: 90, practical: 20 } })])), ValidationError);
    assert.throws(() => validateCase(goodCase([goodStudent({ PHY: { theory: 50, practical: 30 } })])), ValidationError);
    assert.throws(() => validateCase(goodCase([goodStudent({ BAN: 150 })])), ValidationError);
  });

  test('a valid case validates cleanly', () => {
    const parsed = validateCase(goodCase([goodStudent()]));
    assert.equal(parsed.students.length, 1);
  });

  test('validateDataset rejects a non-array cases field', () => {
    assert.throws(() => validateDataset({ cases: 'nope' }), ValidationError);
  });
});

describe('loadDataset against the real supplied file', () => {
  test('loads, validates and evaluates once; boot time is reported', () => {
    const dataset = loadDataset(REAL_DATA);
    assert.equal(dataset.totals.cases, 25);
    assert.equal(dataset.totals.students, 1765);
    assert.ok(dataset.evaluatedInMs >= 0);
    assert.equal(dataset.byId.get('PUB-01')?.caseId, 'PUB-01');
  });

  test('dataset path is configurable', () => {
    const dataset = loadDataset(REAL_DATA);
    assert.equal(dataset.path, REAL_DATA);
  });
});
