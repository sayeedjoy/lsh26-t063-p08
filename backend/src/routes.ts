/**
 * The API surface.
 *
 * `route()` is a plain function: dependencies + method + path + body in, a
 * status and a JSON-able body out. No socket, no framework — it can be unit
 * tested directly, and server.ts is the only place that touches `node:http`.
 *
 * Read routes (the grading engine) never touch the database. Only the
 * calculator's save/verify features do, and they degrade to a clear 503 when
 * no DATABASE_URL is configured.
 */

import { RULES, evaluateStudent } from './engine/index.js';

import type { Database } from './db.js';
import {
  ValidationError,
  validateStudentForCase,
  type Dataset,
  type LoadedCase,
} from './dataset.js';

export type DatabaseStatus = 'connected' | 'not configured' | 'error';

export interface RouteDeps {
  dataset: Dataset;
  db: Database | null;
  /**
   * How the database ended up in that state. Distinguishes "no DATABASE_URL
   * was given" from "one was given and the connection failed" — without this
   * a broken connection string looks identical to no configuration at all.
   */
  dbStatus?: DatabaseStatus;
}

export interface RouteResult {
  status: number;
  body: unknown;
}

const ok = (body: unknown): RouteResult => ({ status: 200, body });
const created = (body: unknown): RouteResult => ({ status: 201, body });
const bad = (message: string): RouteResult => ({
  status: 400,
  body: { error: { code: 'invalid_input', message } },
});
const notFound = (message: string): RouteResult => ({
  status: 404,
  body: { error: { code: 'not_found', message } },
});
const noDatabase = (): RouteResult => ({
  status: 503,
  body: {
    error: {
      code: 'database_unavailable',
      message:
        'This feature needs a database. Set DATABASE_URL to a PostgreSQL connection string and restart. ' +
        'Everything else — grading, traces, checking lists — works without one.',
    },
  },
});

const isRouteResult = (x: unknown): x is RouteResult =>
  typeof x === 'object' && x !== null && 'status' in x && 'body' in x;

function requireCase(dataset: Dataset, caseId: string): LoadedCase | RouteResult {
  return dataset.byId.get(caseId) ?? notFound(`No case "${caseId}" in the dataset.`);
}

const asObject = (body: unknown): Record<string, unknown> | null =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;

export async function route(
  deps: RouteDeps,
  method: string,
  path: string,
  body?: unknown,
): Promise<RouteResult> {
  const { dataset, db } = deps;
  const dbStatus: DatabaseStatus = deps.dbStatus ?? (db ? 'connected' : 'not configured');
  const segments = path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const [first, second, third, fourth] = segments;

  /* ------------------------------ GET ------------------------------ */

  if (method === 'GET') {
    if (segments.length === 1 && first === 'health') {
      return ok({
        ok: true,
        problemId: dataset.problemId,
        schemaVersion: dataset.schemaVersion,
        cases: dataset.totals.cases,
        students: dataset.totals.students,
        evaluatedInMs: dataset.evaluatedInMs,
        loadedAt: dataset.loadedAt,
        database: db ? ((await db.ping()) ? 'connected' : 'error') : dbStatus,
      });
    }

    if (segments.length === 1 && first === 'rules') {
      return ok({
        rules: Object.values(RULES),
        note: 'R-GP and R-PS are declared assumptions, not clauses from the brief — see docs/spec.md.',
      });
    }

    if (segments.length === 1 && first === 'cases') {
      return ok(
        dataset.cases.map((c) => ({
          caseId: c.caseId,
          students: c.summary.students,
          classes: c.summary.classes,
          passRate: c.summary.passRate,
          averageGpa: c.summary.averageGpa,
        })),
      );
    }

    if (segments.length === 1 && first === 'calculations') {
      if (!db) return noDatabase();
      return ok(await db.listCalculations());
    }

    if (segments.length === 2 && first === 'calculations') {
      if (!db) return noDatabase();
      const id = Number(second);
      if (!Number.isInteger(id)) return bad('Calculation id must be a whole number.');
      const found = await db.getCalculation(id);
      return found ? ok(found) : notFound(`No saved calculation ${id}.`);
    }

    if (segments.length === 2 && first === 'cases') {
      const found = requireCase(dataset, second!);
      if (isRouteResult(found)) return found;
      return ok({
        caseId: found.caseId,
        subjects: found.raw.subjects,
        compulsory: found.raw.compulsory,
        results: found.results,
        summary: found.summary,
      });
    }

    if (segments.length === 4 && first === 'cases' && third === 'students') {
      const found = requireCase(dataset, second!);
      if (isRouteResult(found)) return found;
      const student = found.results.find((r) => r.id === fourth);
      return student ? ok(student) : notFound(`No student "${fourth}" in case ${found.caseId}.`);
    }

    if (segments.length === 3 && first === 'cases' && third === 'checklists') {
      const found = requireCase(dataset, second!);
      if (isRouteResult(found)) return found;
      return ok({ caseId: found.caseId, counts: found.summary.checklistCounts, ...found.checklists });
    }

    if (segments.length === 3 && first === 'cases' && third === 'audit') {
      const found = requireCase(dataset, second!);
      if (isRouteResult(found)) return found;
      return ok(found.audit);
    }

    if (segments.length === 3 && first === 'cases' && third === 'verifications') {
      const found = requireCase(dataset, second!);
      if (isRouteResult(found)) return found;
      if (!db) return noDatabase();
      return ok(await db.listVerifications(found.caseId));
    }

    return notFound(`No route for GET ${path}.`);
  }

  /* ------------------------------ POST ----------------------------- */

  if (method === 'POST') {
    // Grade an ad-hoc mark sheet. Deliberately needs no database: the
    // calculator works whether or not persistence is configured.
    if (segments.length === 1 && first === 'calculate') {
      const payload = asObject(body);
      if (!payload) return bad('Post a JSON object with { caseId, student }.');
      const found = requireCase(dataset, String(payload['caseId'] ?? ''));
      if (isRouteResult(found)) return found;
      try {
        const student = validateStudentForCase(found.raw, payload['student']);
        return ok(evaluateStudent(found.raw, student));
      } catch (err) {
        if (err instanceof ValidationError) return bad(err.message);
        throw err;
      }
    }

    if (segments.length === 1 && first === 'calculations') {
      if (!db) return noDatabase();
      const payload = asObject(body);
      if (!payload) return bad('Post a JSON object with { caseId, student }.');
      const found = requireCase(dataset, String(payload['caseId'] ?? ''));
      if (isRouteResult(found)) return found;
      try {
        // Re-evaluate server-side: what gets stored is what this engine
        // computed, never a result the client claimed.
        const student = validateStudentForCase(found.raw, payload['student']);
        const result = evaluateStudent(found.raw, student);
        const saved = await db.saveCalculation({
          caseId: found.caseId,
          studentName: student.name,
          studentClass: student.class,
          optionalCode: student.optional,
          marks: student.marks,
          result,
        });
        return created(saved);
      } catch (err) {
        if (err instanceof ValidationError) return bad(err.message);
        throw err;
      }
    }

    if (segments.length === 3 && first === 'cases' && third === 'verifications') {
      const found = requireCase(dataset, second!);
      if (isRouteResult(found)) return found;
      if (!db) return noDatabase();

      const payload = asObject(body);
      if (!payload) return bad('Post a JSON object with { studentId, listName, verifiedBy, note }.');

      const studentId = String(payload['studentId'] ?? '');
      const listName = String(payload['listName'] ?? '');
      const verifiedBy = String(payload['verifiedBy'] ?? '').trim();

      if (!found.results.some((r) => r.id === studentId)) {
        return notFound(`No student "${studentId}" in case ${found.caseId}.`);
      }
      if (!['optional', 'practical', 'absent'].includes(listName)) {
        return bad('listName must be one of: optional, practical, absent.');
      }
      if (!verifiedBy) return bad('verifiedBy is required — who checked this student?');

      const note = payload['note'] === undefined || payload['note'] === null
        ? null
        : String(payload['note']);

      return created(
        await db.setVerification({ caseId: found.caseId, studentId, listName, verifiedBy, note }),
      );
    }

    return notFound(`No route for POST ${path}.`);
  }

  /* ----------------------------- DELETE ---------------------------- */

  if (method === 'DELETE') {
    if (segments.length === 2 && first === 'calculations') {
      if (!db) return noDatabase();
      const id = Number(second);
      if (!Number.isInteger(id)) return bad('Calculation id must be a whole number.');
      return (await db.deleteCalculation(id))
        ? ok({ deleted: id })
        : notFound(`No saved calculation ${id}.`);
    }

    if (segments.length === 5 && first === 'cases' && third === 'verifications') {
      const found = requireCase(dataset, second!);
      if (isRouteResult(found)) return found;
      if (!db) return noDatabase();
      return (await db.clearVerification(found.caseId, fourth!, segments[4]!))
        ? ok({ cleared: true })
        : notFound('No such verification.');
    }

    return notFound(`No route for DELETE ${path}.`);
  }

  return {
    status: 405,
    body: { error: { code: 'method_not_allowed', message: `${method} is not supported.` } },
  };
}
