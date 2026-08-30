/**
 * Minimal .env loader — no dependency, because the backend has exactly one and
 * it is not going to be dotenv.
 *
 * Real environment variables always win: a value already present in
 * process.env is never overwritten. That is what makes the same image work
 * locally (values from the file) and on Dokploy (values injected by the
 * platform, with no file present at all).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Strips wrapping quotes, but only a matched pair. */
function unquote(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  if ((first === '"' || first === "'") && trimmed.endsWith(first) && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseEnv(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    out[key] = unquote(withoutExport.slice(eq + 1));
  }
  return out;
}

/**
 * Loads the first .env found, without overriding anything already set.
 * Returns the names (never the values) of the keys it applied.
 */
export function loadEnv(paths: string[] = defaultEnvPaths()): string[] {
  const applied: string[] = [];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
        applied.push(key);
      }
    }
    break; // first file wins
  }
  return applied;
}

export function defaultEnvPaths(): string[] {
  return [
    process.env.ENV_FILE,
    resolve(here, '../.env'), // backend/.env
    resolve(here, '../../.env'), // repo root .env
    resolve(process.cwd(), '.env'),
  ].filter((p): p is string => Boolean(p));
}
