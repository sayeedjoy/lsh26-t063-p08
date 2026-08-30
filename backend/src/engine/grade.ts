/**
 * Task 2 — per-subject grading (R-11, R-12, R-GP, R-PS).
 *
 * Rule precedence, fixed and tested:
 *   absent (R-12) → theory below 25 (R-11) → practical below 8 (R-11)
 *   → plain mark below 33 (R-PS) → band (R-GP)
 */

import { partsOf } from './format.js';
import {
  PLAIN_PASS,
  PRACTICAL_PASS,
  THEORY_PASS,
  gradePointTenths,
} from './rules.js';
import type { RawMark, SubjectDef, SubjectTrace } from './types.js';

function bandLabel(total: number): string {
  if (total >= 80) return '80 and above';
  if (total >= 70) return '70 to 79';
  if (total >= 60) return '60 to 69';
  if (total >= 50) return '50 to 59';
  if (total >= 40) return '40 to 49';
  if (total >= 33) return '33 to 39';
  return 'below 33';
}

/** R-11/R-12/R-GP/R-PS: grade one subject, and say which rule decided it. */
export function gradeSubject(
  subject: SubjectDef,
  raw: RawMark,
  role: 'compulsory' | 'optional',
): SubjectTrace {
  const parts = partsOf(subject, raw);
  const base = {
    code: subject.code,
    name: subject.name,
    role,
    hasPractical: subject.practical,
    theoryDisplay: parts.absent ? 'AB' : subject.practical ? `${parts.theory}/75` : `${parts.total}/100`,
    practicalDisplay: !subject.practical ? '—' : parts.absent ? 'AB' : `${parts.practical}/25`,
    totalDisplay: parts.absent ? 'AB' : `${parts.total}/100`,
    theory: parts.theory,
    practical: parts.practical,
    total: parts.total,
  };

  // R-12 — absent, subject-level. Takes precedence over everything else.
  if (parts.absent) {
    return {
      ...base,
      gradePointTenths: 0,
      gradePoint: '0.0',
      ruleId: 'R-12',
      reason:
        role === 'optional'
          ? 'Absent in the optional subject, so it contributes 0 and the student goes on the checking list.'
          : 'Absent in a compulsory subject: AB, grade point 0, and the overall result is F.',
      absent: true,
      theoryFailed: false,
      practicalFailed: false,
      failed: true,
    };
  }

  // A subject with a practical part: theory below 25 fails, then practical below 8.
  if (subject.practical) {
    const theory = parts.theory as number;
    const practical = parts.practical as number;
    const total = parts.total as number;
    const theoryFailed = theory < THEORY_PASS;
    const practicalFailed = practical < PRACTICAL_PASS;

    if (theoryFailed || practicalFailed) {
      let why: string;
      if (theoryFailed && practicalFailed) {
        why = `Theory ${theory} is below the pass mark of ${THEORY_PASS} and practical ${practical} is below ${PRACTICAL_PASS}`;
      } else if (theoryFailed) {
        why = `Theory ${theory} is below the pass mark of ${THEORY_PASS} (practical ${practical} passed)`;
      } else {
        why = `Practical ${practical} is below the pass mark of ${PRACTICAL_PASS} (theory ${theory} passed)`;
      }
      return {
        ...base,
        gradePointTenths: 0,
        gradePoint: '0.0',
        ruleId: 'R-11',
        reason: `${why}. Failing either part fails the subject, so the grade point is 0 even though the total is ${total}.`,
        absent: false,
        theoryFailed,
        practicalFailed,
        failed: true,
      };
    }

    const tenths = gradePointTenths(total);
    return {
      ...base,
      gradePointTenths: tenths,
      gradePoint: (tenths / 10).toFixed(1),
      ruleId: 'R-GP',
      reason: `Both parts passed. Mark used is ${theory} + ${practical} = ${total}, which sits in the ${bandLabel(total)} band, so the grade point is ${(tenths / 10).toFixed(1)}.`,
      absent: false,
      theoryFailed: false,
      practicalFailed: false,
      failed: false,
    };
  }

  // A subject with no practical part: one whole number out of 100, R-PS.
  const total = parts.total as number;
  if (total < PLAIN_PASS) {
    return {
      ...base,
      gradePointTenths: 0,
      gradePoint: '0.0',
      ruleId: 'R-PS',
      reason: `Mark ${total} is below the pass mark of ${PLAIN_PASS} on a subject with no practical part, so the grade point is 0.`,
      absent: false,
      theoryFailed: true,
      practicalFailed: false,
      failed: true,
    };
  }

  const tenths = gradePointTenths(total);
  return {
    ...base,
    gradePointTenths: tenths,
    gradePoint: (tenths / 10).toFixed(1),
    ruleId: 'R-GP',
    reason: `Passed. Mark used is ${total}, which sits in the ${bandLabel(total)} band, so the grade point is ${(tenths / 10).toFixed(1)}.`,
    absent: false,
    theoryFailed: false,
    practicalFailed: false,
    failed: false,
  };
}
