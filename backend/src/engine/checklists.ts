/**
 * Task 5 — R-29 office checking lists.
 *
 * A4: absent is subject-level and belongs to the absent list only, never the
 * practical-fail list — that list is defined by a numeric practical below 8.
 */

import type { StudentResult } from './types.js';

export interface ChecklistRow {
  id: string;
  name: string;
  class: string;
  subject: string;
  detail: string;
  gpa: string;
  letter: string;
  reason: string;
}

export interface MultipleRow {
  id: string;
  name: string;
  class: string;
  lists: string[];
  gpa: string;
  letter: string;
}

export interface Checklists {
  optional: ChecklistRow[];
  practicalFail: ChecklistRow[];
  absent: ChecklistRow[];
  multiple: MultipleRow[];
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

export function buildChecklists(results: StudentResult[]): Checklists {
  const optional: ChecklistRow[] = [];
  const practicalFail: ChecklistRow[] = [];
  const absent: ChecklistRow[] = [];
  const multiple: MultipleRow[] = [];

  for (const r of results) {
    const head = { id: r.id, name: r.name, class: r.class, gpa: r.gpaValue, letter: r.letter };

    // Optional list: grade point <= 2.0 inclusive (A6). An absent optional
    // has grade point 0 and is caught by the same threshold.
    if (r.flags.optional) {
      const opt = r.subjects.find((s) => s.role === 'optional');
      optional.push({
        ...head,
        subject: opt?.name ?? '—',
        detail: `grade point ${opt?.gradePoint ?? '0.0'}, adds ${r.gpa.optionalContribution}`,
        reason: opt?.absent
          ? 'Absent in the optional subject, counts as grade point 0 (R-12).'
          : `Optional grade point ${opt?.gradePoint} is at or below 2.0, so it adds nothing to the GPA (R-13, R-29).`,
      });
    }

    // Practical fail list: only a numeric practical below 8. AB never sets
    // `practicalFailed`, so it never lands here (A4).
    for (const s of r.subjects.filter((s) => s.practicalFailed)) {
      practicalFail.push({
        ...head,
        subject: s.name,
        detail: `theory ${s.theoryDisplay}, practical ${s.practicalDisplay}`,
        reason:
          s.role === 'compulsory'
            ? 'Practical below 8, so the subject is grade point 0 and the whole result is cancelled to F (R-11, R-13).'
            : 'Practical below 8, so the optional subject is grade point 0 and adds nothing (R-11).',
      });
    }

    // Absent list: AB in any subject, compulsory or optional.
    for (const s of r.subjects.filter((s) => s.absent)) {
      absent.push({
        ...head,
        subject: s.name,
        detail: s.role === 'compulsory' ? 'AB in a compulsory subject' : 'AB in the optional subject',
        reason:
          s.role === 'compulsory'
            ? 'AB, subject grade point 0, overall result F (R-12).'
            : 'Contributes 0 and lands on the checking list (R-12).',
      });
    }

    const lists = [
      r.flags.optional ? 'optional' : null,
      r.flags.practicalFail ? 'practical fail' : null,
      r.flags.absent ? 'absent' : null,
    ].filter((x): x is string => x !== null);
    if (lists.length > 1) multiple.push({ ...head, lists });
  }

  optional.sort(byId);
  practicalFail.sort(byId);
  absent.sort(byId);
  multiple.sort(byId);
  return { optional, practicalFail, absent, multiple };
}
