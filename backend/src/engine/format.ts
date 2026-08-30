/**
 * Task 1 — mark parsing and display formatting.
 *
 * One place decides what a raw mark actually means for a given subject, and
 * one place decides how it is written down. Grading rules (grade.ts) consume
 * `partsOf`; nothing else touches a `RawMark` directly.
 */

import { ABSENT } from './rules.js';
import type { RawMark, SplitMark, SubjectDef } from './types.js';

export class MarkFormatError extends Error {
  // Explicit fields rather than constructor parameter properties: the frontend
  // compiles this engine under `erasableSyntaxOnly`, which rejects those.
  subjectCode: string;
  value: unknown;

  constructor(subjectCode: string, value: unknown, message: string) {
    super(`${subjectCode}: ${message} (got ${JSON.stringify(value)})`);
    this.name = 'MarkFormatError';
    this.subjectCode = subjectCode;
    this.value = value;
  }
}

const isSplit = (mark: unknown): mark is SplitMark =>
  typeof mark === 'object' && mark !== null && 'theory' in mark && 'practical' in mark;

export interface MarkParts {
  theory: number | null;
  practical: number | null;
  /** null only when absent. For a plain subject this equals theory's numeric value. */
  total: number | null;
  absent: boolean;
}

/**
 * Turns a `RawMark` into the parts grading needs. A non-practical subject has
 * `theory = null, practical = null, total = the whole number` — the mark
 * genuinely has no theory/practical split to report.
 */
export function partsOf(subject: SubjectDef, raw: RawMark): MarkParts {
  if (raw === ABSENT) {
    return { theory: null, practical: null, total: null, absent: true };
  }

  if (subject.practical) {
    if (!isSplit(raw)) {
      throw new MarkFormatError(
        subject.code,
        raw,
        'has a practical part, so the mark must be {theory, practical} or "AB"',
      );
    }
    const { theory, practical } = raw;
    if (!Number.isInteger(theory) || theory < 0 || theory > 75) {
      throw new MarkFormatError(subject.code, raw, 'theory must be a whole number from 0 to 75');
    }
    if (!Number.isInteger(practical) || practical < 0 || practical > 25) {
      throw new MarkFormatError(subject.code, raw, 'practical must be a whole number from 0 to 25');
    }
    return { theory, practical, total: theory + practical, absent: false };
  }

  if (isSplit(raw)) {
    throw new MarkFormatError(
      subject.code,
      raw,
      'has no practical part, so the mark must be a single whole number or "AB"',
    );
  }
  if (!Number.isInteger(raw) || raw < 0 || raw > 100) {
    throw new MarkFormatError(subject.code, raw, 'must be a whole number from 0 to 100');
  }
  return { theory: null, practical: null, total: raw, absent: false };
}

/* ------------------------------------------------------------------ */
/* Display                                                             */
/* ------------------------------------------------------------------ */

export const displayAbsent = (): string => ABSENT;

export function displayTheory(subject: SubjectDef, parts: MarkParts): string {
  if (parts.absent) return ABSENT;
  return subject.practical ? `${parts.theory}/75` : `${parts.total}/100`;
}

export function displayPractical(subject: SubjectDef, parts: MarkParts): string {
  if (!subject.practical) return '—';
  if (parts.absent) return ABSENT;
  return `${parts.practical}/25`;
}

export function displayTotal(parts: MarkParts): string {
  if (parts.absent) return ABSENT;
  return `${parts.total}/100`;
}

/** Grade point in tenths (45) as a teacher reads it: "4.5". */
export const displayGradePoint = (tenths: number): string => (tenths / 10).toFixed(1);

/** GPA in hundredths (408) as a teacher reads it: "4.08". */
export const displayGpa = (hundredths: number): string => (hundredths / 100).toFixed(2);
