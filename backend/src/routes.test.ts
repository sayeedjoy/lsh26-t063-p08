import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDataset, resolveDatasetPath } from './dataset.js';
import { route } from './routes.js';
import type { StudentResult } from './engine/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const REAL_DATA = resolveDatasetPath();
const dataset = loadDataset(REAL_DATA);
// No DATABASE_URL in unit tests: these cover the grading routes, which never
// touch the database. DB-backed routes are covered in db.test.ts.
const deps = { dataset, db: null };

describe('GET /api/health', () => {
  test('reports 25 cases and 1765 students', async () => {
    const r = await route(deps, 'GET', '/api/health');
    assert.equal(r.status, 200);
    const body = r.body as { cases: number; students: number; evaluatedInMs: number };
    assert.equal(body.cases, 25);
    assert.equal(body.students, 1765);
    assert.ok(body.evaluatedInMs >= 0);
  });
});

describe('GET /api/rules', () => {
  test('returns every rule id', async () => {
    const r = await route(deps, 'GET', '/api/rules');
    const body = r.body as { rules: Array<{ id: string }> };
    const ids = body.rules.map((x) => x.id).sort();
    assert.deepEqual(ids, ['R-10', 'R-11', 'R-12', 'R-13', 'R-29', 'R-GP', 'R-PS']);
  });
});

describe('GET /api/cases', () => {
  test('lists all 25 cases with summary fields', async () => {
    const r = await route(deps, 'GET', '/api/cases');
    const body = r.body as Array<{ caseId: string; students: number }>;
    assert.equal(body.length, 25);
    assert.ok(body.every((c) => c.students >= 60));
  });
});

describe('GET /api/cases/:id', () => {
  test('returns the full evaluated case', async () => {
    const r = await route(deps, 'GET', '/api/cases/PUB-01');
    assert.equal(r.status, 200);
    const body = r.body as { caseId: string; results: StudentResult[]; summary: { students: number } };
    assert.equal(body.caseId, 'PUB-01');
    assert.equal(body.results.length, body.summary.students);
  });

  test('404s on an unknown case id, not 500', async () => {
    const r = await route(deps, 'GET', '/api/cases/NOPE');
    assert.equal(r.status, 404);
    assert.ok((r.body as { error: unknown }).error);
  });
});

describe('GET /api/cases/:id/students/:sid', () => {
  test('returns the full trace for a real student', async () => {
    const caseBody = (await route(deps, 'GET', '/api/cases/PUB-01')).body as { results: StudentResult[] };
    const someId = caseBody.results[0]!.id;
    const r = await route(deps, 'GET', `/api/cases/PUB-01/students/${someId}`);
    assert.equal(r.status, 200);
    const student = r.body as StudentResult;
    assert.equal(student.id, someId);
    assert.ok(student.subjects.length >= 6);
  });

  test('404s on an unknown student id', async () => {
    const r = await route(deps, 'GET', '/api/cases/PUB-01/students/NOPE');
    assert.equal(r.status, 404);
  });

  test('404s on an unknown case before even looking at the student', async () => {
    const r = await route(deps, 'GET', '/api/cases/NOPE/students/S001');
    assert.equal(r.status, 404);
  });
});

describe('GET /api/cases/:id/checklists', () => {
  test('returns the three lists plus multiple', async () => {
    const r = await route(deps, 'GET', '/api/cases/PUB-01/checklists');
    assert.equal(r.status, 200);
    const body = r.body as { optional: unknown[]; practicalFail: unknown[]; absent: unknown[]; multiple: unknown[] };
    assert.ok(Array.isArray(body.optional));
    assert.ok(Array.isArray(body.practicalFail));
    assert.ok(Array.isArray(body.absent));
    assert.ok(Array.isArray(body.multiple));
  });
});

describe('GET /api/cases/:id/audit', () => {
  test('returns a passing D1 audit for a real case', async () => {
    const r = await route(deps, 'GET', '/api/cases/PUB-01/audit');
    assert.equal(r.status, 200);
    const body = r.body as { pass: boolean; hardEdgeStudents: unknown[] };
    assert.equal(body.pass, true);
    assert.ok(body.hardEdgeStudents.length >= 8);
  });
});

describe('unknown routes', () => {
  test('404s with a JSON body', async () => {
    const r = await route(deps, 'GET', '/api/nonsense');
    assert.equal(r.status, 404);
    assert.ok((r.body as { error: { message: string } }).error.message);
  });

  test('POST to a path that has no POST handler 404s', async () => {
    const r = await route(deps, 'POST', '/api/health');
    assert.equal(r.status, 404);
  });

  test('an entirely unsupported method returns 405', async () => {
    const r = await route(deps, 'PUT', '/api/health');
    assert.equal(r.status, 405);
  });
});

describe('response time (AC7)', () => {
  test('each route responds well under 200ms after load', async () => {
    const started = performance.now();
    await route(deps, 'GET', '/api/cases/PUB-01');
    await route(deps, 'GET', '/api/cases/PUB-01/checklists');
    await route(deps, 'GET', '/api/cases/PUB-01/audit');
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 200, `took ${elapsed.toFixed(1)}ms`);
  });
});

describe('POST /api/calculate — the calculator needs no database', () => {
  const marks = {
    BAN: 70, ENG: 70, MAT: 70,
    PHY: { theory: 55, practical: 20 },
    CHE: { theory: 55, practical: 20 },
    BIO: { theory: 55, practical: 20 },
    HMT: { theory: 55, practical: 20 },
  }

  test('grades an ad-hoc mark sheet', async () => {
    const r = await route(deps, 'POST', '/api/calculate', {
      caseId: 'PUB-01',
      student: { id: 'ADHOC', name: 'Typed In', class: 'Class 9', optional: 'HMT', marks },
    })
    assert.equal(r.status, 200)
    const student = r.body as StudentResult
    assert.equal(student.name, 'Typed In')
    assert.equal(student.subjects.length, 7)
    assert.ok(student.gpa.steps.length > 0)
  })

  test('a bad mark is rejected with 400 naming the field', async () => {
    const r = await route(deps, 'POST', '/api/calculate', {
      caseId: 'PUB-01',
      student: {
        id: 'ADHOC', name: 'Bad', class: 'Class 9', optional: 'HMT',
        marks: { ...marks, PHY: { theory: 90, practical: 20 } },
      },
    })
    assert.equal(r.status, 400)
    assert.match((r.body as { error: { message: string } }).error.message, /PHY/)
  })

  test('an unknown case 404s', async () => {
    const r = await route(deps, 'POST', '/api/calculate', { caseId: 'NOPE', student: {} })
    assert.equal(r.status, 404)
  })
})

describe('database-backed routes degrade cleanly with no DATABASE_URL', () => {
  test('saving, listing and verifying return 503, not a crash', async () => {
    for (const [method, path] of [
      ['GET', '/api/calculations'],
      ['POST', '/api/calculations'],
      ['GET', '/api/cases/PUB-01/verifications'],
      ['POST', '/api/cases/PUB-01/verifications'],
    ] as const) {
      const r = await route(deps, method, path, { caseId: 'PUB-01', student: {} })
      assert.equal(r.status, 503, `${method} ${path}`)
      assert.equal((r.body as { error: { code: string } }).error.code, 'database_unavailable')
    }
  })
})

describe('health reports why the database is unavailable', () => {
  test('distinguishes "not configured" from a failed connection', async () => {
    const unset = await route({ dataset, db: null, dbStatus: 'not configured' }, 'GET', '/api/health')
    assert.equal((unset.body as { database: string }).database, 'not configured')

    // A broken connection string must NOT look like no configuration at all.
    const failed = await route({ dataset, db: null, dbStatus: 'error' }, 'GET', '/api/health')
    assert.equal((failed.body as { database: string }).database, 'error')
  })
})
