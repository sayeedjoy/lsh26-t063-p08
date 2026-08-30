/**
 * Task 11 — offline export CLI. Writes the judged artifacts to ./output.
 *
 * Deterministic: no timestamps in the artifacts themselves, stable key order
 * (object literals below are written in a fixed order), so two consecutive
 * runs produce byte-identical output (AC6).
 *
 *   pnpm export
 *   DATA_FILE=other.json OUT_DIR=other-output pnpm export
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChecklistRow, MultipleRow, StudentResult } from './engine/index.js';

import { loadDataset, type LoadedCase } from './dataset.js';
import { loadEnv } from './env.js';

loadEnv();

const here = dirname(fileURLToPath(import.meta.url));
// Anchored on this file, not process.cwd(), so the artifacts land in
// backend/output/ no matter where `pnpm run export` was invoked from.
const outDir = resolve(process.env.OUT_DIR ?? resolve(here, '../output'));
const dataset = loadDataset();

mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ */
/* CSV                                                                  */
/* ------------------------------------------------------------------ */

const cell = (value: unknown): string => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header: string[], rows: unknown[][]): string =>
  [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';

const checklistCsv = (rows: ChecklistRow[]): string =>
  toCsv(
    ['student_id', 'name', 'class', 'subject', 'detail', 'gpa', 'letter', 'reason'],
    rows.map((r) => [r.id, r.name, r.class, r.subject, r.detail, r.gpa, r.letter, r.reason]),
  );

const multipleCsv = (rows: MultipleRow[]): string =>
  toCsv(
    ['student_id', 'name', 'class', 'lists', 'gpa', 'letter'],
    rows.map((r) => [r.id, r.name, r.class, r.lists.join(' + '), r.gpa, r.letter]),
  );

/* ------------------------------------------------------------------ */
/* traces.txt — readable without a viewer                              */
/* ------------------------------------------------------------------ */

function studentTrace(r: StudentResult): string {
  const lines: string[] = [];
  lines.push('-'.repeat(78));
  lines.push(`${r.id}  ${r.name}  (${r.class})`);
  lines.push('-'.repeat(78));
  for (const s of r.subjects) {
    const role = s.role === 'optional' ? 'optional' : 'compulsory';
    lines.push(
      `  ${s.name.padEnd(22)} [${role.padEnd(10)}] mark=${s.totalDisplay.padEnd(8)} ` +
        `gp=${s.gradePoint.padEnd(4)} rule=${s.ruleId.padEnd(5)} ${s.reason}`,
    );
  }
  lines.push('');
  lines.push('  GPA working:');
  for (const step of r.gpa.steps) lines.push(`    [${step.ruleId}] ${step.text}`);
  lines.push('');
  lines.push(`  PUBLISHED: GPA ${r.gpaValue}  LETTER ${r.letter}`);
  if (!r.passed) {
    lines.push(`  CANCELLED BY: ${r.failingSubjects.join(', ')}`);
  }
  const flags = [
    r.flags.optional ? 'optional list' : null,
    r.flags.practicalFail ? 'practical fail list' : null,
    r.flags.absent ? 'absent list' : null,
  ].filter(Boolean);
  if (flags.length) lines.push(`  CHECKING LISTS: ${flags.join(', ')}`);
  lines.push('');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Write everything                                                    */
/* ------------------------------------------------------------------ */

for (const c of dataset.cases) {
  const dir = join(outDir, c.caseId);
  mkdirSync(dir, { recursive: true });

  const resultsJson = {
    caseId: c.caseId,
    subjects: c.raw.subjects,
    compulsory: c.raw.compulsory,
    summary: c.summary,
    audit: c.audit,
    results: c.results,
  };
  writeFileSync(join(dir, 'results.json'), JSON.stringify(resultsJson, null, 2));

  const traces = c.results.map(studentTrace).join('\n');
  writeFileSync(join(dir, 'traces.txt'), traces);

  writeFileSync(join(dir, 'checklist-optional.csv'), checklistCsv(c.checklists.optional));
  writeFileSync(join(dir, 'checklist-practical-fail.csv'), checklistCsv(c.checklists.practicalFail));
  writeFileSync(join(dir, 'checklist-absent.csv'), checklistCsv(c.checklists.absent));
  writeFileSync(join(dir, 'checklist-multiple.csv'), multipleCsv(c.checklists.multiple));
}

const topLevel = {
  problemId: dataset.problemId,
  schemaVersion: dataset.schemaVersion,
  totals: dataset.totals,
  cases: dataset.cases.map((c: LoadedCase) => ({
    caseId: c.caseId,
    summary: c.summary,
    audit: { pass: c.audit.pass, criteria: c.audit.criteria },
  })),
};
writeFileSync(join(outDir, 'P08_results.json'), JSON.stringify(topLevel, null, 2));

console.log(
  `Graded ${dataset.totals.students} students across ${dataset.totals.cases} cases in ${dataset.evaluatedInMs}ms\n` +
    `Wrote ${outDir}/P08_results.json and per-case artifacts in ${outDir}/<case_id>/.`,
);
