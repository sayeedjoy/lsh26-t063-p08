/**
 * `node:http` server. No web framework: `route()` decides the JSON API, this
 * file only wires sockets to it.
 *
 * The frontend deploys as its own container on its own origin, so the API
 * answers cross-origin requests and has to speak CORS. It still serves a built
 * frontend from `frontend/dist` if one happens to be present, which keeps the
 * old single-container/local `pnpm start` flow working; in the split deploy
 * that directory does not exist and the API simply serves the API.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Database } from './db.js';
import { loadDataset, type Dataset } from './dataset.js';
import { loadEnv } from './env.js';
import { route, type DatabaseStatus } from './routes.js';

// Before anything reads process.env. Values already in the real environment
// (Docker, Dokploy) are left alone.
const loadedEnvKeys = loadEnv();

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY_BYTES = 1_000_000;

/**
 * Which origins the browser may call this API from.
 *
 * `CORS_ORIGIN` is a comma-separated allowlist of exact origins, e.g.
 * `https://results.example.com,https://staging.example.com`. `*` allows any
 * origin, which is a reasonable setting here — the API is read-mostly and
 * carries no cookies or auth — but naming the frontend's origin is better.
 * Unset means no CORS headers at all, which is right when the frontend is
 * served same-origin.
 */
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const ALLOW_ANY_ORIGIN = CORS_ORIGINS.includes('*');

/**
 * Returns the value for `Access-Control-Allow-Origin`, or null to send none.
 * The request's own origin is echoed rather than `*` so the header stays
 * correct if credentials are ever added, and so `Vary: Origin` is honest.
 */
function allowedOrigin(requestOrigin: string | undefined): string | null {
  if (CORS_ORIGINS.length === 0) return null;
  if (!requestOrigin) return ALLOW_ANY_ORIGIN ? '*' : null;
  const normalised = requestOrigin.replace(/\/+$/, '');
  if (ALLOW_ANY_ORIGIN || CORS_ORIGINS.includes(normalised)) return requestOrigin;
  return null;
}

function corsHeaders(req: IncomingMessage): Record<string, string> {
  const origin = allowedOrigin(req.headers.origin);
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const STATIC_CANDIDATES = [
  process.env.STATIC_DIR,
  resolve(here, '../../frontend/dist'),
  resolve(process.cwd(), 'frontend/dist'),
].filter((p): p is string => Boolean(p));

const staticDir = STATIC_CANDIDATES.find((p) => existsSync(join(p, 'index.html')));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

function serveStatic(res: ServerResponse, filePath: string) {
  const ext = extname(filePath);
  const stat = statSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  createReadStream(filePath).pipe(res);
}

/** Collects a JSON request body, refusing anything oversized. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolvePromise(undefined);
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Request body is not valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

export function createRequestHandler(
  dataset: Dataset,
  db: Database | null,
  dbStatus: DatabaseStatus = db ? 'connected' : 'not configured',
) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const method = req.method ?? 'GET';

    if (url.pathname.startsWith('/api')) {
      const cors = corsHeaders(req);

      // Preflight. Answered even for paths that do not exist: the browser is
      // asking about the method and headers, not about the resource.
      if (method === 'OPTIONS') {
        res.writeHead(204, { ...cors, 'Content-Length': '0' });
        res.end();
        return;
      }

      try {
        const body =
          method === 'POST' || method === 'PUT' || method === 'PATCH'
            ? await readJsonBody(req)
            : undefined;
        const result = await route({ dataset, db, dbStatus }, method, url.pathname, body);
        sendJson(res, result.status, result.body, cors);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error';
        const clientFault = /valid JSON|too large/.test(message);
        if (!clientFault) console.error('[api]', err);
        sendJson(
          res,
          clientFault ? 400 : 500,
          { error: { code: clientFault ? 'invalid_request' : 'internal_error', message } },
          cors,
        );
      }
      return;
    }

    if (staticDir) {
      const safePath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
      const candidate = join(staticDir, safePath);
      const resolved = resolve(candidate);
      const within = resolved === resolve(staticDir) || resolved.startsWith(resolve(staticDir) + '/');
      if (within && existsSync(resolved) && statSync(resolved).isFile()) {
        serveStatic(res, resolved);
        return;
      }
      // SPA fallback: any non-file, non-API path serves index.html.
      serveStatic(res, join(staticDir, 'index.html'));
      return;
    }

    sendJson(res, 200, {
      message:
        'P08 result engine API is running. This container serves the API only — ' +
        'the UI is its own container (see frontend/Dockerfile).',
      health: '/api/health',
    });
  };
}

const isEntrypoint =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  const dataset = loadDataset();

  // A database is optional: without one the app still grades, traces and
  // lists — only saving and verification sign-off are unavailable.
  let db: Database | null = null;
  let dbStatus: DatabaseStatus = 'not configured';
  if (process.env.DATABASE_URL) {
    try {
      db = await Database.connect();
      dbStatus = db ? 'connected' : 'not configured';
    } catch (err) {
      dbStatus = 'error';
      console.error(
        `[db] DATABASE_URL is set but the connection failed: ${err instanceof Error ? err.message : err}\n` +
          '     Continuing without persistence — grading routes are unaffected.',
      );
    }
  }

  const server = createServer(createRequestHandler(dataset, db, dbStatus));
  server.listen(PORT, () => {
    console.log(
      `P08 result engine on http://localhost:${PORT}\n` +
        `  dataset : ${dataset.path}\n` +
        `  graded  : ${dataset.totals.students} students across ${dataset.totals.cases} cases in ${dataset.evaluatedInMs}ms\n` +
        `  static  : ${staticDir ?? '(none — the UI is served by its own container)'}\n` +
        `  cors    : ${CORS_ORIGINS.length ? CORS_ORIGINS.join(', ') : 'off (CORS_ORIGIN unset — same-origin only)'}\n` +
        `  database: ${
          dbStatus === 'connected'
            ? 'connected'
            : dbStatus === 'error'
              ? 'DATABASE_URL is set but the connection FAILED (see the error above)'
              : 'not configured (DATABASE_URL unset)'
        }` +
        // Names only — never the values, so a connection string with a
        // password in it cannot end up in a deploy log.
        (loadedEnvKeys.length ? `\n  env file: applied ${loadedEnvKeys.join(', ')}` : ''),
    );
  });

  const shutdown = async () => {
    server.close();
    if (db) await db.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
