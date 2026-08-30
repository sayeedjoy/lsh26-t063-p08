#!/usr/bin/env node
/**
 * Copies the grading engine from backend/src/engine into frontend/src/engine.
 *
 * The two apps are deployed independently — separate images, separate build
 * contexts, separate lockfiles — so the frontend cannot import the backend's
 * engine through a workspace link any more. It carries a vendored copy
 * instead, and this script is the only thing allowed to write it.
 *
 *   node scripts/sync-engine.mjs           refresh the copy
 *   node scripts/sync-engine.mjs --check   fail (exit 1) if it has drifted
 *
 * Run --check in CI so a change to backend/src/engine that never reached the
 * frontend is caught at review time rather than in the browser.
 */

import { readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(repoRoot, 'backend/src/engine');
const DEST = join(repoRoot, 'frontend/src/engine');

const BANNER =
  '// GENERATED FILE — do not edit.\n' +
  '// Vendored from backend/src/engine by `node scripts/sync-engine.mjs`.\n' +
  '// Edit the backend copy, then re-run that script.\n\n';

/** Engine sources only: tests stay in the backend, which is where they run. */
const sources = readdirSync(SRC)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .sort();

const expected = new Map(
  sources.map((f) => [f, BANNER + readFileSync(join(SRC, f), 'utf8')]),
);

const check = process.argv.includes('--check');
const drifted = [];

if (!existsSync(DEST)) {
  if (check) {
    console.error('frontend/src/engine is missing entirely. Run: node scripts/sync-engine.mjs');
    process.exit(1);
  }
  mkdirSync(DEST, { recursive: true });
}

// Files the backend no longer has must not linger in the vendored copy.
for (const present of readdirSync(DEST).filter((f) => f.endsWith('.ts'))) {
  if (expected.has(present)) continue;
  drifted.push(`${present} (stale — no longer in the backend engine)`);
  if (!check) rmSync(join(DEST, present));
}

for (const [file, contents] of expected) {
  const target = join(DEST, file);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (current === contents) continue;
  drifted.push(current === null ? `${file} (missing)` : `${file} (out of date)`);
  if (!check) writeFileSync(target, contents);
}

if (check) {
  if (drifted.length === 0) {
    console.log(`frontend/src/engine is in sync (${sources.length} files).`);
    process.exit(0);
  }
  console.error('frontend/src/engine has drifted from backend/src/engine:');
  for (const d of drifted) console.error(`  - ${d}`);
  console.error('\nRun: node scripts/sync-engine.mjs');
  process.exit(1);
}

console.log(
  drifted.length === 0
    ? `frontend/src/engine already up to date (${sources.length} files).`
    : `Synced ${drifted.length} file(s) into frontend/src/engine:\n` +
        drifted.map((d) => `  - ${d}`).join('\n'),
);
