/**
 * Task 9 — dataset loader, validation and evaluated cache.
 *
 * Reads the JSON once, validates it against the format the types describe,
 * evaluates every case once, and holds an immutable snapshot. Routes never
 * touch the raw JSON or re-run the engine.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  auditCase,
  buildChecklists,
  evaluateCase,
  summarise,
  type CaseAudit,
  type CaseSummary,
  type Checklists,
  type RawCase,
  type RawDataset,
  type RawMark,
  type RawStudent,
  type StudentResult,
  type SubjectDef,
} from './engine/index.js';

const here = dirname(fileURLToPath(import.meta.url));

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const fail = (path: string, message: string): never => {
  throw new ValidationError(`${path}: ${message}`);
};

/* ------------------------------------------------------------------ */
/* Validation — every failure names the case, student and field         */
/* ------------------------------------------------------------------ */

function validateSubjects(input: unknown, path: string): SubjectDef[] {
  if (!Array.isArray(input)) return fail(path, 'must be an array');
  return input.map((s, i) => {
    const p = `${path}[${i}]`;
    if (typeof s !== 'object' || s === null) return fail(p, 'must be an object');
    const sub = s as Record<string, unknown>;
    if (typeof sub['code'] !== 'string') fail(`${p}.code`, 'must be a string');
    if (typeof sub['name'] !== 'string') fail(`${p}.name`, 'must be a string');
    if (typeof sub['practical'] !== 'boolean') fail(`${p}.practical`, 'must be true or false');
    return { code: sub['code'] as string, name: sub['name'] as string, practical: sub['practical'] as boolean };
  });
}

function validateMark(path: string, mark: unknown, practical: boolean): RawMark {
  if (mark === 'AB') return 'AB';
  if (practical) {
    if (typeof mark !== 'object' || mark === null) {
      return fail(path, 'a subject with a practical part needs {theory, practical} or "AB"');
    }
    const { theory, practical: prac } = mark as Record<string, unknown>;
    if (!Number.isInteger(theory) || (theory as number) < 0 || (theory as number) > 75) {
      return fail(`${path}.theory`, 'must be a whole number from 0 to 75');
    }
    if (!Number.isInteger(prac) || (prac as number) < 0 || (prac as number) > 25) {
      return fail(`${path}.practical`, 'must be a whole number from 0 to 25');
    }
    return { theory: theory as number, practical: prac as number };
  }
  if (!Number.isInteger(mark) || (mark as number) < 0 || (mark as number) > 100) {
    return fail(path, 'a subject with no practical part needs a whole number from 0 to 100, or "AB"');
  }
  return mark as number;
}

function validateStudent(
  input: unknown,
  path: string,
  byCode: Map<string, SubjectDef>,
  compulsory: string[],
): RawStudent {
  if (typeof input !== 'object' || input === null) return fail(path, 'must be an object');
  const st = input as Record<string, unknown>;
  const id = typeof st['id'] === 'string' ? st['id'] : fail(`${path}.id`, 'must be a string');
  const p = `${path} (student ${id})`;

  if (typeof st['name'] !== 'string') fail(`${p}.name`, 'must be a string');
  if (typeof st['class'] !== 'string') fail(`${p}.class`, 'must be a string');
  if (typeof st['optional'] !== 'string') fail(`${p}.optional`, 'must be a subject code');
  const optional = st['optional'] as string;
  if (!byCode.has(optional)) fail(`${p}.optional`, `unknown subject code "${optional}"`);
  if (compulsory.includes(optional)) {
    fail(`${p}.optional`, `"${optional}" is a compulsory subject, it cannot also be the optional`);
  }
  if (typeof st['marks'] !== 'object' || st['marks'] === null) {
    return fail(`${p}.marks`, 'must be an object of subject code to mark');
  }

  const rawMarks = st['marks'] as Record<string, unknown>;
  const expectedCodes = [...compulsory, optional];
  const markCount = Object.keys(rawMarks).length;
  if (markCount !== expectedCodes.length) {
    fail(`${p}.marks`, `expected ${expectedCodes.length} marks (6 compulsory + optional), found ${markCount}`);
  }

  const marks: Record<string, RawMark> = {};
  for (const code of expectedCodes) {
    if (!(code in rawMarks)) fail(`${p}.marks`, `missing a mark for ${code}`);
    marks[code] = validateMark(`${p}.marks.${code}`, rawMarks[code], byCode.get(code)!.practical);
  }

  return { id, name: st['name'] as string, class: st['class'] as string, optional, marks };
}

export function validateCase(input: unknown, path = 'case'): RawCase {
  if (typeof input !== 'object' || input === null) return fail(path, 'must be an object');
  const c = input as Record<string, unknown>;
  const caseId = typeof c['case_id'] === 'string' ? c['case_id'] : fail(`${path}.case_id`, 'must be a string');
  const cp = `case ${caseId}`;

  const subjects = validateSubjects(c['subjects'], `${cp}.subjects`);
  const byCode = new Map(subjects.map((s) => [s.code, s]));

  if (!Array.isArray(c['compulsory'])) return fail(`${cp}.compulsory`, 'must be an array');
  const compulsory = (c['compulsory'] as unknown[]).map((code, i) => {
    if (typeof code !== 'string') return fail(`${cp}.compulsory[${i}]`, 'must be a subject code');
    if (!byCode.has(code)) fail(`${cp}.compulsory[${i}]`, `unknown subject code "${code}"`);
    return code;
  });
  if (compulsory.length !== 6) fail(`${cp}.compulsory`, `expected 6 compulsory subjects, got ${compulsory.length}`);

  if (!Array.isArray(c['students'])) return fail(`${cp}.students`, 'must be an array');
  const students = (c['students'] as unknown[]).map((s, i) =>
    validateStudent(s, `${cp}.students[${i}]`, byCode, compulsory),
  );

  return { case_id: caseId, subjects, compulsory, students };
}

/**
 * Validates one ad-hoc student against a case's subject set — used by the
 * calculator, so a mark sheet typed into the UI is checked by exactly the
 * same rules as one loaded from the dataset file.
 */
export function validateStudentForCase(
  caseDef: Pick<RawCase, 'subjects' | 'compulsory'>,
  input: unknown,
): RawStudent {
  const byCode = new Map(caseDef.subjects.map((s) => [s.code, s]));
  return validateStudent(input, 'student', byCode, caseDef.compulsory);
}

export function validateDataset(input: unknown): RawDataset {
  if (typeof input !== 'object' || input === null) throw new ValidationError('dataset: must be an object');
  const d = input as Record<string, unknown>;
  if (!Array.isArray(d['cases'])) throw new ValidationError('dataset.cases: must be an array of cases');
  return {
    schema_version: String(d['schema_version'] ?? 'unknown'),
    problem_id: String(d['problem_id'] ?? 'P08'),
    format_note: typeof d['format_note'] === 'string' ? d['format_note'] : undefined,
    cases: (d['cases'] as unknown[]).map((c, i) => validateCase(c, `cases[${i}]`)),
  };
}

/* ------------------------------------------------------------------ */
/* Load + evaluate once, cache                                         */
/* ------------------------------------------------------------------ */

export interface LoadedCase {
  caseId: string;
  raw: RawCase;
  results: StudentResult[];
  summary: CaseSummary;
  checklists: Checklists;
  audit: CaseAudit;
}

export interface Dataset {
  path: string;
  schemaVersion: string;
  problemId: string;
  cases: LoadedCase[];
  byId: Map<string, LoadedCase>;
  totals: { cases: number; students: number };
  loadedAt: string;
  evaluatedInMs: number;
}

export function resolveDatasetPath(): string {
  const candidates = [
    process.env.DATA_FILE,
    resolve(here, '../data/P08_school_results_public.json'), // backend/data
    resolve(here, '../../data/P08_school_results_public.json'), // repo-root data
    resolve(process.cwd(), 'backend/data/P08_school_results_public.json'),
    resolve(process.cwd(), 'data/P08_school_results_public.json'),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not find the dataset. Looked in:\n  ${candidates.join('\n  ')}`);
}

export function buildLoadedCase(caseDef: RawCase): LoadedCase {
  const results = evaluateCase(caseDef);
  return {
    caseId: caseDef.case_id,
    raw: caseDef,
    results,
    summary: summarise(caseDef.case_id, results),
    checklists: buildChecklists(results),
    audit: auditCase(caseDef, results),
  };
}

export function loadDataset(path = resolveDatasetPath()): Dataset {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const dataset = validateDataset(raw);

  const started = performance.now();
  const cases = dataset.cases.map(buildLoadedCase);
  const evaluatedInMs = Math.round((performance.now() - started) * 100) / 100;

  return {
    path,
    schemaVersion: dataset.schema_version,
    problemId: dataset.problem_id,
    cases,
    byId: new Map(cases.map((c) => [c.caseId, c])),
    totals: { cases: cases.length, students: cases.reduce((n, c) => n + c.results.length, 0) },
    loadedAt: new Date().toISOString(),
    evaluatedInMs,
  };
}
