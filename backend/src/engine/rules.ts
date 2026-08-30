/**
 * Every marking rule lives here and nowhere else.
 *
 * Grade points are carried as integer tenths (45 === 4.5) and the GPA as
 * integer hundredths (408 === 4.08). Nothing in the grading path touches a
 * binary float, so a mark can never land on the wrong side of a band because
 * of 0.1 + 0.2.
 */

import type { LetterGrade, RuleId } from './types.js';

export interface RuleDoc {
  id: RuleId;
  title: string;
  text: string;
  /** Given by the brief, or an assumption we declared and can defend. */
  source: 'brief' | 'declared';
}

export const RULES: Record<RuleId, RuleDoc> = {
  'R-10': {
    id: 'R-10',
    title: 'Letter grade from the final GPA',
    text: 'A+ = 5.00, A = 4.00 to 4.99, A- = 3.50 to 3.99, B = 3.00 to 3.49, ' +
      'C = 2.00 to 2.99, D = 1.00 to 1.99, F = fail.',
    source: 'brief',
  },
  'R-11': {
    id: 'R-11',
    title: 'Theory and practical pass marks',
    text: 'Theory is out of 75 with a pass mark of 25. Practical is out of 25 ' +
      'with a pass mark of 8. Failing either part fails the subject: grade point 0.',
    source: 'brief',
  },
  'R-12': {
    id: 'R-12',
    title: 'Absent',
    text: 'Absent in a compulsory subject: show AB, subject grade point 0, ' +
      'overall result F. Absent in the optional subject: it contributes 0 and ' +
      'the student appears on the checking list.',
    source: 'brief',
  },
  'R-13': {
    id: 'R-13',
    title: 'GPA formula and cancellation',
    text: 'GPA = (sum of the compulsory grade points + the larger of 0 and the ' +
      'optional grade point minus 2) divided by 6, capped at 5.00, shown to 2 ' +
      'decimal places. Any compulsory failure gives GPA 0.00 and letter F; the ' +
      'uncancelled average stays visible in the calculation trace.',
    source: 'brief',
  },
  'R-29': {
    id: 'R-29',
    title: 'Checking lists',
    text: 'Optional list = every student whose optional grade point is 2.0 or ' +
      'below (an absent optional counts). Practical fail list = every student ' +
      'with a practical part below 8 in any subject. Absent list = every student ' +
      'with AB in any subject. A student can be on more than one list.',
    source: 'brief',
  },
  'R-GP': {
    id: 'R-GP',
    title: 'Mark to grade point (declared)',
    text: 'The brief fixes the pass marks and the letter bands but not the ' +
      'mark-to-grade-point scale. We use the national scale, which is the one ' +
      'under which the R-10 letter bands line up: 80+ = 5.0, 70-79 = 4.0, ' +
      '60-69 = 3.5, 50-59 = 3.0, 40-49 = 2.0, 33-39 = 1.0, below 33 = 0.0. ' +
      'For a subject with a practical part the mark is theory + practical.',
    source: 'declared',
  },
  'R-PS': {
    id: 'R-PS',
    title: 'Subject with no practical part (declared)',
    text: 'A subject with no practical part is one whole number out of 100 and ' +
      'passes at 33. This is the same proportion as the 25/75 theory pass, and ' +
      'it changes no grade point either way: the R-GP scale already gives 0 ' +
      'below 33.',
    source: 'declared',
  },
};

export const THEORY_FULL = 75;
export const THEORY_PASS = 25;
export const PRACTICAL_FULL = 25;
export const PRACTICAL_PASS = 8;
export const PLAIN_FULL = 100;
export const PLAIN_PASS = 33;

export const COMPULSORY_COUNT = 6;
/** The "minus 2" in R-13, in tenths. */
export const OPTIONAL_DEDUCTION_TENTHS = 20;
/** R-29 optional watch threshold: grade point 2.0 or below, in tenths. */
export const OPTIONAL_WATCH_TENTHS = 20;
/** R-13 cap, in hundredths. */
export const GPA_CAP_HUNDREDTHS = 500;

export const ABSENT = 'AB';

/** R-GP, highest band first. Grade points in tenths. */
export const GRADE_SCALE: ReadonlyArray<{ floor: number; tenths: number }> = [
  { floor: 80, tenths: 50 },
  { floor: 70, tenths: 40 },
  { floor: 60, tenths: 35 },
  { floor: 50, tenths: 30 },
  { floor: 40, tenths: 20 },
  { floor: 33, tenths: 10 },
];

/** R-10, highest band first. GPA floors in hundredths. */
export const LETTER_BANDS: ReadonlyArray<{ floor: number; letter: LetterGrade }> = [
  { floor: 500, letter: 'A+' },
  { floor: 400, letter: 'A' },
  { floor: 350, letter: 'A-' },
  { floor: 300, letter: 'B' },
  { floor: 200, letter: 'C' },
  { floor: 100, letter: 'D' },
];

/** R-GP: a total out of 100 to a grade point in tenths, ignoring part fails. */
export function gradePointTenths(total: number): number {
  for (const band of GRADE_SCALE) {
    if (total >= band.floor) return band.tenths;
  }
  return 0;
}

/** R-10. A compulsory failure is F however the arithmetic came out. */
export function letterFor(gpaHundredths: number, cancelled: boolean): LetterGrade {
  if (cancelled) return 'F';
  for (const band of LETTER_BANDS) {
    if (gpaHundredths >= band.floor) return band.letter;
  }
  return 'F';
}

/** Exact half-up division of integers — no float, so no drift at a band edge. */
export function divideHalfUp(numerator: number, denominator: number): number {
  const negative = numerator < 0;
  const n = Math.abs(numerator);
  const q = Math.floor(n / denominator);
  const remainder = n % denominator;
  const rounded = remainder * 2 >= denominator ? q + 1 : q;
  return negative ? -rounded : rounded;
}

export const formatTenths = (tenths: number): string => (tenths / 10).toFixed(1);
export const formatHundredths = (h: number): string => (h / 100).toFixed(2);
