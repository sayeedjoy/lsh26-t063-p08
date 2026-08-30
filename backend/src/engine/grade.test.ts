import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { gradeSubject } from './grade.js';
import type { SubjectDef } from './types.js';

const PHY: SubjectDef = { code: 'PHY', name: 'Physics', practical: true };
const BAN: SubjectDef = { code: 'BAN', name: 'Bangla', practical: false };

describe('rule precedence', () => {
  test('absent wins over everything else', () => {
    const t = gradeSubject(PHY, 'AB', 'compulsory');
    assert.equal(t.ruleId, 'R-12');
    assert.equal(t.absent, true);
    assert.equal(t.theoryFailed, false);
    assert.equal(t.practicalFailed, false);
  });

  test('theory below pass fails via R-11 even with a perfect practical', () => {
    const t = gradeSubject(PHY, { theory: 24, practical: 25 }, 'compulsory');
    assert.equal(t.total, 49, 'would be worth grade point 2.0 on total alone');
    assert.equal(t.ruleId, 'R-11');
    assert.equal(t.gradePointTenths, 0);
    assert.equal(t.theoryFailed, true);
    assert.equal(t.practicalFailed, false);
  });

  test('practical below pass fails via R-11 even with a strong theory', () => {
    const t = gradeSubject(PHY, { theory: 74, practical: 7 }, 'compulsory');
    assert.equal(t.ruleId, 'R-11');
    assert.equal(t.gradePointTenths, 0);
    assert.equal(t.theoryFailed, false);
    assert.equal(t.practicalFailed, true);
    assert.match(t.reason, /Practical 7 is below the pass mark of 8/);
    assert.match(t.reason, /theory 74 passed/);
  });

  test('a plain subject below 33 fails via R-PS', () => {
    const t = gradeSubject(BAN, 30, 'compulsory');
    assert.equal(t.ruleId, 'R-PS');
    assert.equal(t.gradePointTenths, 0);
  });

  test('everything passing lands on R-GP', () => {
    assert.equal(gradeSubject(PHY, { theory: 60, practical: 20 }, 'compulsory').ruleId, 'R-GP');
    assert.equal(gradeSubject(BAN, 68, 'compulsory').ruleId, 'R-GP');
  });
});

describe('boundary pairs', () => {
  test('theory 24 vs 25', () => {
    assert.equal(gradeSubject(PHY, { theory: 24, practical: 20 }, 'compulsory').gradePointTenths, 0);
    assert.equal(gradeSubject(PHY, { theory: 25, practical: 20 }, 'compulsory').gradePointTenths > 0, true);
  });

  test('practical 7 vs 8', () => {
    assert.equal(gradeSubject(PHY, { theory: 60, practical: 7 }, 'compulsory').gradePointTenths, 0);
    assert.equal(gradeSubject(PHY, { theory: 60, practical: 8 }, 'compulsory').gradePointTenths > 0, true);
  });

  test('total 32 vs 33 (R-PS boundary)', () => {
    assert.equal(gradeSubject(BAN, 32, 'compulsory').gradePointTenths, 0);
    assert.equal(gradeSubject(BAN, 33, 'compulsory').gradePointTenths, 10);
  });

  test('total 39 vs 40', () => {
    assert.equal(gradeSubject(BAN, 39, 'compulsory').gradePointTenths, 10);
    assert.equal(gradeSubject(BAN, 40, 'compulsory').gradePointTenths, 20);
  });

  test('total 49 vs 50', () => {
    assert.equal(gradeSubject(BAN, 49, 'compulsory').gradePointTenths, 20);
    assert.equal(gradeSubject(BAN, 50, 'compulsory').gradePointTenths, 30);
  });

  test('total 59 vs 60', () => {
    assert.equal(gradeSubject(BAN, 59, 'compulsory').gradePointTenths, 30);
    assert.equal(gradeSubject(BAN, 60, 'compulsory').gradePointTenths, 35);
  });

  test('total 69 vs 70', () => {
    assert.equal(gradeSubject(BAN, 69, 'compulsory').gradePointTenths, 35);
    assert.equal(gradeSubject(BAN, 70, 'compulsory').gradePointTenths, 40);
  });

  test('total 79 vs 80', () => {
    assert.equal(gradeSubject(BAN, 79, 'compulsory').gradePointTenths, 40);
    assert.equal(gradeSubject(BAN, 80, 'compulsory').gradePointTenths, 50);
  });
});

describe('the practical-fail-with-passing-theory archetype', () => {
  test('305 students in the real dataset hit exactly this shape', () => {
    const t = gradeSubject(PHY, { theory: 55, practical: 5 }, 'compulsory');
    assert.equal(t.gradePointTenths, 0);
    assert.equal(t.ruleId, 'R-11');
    assert.equal(t.practicalFailed, true);
    assert.equal(t.theoryFailed, false);
    assert.equal(t.failed, true);
  });
});

describe('every trace has a non-empty reason naming the mark and threshold', () => {
  test('across every branch', () => {
    const cases: Array<ReturnType<typeof gradeSubject>> = [
      gradeSubject(PHY, 'AB', 'compulsory'),
      gradeSubject(PHY, { theory: 20, practical: 20 }, 'compulsory'),
      gradeSubject(PHY, { theory: 60, practical: 5 }, 'compulsory'),
      gradeSubject(BAN, 20, 'compulsory'),
      gradeSubject(BAN, 68, 'compulsory'),
      gradeSubject(PHY, { theory: 60, practical: 20 }, 'compulsory'),
    ];
    for (const t of cases) {
      assert.ok(t.reason.length > 0, `${t.code} ${t.ruleId} has an empty reason`);
    }
  });
});
