/**
 * Run with: npx tsx --test electron/renderTemp.test.ts
 * The temp file an HTML export is printed from: its own private folder, never an existing file.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const { writeRenderTemp } = createRequire(import.meta.url)('./renderTemp.cjs');

test('each export gets its own private folder, removed afterwards', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'marginalia-render-test-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const a = await writeRenderTemp(base, '<p>a</p>');
  const b = await writeRenderTemp(base, '<p>b</p>');
  assert.notEqual(path.dirname(a.file), path.dirname(b.file));
  assert.equal(path.dirname(path.dirname(a.file)), base);
  assert.equal(await fs.readFile(a.file, 'utf-8'), '<p>a</p>');
  if (process.platform !== 'win32') assert.equal((await fs.stat(path.dirname(a.file))).mode & 0o077, 0, 'no one else can read or swap it');
  await a.dispose();
  await assert.rejects(fs.access(path.dirname(a.file)));
  await fs.access(b.file);
  await b.dispose();
});
