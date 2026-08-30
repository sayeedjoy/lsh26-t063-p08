import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { auditCase } from './audit.js';
import { evaluateCase } from './engine.js';
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
const COMPULSORY = ['BAN', 'ENG', 'MAT', 'PHY', 'CHE', 'BIO'];

const strongAvgFail = (id: string, klass: string): RawStudent => ({
  id, name: id, class: klass, optional: 'HMT',
  marks: {
    BAN: 88, ENG: 85, MAT: 91,
    PHY: { theory: 62, practical: 22 },
    CHE: { theory: 24, practical: 21 }, // theory 1 short, fails
    BIO: { theory: 60, practical: 20 },
    HMT: { theory: 58, practical: 19 },
  },
});
const practicalFail = (id: string, klass: string): RawStudent => ({
  id, name: id, class: klass, optional: 'HMT',
  marks: {
    BAN: 70, ENG: 70, MAT: 70,
    PHY: { theory: 74, practical: 7 }, // passing theory, failing practical
    CHE: { theory: 55, practical: 20 },
    BIO: { theory: 55, practical: 20 },
    HMT: { theory: 55, practical: 20 },
  },
});
const weakOptional = (id: string, klass: string): RawStudent => ({
  id, name: id, class: klass, optional: 'HMT',
  marks: {
    BAN: 70, ENG: 70, MAT: 70,
    PHY: { theory: 55, practical: 20 }, CHE: { theory: 55, practical: 20 },
    BIO: { theory: 55, practical: 20 },
    HMT: { theory: 30, practical: 12 }, // 42 -> 2.0
  },
});
const absent = (id: string, klass: string): RawStudent => ({
  id, name: id, class: klass, optional: 'HMT',
  marks: {
    BAN: 70, ENG: 70, MAT: 70,
    PHY: { theory: 55, practical: 20 }, CHE: { theory: 55, practical: 20 },
    BIO: 'AB',
    HMT: { theory: 55, practical: 20 },
  },
});
const plain = (id: string, klass: string): RawStudent => ({
  id, name: id, class: klass, optional: 'HMT',
  marks: {
    BAN: 70, ENG: 70, MAT: 70,
    PHY: { theory: 55, practical: 20 }, CHE: { theory: 55, practical: 20 },
    BIO: { theory: 55, practical: 20 }, HMT: { theory: 55, practical: 20 },
  },
});

function makeCase(students: RawStudent[]): RawCase {
  return { case_id: 'AUDIT', subjects: SUBJECTS, compulsory: COMPULSORY, students };
}

describe('AC1 — roster shape', () => {
  test('fails count and class checks when the roster is too small / one class', () => {
    const students = Array.from({ length: 10 }, (_, i) => plain(`S${i}`, 'Class 9'));
    const caseDef = makeCase(students);
    const audit = auditCase(caseDef, evaluateCase(caseDef));
    assert.equal(audit.pass, false);
    const count = audit.criteria.find((c) => c.id === 'AC1-count')!;
    const classes = audit.criteria.find((c) => c.id === 'AC1-classes')!;
    assert.equal(count.pass, false);
    assert.equal(classes.pass, false);
  });

  test('passes count and class checks for a 60-student, 2-class roster', () => {
    const students = [
      ...Array.from({ length: 30 }, (_, i) => plain(`A${i}`, 'Class 9')),
      ...Array.from({ length: 30 }, (_, i) => plain(`B${i}`, 'Class 10')),
    ];
    const caseDef = makeCase(students);
    const audit = auditCase(caseDef, evaluateCase(caseDef));
    assert.equal(audit.criteria.find((c) => c.id === 'AC1-count')!.pass, true);
    assert.equal(audit.criteria.find((c) => c.id === 'AC1-classes')!.pass, true);
    assert.equal(audit.criteria.find((c) => c.id === 'AC1-markcount')!.pass, true);
    assert.equal(audit.criteria.find((c) => c.id === 'AC1-optional')!.pass, true);
  });
});

describe('AC2 — hard-edge archetypes', () => {
  test('reports, does not throw, when a case has zero hard edges', () => {
    const students = Array.from({ length: 60 }, (_, i) =>
      plain(`S${i}`, i % 2 === 0 ? 'Class 9' : 'Class 10'));
    const caseDef = makeCase(students);
    const audit = auditCase(caseDef, evaluateCase(caseDef));
    assert.equal(audit.pass, false);
    assert.equal(audit.criteria.find((c) => c.id === 'AC2-total')!.pass, false);
    assert.equal(audit.hardEdgeStudents.length, 0);
  });

  test('names at least one student per archetype and passes AC2 with 8+ hard-edge students', () => {
    const students = [
      strongAvgFail('E1', 'Class 9'), strongAvgFail('E2', 'Class 9'),
      practicalFail('E3', 'Class 9'), practicalFail('E4', 'Class 9'),
      weakOptional('E5', 'Class 10'), weakOptional('E6', 'Class 10'),
      absent('E7', 'Class 10'), absent('E8', 'Class 10'),
      ...Array.from({ length: 52 }, (_, i) => plain(`P${i}`, i % 2 ? 'Class 9' : 'Class 10')),
    ];
    const caseDef = makeCase(students);
    const audit = auditCase(caseDef, evaluateCase(caseDef));

    assert.equal(audit.pass, true);
    assert.ok(audit.hardEdgeStudents.length >= 8);
    assert.ok(audit.archetypeExamples.strongAverageFailure.some((s) => s.id === 'E1'));
    assert.ok(audit.archetypeExamples.practicalFailPassingTheory.some((s) => s.id === 'E3'));
    assert.ok(audit.archetypeExamples.weakOptional.some((s) => s.id === 'E5'));
    assert.ok(audit.archetypeExamples.absent.some((s) => s.id === 'E7'));
  });
});
