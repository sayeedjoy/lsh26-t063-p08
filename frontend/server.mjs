/**
 * Static server for the built frontend. Plain `node:http` — no nginx, no
 * dependencies, so the runtime image is just Node plus `dist/`.
 *
 * Two things it does beyond serving files:
 *
 *   1. `/env.js` is rendered from the process environment on every request,
 *      so `API_URL` is a *runtime* setting. One built image can point at any
 *      backend; changing the variable in Dokploy and restarting is enough.
 *   2. SPA fallback — any path that is not a real file serves index.html.
 */

import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const ROOT = resolve(process.env.STATIC_DIR ?? join(here, 'dist'));

// Trailing slashes are stripped so `https://api.example.com/` and
// `.../` behave the same; the client appends `/api/...` itself.
const API_URL = (process.env.API_URL ?? '').replace(/\/+$/, '');

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`No build found at ${ROOT}. Run \`pnpm run build\` first.`);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const indexHtml = readFileSync(join(ROOT, 'index.html'));

function sendFile(res, filePath) {
  const ext = extname(filePath);
  const stat = statSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    // Vite fingerprints everything under /assets, so only those are safe to
    // cache hard. index.html must not be cached or a deploy goes unnoticed.
    'Cache-Control': filePath.includes(`${ROOT}/assets/`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  });
  createReadStream(filePath).pipe(res);
}

function sendIndex(res, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': indexHtml.length,
    'Cache-Control': 'no-cache',
  });
  res.end(indexHtml);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  // Rendered fresh every time: this is the whole point of runtime config.
  if (url.pathname === '/env.js') {
    const body = `window.__APP_ENV__ = ${JSON.stringify({ API_URL })};\n`;
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    res.end(body);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  const safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const resolved = resolve(join(ROOT, safePath));
  const within = resolved === ROOT || resolved.startsWith(ROOT + '/');

  if (within && existsSync(resolved) && statSync(resolved).isFile()) {
    sendFile(res, resolved);
    return;
  }

  sendIndex(res);
});

server.listen(PORT, HOST, () => {
  console.log(
    `P08 frontend on http://${HOST}:${PORT}\n` +
      `  static : ${ROOT}\n` +
      `  api    : ${API_URL || '(same origin — set API_URL to point elsewhere)'}`,
  );
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
