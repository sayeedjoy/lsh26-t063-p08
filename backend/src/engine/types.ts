/** Shapes that come straight out of P08_school_results_public.json. */

export interface SubjectDef {
  code: string;
  name: string;
  practical: boolean;
}

/** A subject with a practical part: theory 0..75, practical 0..25. */
export interface SplitMark {
  theory: number;
  practical: number;
}

/** "AB" means absent in that subject. A plain number is a mark out of 100. */
export type RawMark = number | SplitMark | 'AB';

export interface RawStudent {
  id: string;
  name: string;
  class: string;
  /** Code of the student's fourth (optional) subject: HMT, AGR or REL. */
  optional: string;
  marks: Record<string, RawMark>;
}

export interface RawCase {
  case_id: string;
  subjects: SubjectDef[];
  compulsory: string[];
  students: RawStudent[];
}

export interface RawDataset {
  schema_version: string;
  problem_id: string;
  format_note?: string;
  cases: RawCase[];
}

/* ------------------------------------------------------------------ */
/* Shapes the engine produces                                          */
/* ------------------------------------------------------------------ */

export type RuleId = 'R-10' | 'R-11' | 'R-12' | 'R-13' | 'R-29' | 'R-GP' | 'R-PS';

export type LetterGrade = 'A+' | 'A' | 'A-' | 'B' | 'C' | 'D' | 'F';

/** One row of the per-student trace. */
export interface SubjectTrace {
  code: string;
  name: string;
  role: 'compulsory' | 'optional';
  hasPractical: boolean;

  /** The mark actually used, already formatted for display. */
  theoryDisplay: string;
  practicalDisplay: string;
  totalDisplay: string;

  theory: number | null;
  practical: number | null;
  total: number | null;

  /** Grade point in tenths (45 === 4.5), so no float ever touches a grade. */
  gradePointTenths: number;
  gradePoint: string;

  /** The rule that decided this grade point, and why in words. */
  ruleId: RuleId;
  reason: string;

  absent: boolean;
  theoryFailed: boolean;
  practicalFailed: boolean;
  failed: boolean;
}

/** The GPA arithmetic, kept step by step so the office can follow it. */
export interface GpaWorking {
  compulsoryTerms: string[];
  compulsorySum: string;
  optionalCode: string | null;
  optionalGradePoint: string;
  optionalContribution: string;
  /** Before the cap and before any cancellation. */
  rawGpa: string;
  /** After the cap, before cancellation — this is the "uncancelled average". */
  uncancelledGpa: string;
  capped: boolean;
  cancelled: boolean;
  /** What actually gets printed on the result sheet. */
  publishedGpa: string;
  steps: Array<{ ruleId: RuleId; text: string }>;
}

export interface StudentResult {
  id: string;
  name: string;
  class: string;
  caseId: string;

  subjects: SubjectTrace[];
  gpa: GpaWorking;

  gpaValue: string;
  gpaHundredths: number;
  letter: LetterGrade;
  passed: boolean;

  /** Subjects that cancelled the result (compulsory, grade point 0). */
  failingSubjects: string[];
  absentSubjects: string[];
  practicalFailSubjects: string[];

  /** R-29 checking-list membership. */
  flags: {
    optional: boolean;
    practicalFail: boolean;
    absent: boolean;
  };
  /** True when the optional rule actually moved the published GPA. */
  optionalChangedResult: boolean;
}

export interface CaseSummary {
  caseId: string;
  students: number;
  classes: string[];
  passed: number;
  failed: number;
  passRate: string;
  averageGpa: string;
  gradeSpread: Record<LetterGrade, number>;
  byClass: Array<{
    class: string;
    students: number;
    passed: number;
    failed: number;
    averageGpa: string;
  }>;
  checklistCounts: {
    optional: number;
    practicalFail: number;
    absent: number;
    multiple: number;
  };
}

export interface EvaluatedCase {
  caseId: string;
  subjects: SubjectDef[];
  compulsory: string[];
  results: StudentResult[];
  summary: CaseSummary;
}
