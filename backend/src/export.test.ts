import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveDatasetPath } from './dataset.js';

const here = dirname(fileURLToPath(import.meta.url));
const EXPORT_JS = resolve(here, 'export.js');
const REAL_DATA = resolveDatasetPath();

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(full.slice(base.length + 1));
  }
  return out.sort();
}

describe('export determinism (AC6)', () => {
  test('two consecutive runs produce byte-identical output', () => {
    const dirA = mkdtempSync(join(tmpdir(), 'p08-export-a-'));
    const dirB = mkdtempSync(join(tmpdir(), 'p08-export-b-'));
    try {
      execFileSync(process.execPath, [EXPORT_JS], {
        env: { ...process.env, DATA_FILE: REAL_DATA, OUT_DIR: dirA },
      });
      execFileSync(process.execPath, [EXPORT_JS], {
        env: { ...process.env, DATA_FILE: REAL_DATA, OUT_DIR: dirB },
      });

      const filesA = walk(dirA);
      const filesB = walk(dirB);
      assert.deepEqual(filesA, filesB, 'the same set of files was written both times');

      for (const rel of filesA) {
        const a = readFileSync(join(dirA, rel));
        const b = readFileSync(join(dirB, rel));
        assert.ok(a.equals(b), `${rel} differs between runs`);
      }
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  test('writes the expected per-case artifacts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p08-export-c-'));
    try {
      execFileSync(process.execPath, [EXPORT_JS], {
        env: { ...process.env, DATA_FILE: REAL_DATA, OUT_DIR: dir },
      });
      const files = walk(dir);
      assert.ok(files.includes('P08_results.json'));
      assert.ok(files.includes('PUB-01/results.json'));
      assert.ok(files.includes('PUB-01/traces.txt'));
      assert.ok(files.includes('PUB-01/checklist-optional.csv'));
      assert.ok(files.includes('PUB-01/checklist-practical-fail.csv'));
      assert.ok(files.includes('PUB-01/checklist-absent.csv'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
