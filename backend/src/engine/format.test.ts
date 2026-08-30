import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { MarkFormatError, displayGpa, displayGradePoint, displayPractical, displayTheory, displayTotal, partsOf } from './format.js';
import type { SubjectDef } from './types.js';

const PHYSICS: SubjectDef = { code: 'PHY', name: 'Physics', practical: true };
const BANGLA: SubjectDef = { code: 'BAN', name: 'Bangla', practical: false };

describe('partsOf', () => {
  test('absent gives all nulls, absent true', () => {
    assert.deepEqual(partsOf(PHYSICS, 'AB'), { theory: null, practical: null, total: null, absent: true });
    assert.deepEqual(partsOf(BANGLA, 'AB'), { theory: null, practical: null, total: null, absent: true });
  });

  test('a practical subject splits theory and practical, total is their sum', () => {
    const p = partsOf(PHYSICS, { theory: 52, practical: 19 });
    assert.deepEqual(p, { theory: 52, practical: 19, total: 71, absent: false });
  });

  test('a non-practical subject has null theory and practical, total is the whole mark', () => {
    const p = partsOf(BANGLA, 68);
    assert.deepEqual(p, { theory: null, practical: null, total: 68, absent: false });
  });

  test('a split mark on a non-practical subject throws, naming the subject and value', () => {
    assert.throws(
      () => partsOf(BANGLA, { theory: 50, practical: 10 } as never),
      (err: unknown) => {
        assert.ok(err instanceof MarkFormatError);
        assert.equal(err.subjectCode, 'BAN');
        assert.match(err.message, /BAN/);
        assert.match(err.message, /no practical part/);
        return true;
      },
    );
  });

  test('a plain number on a practical subject throws', () => {
    assert.throws(() => partsOf(PHYSICS, 70 as never), MarkFormatError);
  });

  test('out-of-range parts throw', () => {
    assert.throws(() => partsOf(PHYSICS, { theory: 76, practical: 10 }), MarkFormatError);
    assert.throws(() => partsOf(PHYSICS, { theory: 10, practical: 26 }), MarkFormatError);
    assert.throws(() => partsOf(PHYSICS, { theory: -1, practical: 10 }), MarkFormatError);
    assert.throws(() => partsOf(BANGLA, 101), MarkFormatError);
    assert.throws(() => partsOf(BANGLA, -1), MarkFormatError);
  });
});

describe('display helpers', () => {
  test('a split subject shows mark/max for each part', () => {
    const p = partsOf(PHYSICS, { theory: 52, practical: 19 });
    assert.equal(displayTheory(PHYSICS, p), '52/75');
    assert.equal(displayPractical(PHYSICS, p), '19/25');
    assert.equal(displayTotal(p), '71/100');
  });

  test('a plain subject shows — for practical', () => {
    const p = partsOf(BANGLA, 68);
    assert.equal(displayTheory(BANGLA, p), '68/100');
    assert.equal(displayPractical(BANGLA, p), '—');
    assert.equal(displayTotal(p), '68/100');
  });

  test('absent shows AB everywhere it applies', () => {
    const p = partsOf(PHYSICS, 'AB');
    assert.equal(displayTheory(PHYSICS, p), 'AB');
    assert.equal(displayPractical(PHYSICS, p), 'AB');
    assert.equal(displayTotal(p), 'AB');
  });

  test('grade points and GPA render to fixed decimals', () => {
    assert.equal(displayGradePoint(45), '4.5');
    assert.equal(displayGradePoint(0), '0.0');
    assert.equal(displayGradePoint(50), '5.0');
    assert.equal(displayGpa(408), '4.08');
    assert.equal(displayGpa(0), '0.00');
    assert.equal(displayGpa(500), '5.00');
  });
});
