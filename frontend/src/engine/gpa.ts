// GENERATED FILE — do not edit.
// Vendored from backend/src/engine by `node scripts/sync-engine.mjs`.
// Edit the backend copy, then re-run that script.

/**
 * Task 3 — R-13 aggregation and R-10 letter.
 *
 * Takes the graded subject traces (grade.ts's job) and produces the GPA
 * working: every arithmetic step in plain words, the cap, the cancellation,
 * and the published GPA + letter.
 */

import {
  COMPULSORY_COUNT,
  GPA_CAP_HUNDREDTHS,
  OPTIONAL_DEDUCTION_TENTHS,
  divideHalfUp,
  formatHundredths,
  formatTenths,
  letterFor,
} from './rules.js';
import type { GpaWorking, LetterGrade, RuleId, SubjectTrace } from './types.js';

export interface GpaResult {
  gpa: GpaWorking;
  publishedHundredths: number;
  letter: LetterGrade;
  cancelled: boolean;
  failingSubjects: SubjectTrace[];
  optionalChangedResult: boolean;
}

/** R-13 + R-10: compulsory traces, the optional trace (or null), to a full GPA working. */
export function aggregate(
  compulsoryTraces: SubjectTrace[],
  optionalTrace: SubjectTrace | null,
): GpaResult {
  if (compulsoryTraces.length !== COMPULSORY_COUNT) {
    throw new Error(`expected ${COMPULSORY_COUNT} compulsory subjects, got ${compulsoryTraces.length}`);
  }

  const compulsorySumTenths = compulsoryTraces.reduce((sum, t) => sum + t.gradePointTenths, 0);
  const optionalTenths = optionalTrace?.gradePointTenths ?? 0;
  // R-13: only the part of the optional grade point above 2.0 is carried over, floored at 0.
  const contributionTenths = Math.max(0, optionalTenths - OPTIONAL_DEDUCTION_TENTHS);

  const numeratorTenths = compulsorySumTenths + contributionTenths;
  const rawHundredths = divideHalfUp(numeratorTenths * 10, COMPULSORY_COUNT);
  const capped = rawHundredths > GPA_CAP_HUNDREDTHS;
  // A5: cap first — this capped value is the "uncancelled average" shown in the trace.
  const uncancelledHundredths = Math.min(rawHundredths, GPA_CAP_HUNDREDTHS);

  const failingSubjects = compulsoryTraces.filter((t) => t.failed);
  const cancelled = failingSubjects.length > 0;
  const publishedHundredths = cancelled ? 0 : uncancelledHundredths;
  const letter = letterFor(publishedHundredths, cancelled);

  // Did the optional rule actually move the GPA, or just sit there?
  const withoutOptionalHundredths = Math.min(
    divideHalfUp(compulsorySumTenths * 10, COMPULSORY_COUNT),
    GPA_CAP_HUNDREDTHS,
  );
  const optionalChangedResult = !cancelled && uncancelledHundredths !== withoutOptionalHundredths;

  const steps: Array<{ ruleId: RuleId; text: string }> = [];
  steps.push({
    ruleId: 'R-13',
    text: `Sum of the six compulsory grade points = ${formatTenths(compulsorySumTenths)}.`,
  });
  if (optionalTrace) {
    steps.push({
      ruleId: 'R-13',
      text:
        `Optional ${optionalTrace.name} scored ${optionalTrace.gradePoint}, ` +
        `so it carries max(0, ${optionalTrace.gradePoint} − 2.0) = ${formatTenths(contributionTenths)}.`,
    });
    if (contributionTenths === 0) {
      steps.push({
        ruleId: 'R-29',
        text: optionalTrace.absent
          ? 'The optional subject was absent, so it adds nothing and the student goes on the optional checking list.'
          : `The optional grade point is ${optionalTrace.gradePoint}, at or below 2.0, so it adds nothing and the student goes on the optional checking list.`,
      });
    }
  }
  steps.push({
    ruleId: 'R-13',
    text: `(${formatTenths(compulsorySumTenths)} + ${formatTenths(contributionTenths)}) ÷ 6 = ${formatHundredths(rawHundredths)}.`,
  });
  if (capped) {
    steps.push({
      ruleId: 'R-13',
      text: `That is above the 5.00 cap, so it is capped to ${formatHundredths(uncancelledHundredths)}.`,
    });
  }
  if (cancelled) {
    steps.push({
      ruleId: 'R-13',
      text:
        `Compulsory failure in ${failingSubjects.map((t) => t.name).join(', ')}, ` +
        `so the GPA is cancelled to 0.00 and the letter is F. The uncancelled ` +
        `average ${formatHundredths(uncancelledHundredths)} stays visible here on purpose.`,
    });
  }
  steps.push({
    ruleId: 'R-10',
    text: `Published GPA ${formatHundredths(publishedHundredths)} gives letter grade ${letter}.`,
  });

  const gpa: GpaWorking = {
    compulsoryTerms: compulsoryTraces.map((t) => t.gradePoint),
    compulsorySum: formatTenths(compulsorySumTenths),
    optionalCode: optionalTrace?.code ?? null,
    optionalGradePoint: formatTenths(optionalTenths),
    optionalContribution: formatTenths(contributionTenths),
    rawGpa: formatHundredths(rawHundredths),
    uncancelledGpa: formatHundredths(uncancelledHundredths),
    capped,
    cancelled,
    publishedGpa: formatHundredths(publishedHundredths),
    steps,
  };

  return { gpa, publishedHundredths, letter, cancelled, failingSubjects, optionalChangedResult };
}
