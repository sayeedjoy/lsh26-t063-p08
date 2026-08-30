// GENERATED FILE — do not edit.
// Vendored from backend/src/engine by `node scripts/sync-engine.mjs`.
// Edit the backend copy, then re-run that script.

/**
 * Task 4 — composes grade.ts + gpa.ts into evaluateStudent / evaluateCase.
 *
 * Pure: same input always produces the same output. No I/O, no clock, no
 * randomness — a snapshot evaluated once at boot never needs to be
 * re-evaluated for the same dataset.
 */

import { MarkFormatError } from './format.js';
import { gradeSubject } from './grade.js';
import { aggregate } from './gpa.js';
import type { RawCase, RawStudent, StudentResult, SubjectTrace } from './types.js';

/** Wraps a format error with the student it happened on, so it can be reported. */
export class StudentMarkError extends Error {
  studentId: string;
  studentName: string;

  constructor(studentId: string, studentName: string, cause: MarkFormatError) {
    super(`${studentId} (${studentName}): ${cause.message}`);
    this.name = 'StudentMarkError';
    this.studentId = studentId;
    this.studentName = studentName;
  }
}

export function evaluateStudent(
  caseDef: Pick<RawCase, 'case_id' | 'subjects' | 'compulsory'>,
  student: RawStudent,
): StudentResult {
  const byCode = new Map(caseDef.subjects.map((s) => [s.code, s]));

  const grade = (code: string, role: 'compulsory' | 'optional'): SubjectTrace => {
    const subject = byCode.get(code);
    if (!subject) throw new Error(`${student.id}: unknown subject code "${code}"`);
    try {
      return gradeSubject(subject, student.marks[code] as never, role);
    } catch (err) {
      if (err instanceof MarkFormatError) throw new StudentMarkError(student.id, student.name, err);
      throw err;
    }
  };

  const compulsoryTraces = caseDef.compulsory.map((code) => grade(code, 'compulsory'));
  const optionalTrace = byCode.has(student.optional) ? grade(student.optional, 'optional') : null;
  const subjects = optionalTrace ? [...compulsoryTraces, optionalTrace] : compulsoryTraces;

  const { gpa, publishedHundredths, letter, cancelled, failingSubjects, optionalChangedResult } =
    aggregate(compulsoryTraces, optionalTrace);

  const absentSubjects = subjects.filter((t) => t.absent);
  const practicalFailSubjects = subjects.filter((t) => t.practicalFailed);
  const optionalTenths = optionalTrace?.gradePointTenths ?? 0;

  return {
    id: student.id,
    name: student.name,
    class: student.class,
    caseId: caseDef.case_id,
    subjects,
    gpa,
    gpaValue: gpa.publishedGpa,
    gpaHundredths: publishedHundredths,
    letter,
    passed: !cancelled,
    failingSubjects: failingSubjects.map((t) => t.name),
    absentSubjects: absentSubjects.map((t) => t.name),
    practicalFailSubjects: practicalFailSubjects.map((t) => t.name),
    flags: {
      // R-29 defines the optional list by grade point, not by effect — a
      // student whose optional changed nothing about the GPA can still be on it.
      optional: optionalTrace !== null && optionalTenths <= 20,
      practicalFail: practicalFailSubjects.length > 0,
      absent: absentSubjects.length > 0,
    },
    optionalChangedResult,
  };
}

export function evaluateCase(caseDef: RawCase) {
  return caseDef.students.map((s) => evaluateStudent(caseDef, s));
}
