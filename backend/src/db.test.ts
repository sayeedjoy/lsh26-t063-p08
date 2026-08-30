/**
 * Database tests. These need a real PostgreSQL — set TEST_DATABASE_URL (or
 * DATABASE_URL) and they run; leave it unset and they skip, so `pnpm test`
 * stays green on a machine with no database.
 *
 *   docker run -d --name p08-pg -e POSTGRES_PASSWORD=p08 -e POSTGRES_USER=p08 \
 *     -e POSTGRES_DB=p08 -p 55432:5432 postgres:16-alpine
 *   TEST_DATABASE_URL=postgres://p08:p08@localhost:55432/p08 pnpm test
 */

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Database } from './db.js';
import { loadDataset, resolveDatasetPath } from './dataset.js';
import { route, type RouteDeps } from './routes.js';

const here = dirname(fileURLToPath(import.meta.url));
const REAL_DATA = resolveDatasetPath();

const URL_ = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const skip = URL_ ? false : 'no TEST_DATABASE_URL / DATABASE_URL set';

const MARKS = {
  BAN: 70, ENG: 70, MAT: 70,
  PHY: { theory: 55, practical: 20 },
  CHE: { theory: 55, practical: 20 },
  BIO: { theory: 55, practical: 20 },
  HMT: { theory: 55, practical: 20 },
};

describe('database', { skip }, () => {
  let db: Database;
  let deps: RouteDeps;

  before(async () => {
    db = (await Database.connect(URL_))!;
    deps = { dataset: loadDataset(REAL_DATA), db };
    // Start from a known state so counts are meaningful.
    await db.truncateAll();
  });

  after(async () => {
    if (db) await db.close();
  });

  test('connects and reports healthy', async () => {
    assert.equal(await db.ping(), true);
  });

  test('health route reports the database as connected', async () => {
    const r = await route(deps, 'GET', '/api/health');
    assert.equal((r.body as { database: string }).database, 'connected');
  });

  describe('saved calculations', () => {
    test('saves a calculation, re-evaluating server-side', async () => {
      const r = await route(deps, 'POST', '/api/calculations', {
        caseId: 'PUB-01',
        student: { id: 'ADHOC', name: 'Saved Student', class: 'Class 9', optional: 'HMT', marks: MARKS },
      });
      assert.equal(r.status, 201);
      const saved = r.body as { id: number; gpa: string; letter: string; result: { subjects: unknown[] } };
      assert.ok(saved.id > 0);
      assert.equal(saved.gpa, '4.33');
      assert.equal(saved.letter, 'A');
      assert.equal(saved.result.subjects.length, 7, 'the full trace is stored, not just the GPA');
    });

    test('lists saved calculations, newest first', async () => {
      const r = await route(deps, 'GET', '/api/calculations');
      const rows = r.body as Array<{ studentName: string }>;
      assert.ok(rows.length >= 1);
      assert.equal(rows[0]!.studentName, 'Saved Student');
    });

    test('fetches one by id, and 404s on a missing one', async () => {
      const list = (await route(deps, 'GET', '/api/calculations')).body as Array<{ id: number }>;
      const id = list[0]!.id;
      assert.equal((await route(deps, 'GET', `/api/calculations/${id}`)).status, 200);
      assert.equal((await route(deps, 'GET', '/api/calculations/99999999')).status, 404);
    });

    test('deletes one', async () => {
      const list = (await route(deps, 'GET', '/api/calculations')).body as Array<{ id: number }>;
      const id = list[0]!.id;
      assert.equal((await route(deps, 'DELETE', `/api/calculations/${id}`)).status, 200);
      assert.equal((await route(deps, 'GET', `/api/calculations/${id}`)).status, 404);
    });

    test('a bad mark sheet is rejected before anything is stored', async () => {
      const before_ = ((await route(deps, 'GET', '/api/calculations')).body as unknown[]).length;
      const r = await route(deps, 'POST', '/api/calculations', {
        caseId: 'PUB-01',
        student: {
          id: 'X', name: 'Bad', class: 'Class 9', optional: 'HMT',
          marks: { ...MARKS, CHE: { theory: 99, practical: 20 } },
        },
      });
      assert.equal(r.status, 400);
      const after_ = ((await route(deps, 'GET', '/api/calculations')).body as unknown[]).length;
      assert.equal(after_, before_, 'nothing was written');
    });
  });

  describe('checking-list verifications', () => {
    const studentId = 'S001';

    test('records a sign-off', async () => {
      const r = await route(deps, 'POST', '/api/cases/PUB-01/verifications', {
        studentId, listName: 'optional', verifiedBy: 'Ms Rahman', note: 'checked against the register',
      });
      assert.equal(r.status, 201);
      const v = r.body as { verifiedBy: string; note: string };
      assert.equal(v.verifiedBy, 'Ms Rahman');
      assert.equal(v.note, 'checked against the register');
    });

    test('re-verifying updates in place rather than duplicating', async () => {
      await route(deps, 'POST', '/api/cases/PUB-01/verifications', {
        studentId, listName: 'optional', verifiedBy: 'Mr Islam', note: 're-checked',
      });
      const rows = (await route(deps, 'GET', '/api/cases/PUB-01/verifications')).body as Array<{
        studentId: string; listName: string; verifiedBy: string;
      }>;
      const matching = rows.filter((v) => v.studentId === studentId && v.listName === 'optional');
      assert.equal(matching.length, 1);
      assert.equal(matching[0]!.verifiedBy, 'Mr Islam');
    });

    test('the same student can be signed off on more than one list', async () => {
      await route(deps, 'POST', '/api/cases/PUB-01/verifications', {
        studentId, listName: 'absent', verifiedBy: 'Ms Rahman', note: null,
      });
      const rows = (await route(deps, 'GET', '/api/cases/PUB-01/verifications')).body as Array<{
        studentId: string;
      }>;
      assert.equal(rows.filter((v) => v.studentId === studentId).length, 2);
    });

    test('rejects an unknown student, an unknown list and a missing verifier', async () => {
      const unknownStudent = await route(deps, 'POST', '/api/cases/PUB-01/verifications', {
        studentId: 'NOPE', listName: 'optional', verifiedBy: 'Ms Rahman',
      });
      assert.equal(unknownStudent.status, 404);

      const badList = await route(deps, 'POST', '/api/cases/PUB-01/verifications', {
        studentId, listName: 'nonsense', verifiedBy: 'Ms Rahman',
      });
      assert.equal(badList.status, 400);

      const noVerifier = await route(deps, 'POST', '/api/cases/PUB-01/verifications', {
        studentId, listName: 'optional', verifiedBy: '   ',
      });
      assert.equal(noVerifier.status, 400);
    });

    test('clears a sign-off', async () => {
      const r = await route(deps, 'DELETE', `/api/cases/PUB-01/verifications/${studentId}/absent`);
      assert.equal(r.status, 200);
      const rows = (await route(deps, 'GET', '/api/cases/PUB-01/verifications')).body as Array<{
        studentId: string; listName: string;
      }>;
      assert.equal(rows.filter((v) => v.studentId === studentId && v.listName === 'absent').length, 0);
    });
  });
});
