/**
 * Task 6 — per-case and per-class rollups.
 *
 * Average GPA is computed over *published* GPAs, so a cancelled student
 * (0.00) pulls the average down — the office should read it that way, and
 * the UI states this explicitly.
 */

import { buildChecklists } from './checklists.js';
import { divideHalfUp, formatHundredths } from './rules.js';
import type { CaseSummary, LetterGrade, StudentResult } from './types.js';

function averageGpa(rows: StudentResult[]): string {
  if (rows.length === 0) return '0.00';
  const sum = rows.reduce((s, r) => s + r.gpaHundredths, 0);
  return formatHundredths(divideHalfUp(sum, rows.length));
}

export function summarise(caseId: string, results: StudentResult[]): CaseSummary {
  const gradeSpread: Record<LetterGrade, number> = {
    'A+': 0, A: 0, 'A-': 0, B: 0, C: 0, D: 0, F: 0,
  };
  for (const r of results) gradeSpread[r.letter] += 1;

  const passed = results.filter((r) => r.passed);
  const classes = [...new Set(results.map((r) => r.class))].sort();
  const checklists = buildChecklists(results);

  return {
    caseId,
    students: results.length,
    classes,
    passed: passed.length,
    failed: results.length - passed.length,
    passRate: results.length === 0 ? '0.0' : ((passed.length / results.length) * 100).toFixed(1),
    averageGpa: averageGpa(passed),
    gradeSpread,
    byClass: classes.map((klass) => {
      const rows = results.filter((r) => r.class === klass);
      const p = rows.filter((r) => r.passed);
      return {
        class: klass,
        students: rows.length,
        passed: p.length,
        failed: rows.length - p.length,
        averageGpa: averageGpa(p),
      };
    }),
    checklistCounts: {
      optional: checklists.optional.length,
      practicalFail: new Set(checklists.practicalFail.map((r) => r.id)).size,
      absent: new Set(checklists.absent.map((r) => r.id)).size,
      multiple: checklists.multiple.length,
    },
  };
}
