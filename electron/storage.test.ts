/**
 * Run with: npx tsx --test electron/storage.test.ts
 * Temp folders only; never the real library.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const { tryMigrateLibrary } = createRequire(import.meta.url)('./storage.cjs');

async function library(t: { after: (fn: () => Promise<void>) => void }) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'marginalia-move-test-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const from = path.join(base, 'old');
  await fs.mkdir(path.join(from, 'documents'), { recursive: true });
  await fs.mkdir(path.join(from, 'originals'), { recursive: true });
  await fs.writeFile(path.join(from, 'documents', 'a.json'), '{}');
  await fs.writeFile(path.join(from, 'originals', 'a.pdf'), '%PDF');
  await fs.writeFile(path.join(from, 'settings.json'), '{"geminiApiKey":"k"}');
  return { base, from, to: path.join(base, 'new') };
}

test('moving the library takes settings.json along with the documents', async (t) => {
  const { from, to } = await library(t);
  const result = await tryMigrateLibrary(from, to);
  assert.deepEqual(result, { ok: true, moved: 3 });
  assert.equal(await fs.readFile(path.join(to, 'settings.json'), 'utf-8'), '{"geminiApiKey":"k"}');
  await fs.access(path.join(to, 'documents', 'a.json'));
  await fs.access(path.join(to, 'originals', 'a.pdf'));
  await assert.rejects(fs.access(path.join(from, 'documents')));
});

test('a failed copy reports the error and leaves the old library intact', async (t) => {
  const { from, to } = await library(t);
  await fs.mkdir(to, { recursive: true });
  await fs.writeFile(path.join(to, 'documents'), 'a file where the folder should go');
  const result = await tryMigrateLibrary(from, to);
  assert.equal(result.ok, false);
  assert.match(result.message, /\S/);
  await fs.access(path.join(from, 'documents', 'a.json'));
  await fs.access(path.join(from, 'originals', 'a.pdf'));
});
