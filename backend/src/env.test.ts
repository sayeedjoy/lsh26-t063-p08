import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { loadEnv, parseEnv } from './env.js';

describe('parseEnv', () => {
  test('reads plain pairs and ignores comments and blank lines', () => {
    assert.deepEqual(
      parseEnv(['# a comment', '', 'FOO=bar', '  BAZ = qux  ', '# BAD=nope'].join('\n')),
      { FOO: 'bar', BAZ: 'qux' },
    );
  });

  test('strips a matched pair of quotes only', () => {
    const parsed = parseEnv(`A="quoted"\nB='single'\nC=un"matched\nD="`);
    assert.equal(parsed['A'], 'quoted');
    assert.equal(parsed['B'], 'single');
    assert.equal(parsed['C'], 'un"matched');
    assert.equal(parsed['D'], '"');
  });

  test('keeps = inside a value — connection strings contain them', () => {
    const url = 'postgres://u:p@h:5432/db?sslmode=require&x=1';
    assert.equal(parseEnv(`DATABASE_URL=${url}`)['DATABASE_URL'], url);
  });

  test('accepts an "export" prefix and rejects malformed keys', () => {
    const parsed = parseEnv('export FOO=bar\n1BAD=x\n=noKey\nOK_2=y');
    assert.deepEqual(parsed, { FOO: 'bar', OK_2: 'y' });
  });
});

describe('loadEnv', () => {
  test('applies file values but never overrides a real environment variable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p08-env-'));
    const file = join(dir, '.env');
    writeFileSync(file, 'P08_FROM_FILE=file-value\nP08_ALREADY_SET=file-value\n');
    process.env['P08_ALREADY_SET'] = 'real-value';
    try {
      const applied = loadEnv([file]);
      assert.equal(process.env['P08_FROM_FILE'], 'file-value');
      assert.equal(
        process.env['P08_ALREADY_SET'],
        'real-value',
        'the real environment must win — this is what makes Docker/Dokploy work',
      );
      assert.deepEqual(applied, ['P08_FROM_FILE'], 'reports only what it actually applied');
    } finally {
      delete process.env['P08_FROM_FILE'];
      delete process.env['P08_ALREADY_SET'];
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a missing file is not an error', () => {
    assert.deepEqual(loadEnv([join(tmpdir(), 'definitely-not-here', '.env')]), []);
  });
});
