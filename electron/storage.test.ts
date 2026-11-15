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

test('moving the library takes the mark backups (backups/{id}/{ms}.json) along', async (t) => {
  const { from, to } = await library(t);
  await fs.mkdir(path.join(from, 'backups', 'a'), { recursive: true });
  await fs.writeFile(path.join(from, 'backups', 'a', '1700000000000.json'), '{"annotations":[]}');
  const result = await tryMigrateLibrary(from, to);
  assert.deepEqual(result, { ok: true, moved: 4 });
  assert.equal(await fs.readFile(path.join(to, 'backups', 'a', '1700000000000.json'), 'utf-8'), '{"annotations":[]}');
  await assert.rejects(fs.access(path.join(from, 'backups')));
});

test('a different file already in the new folder is never overwritten: the move fails and nothing is removed', async (t) => {
  const { from, to } = await library(t);
  await fs.mkdir(path.join(to, 'documents'), { recursive: true });
  await fs.writeFile(path.join(to, 'documents', 'a.json'), '{"other":"library"}');
  const result = await tryMigrateLibrary(from, to);
  assert.equal(result.ok, false);
  assert.match(result.message, /a\.json/);
  assert.equal(await fs.readFile(path.join(to, 'documents', 'a.json'), 'utf-8'), '{"other":"library"}');
  await fs.access(path.join(from, 'documents', 'a.json'));
  await fs.access(path.join(from, 'originals', 'a.pdf'));
});

test('a different settings.json already in the new folder is not overwritten either', async (t) => {
  const { from, to } = await library(t);
  await fs.mkdir(to, { recursive: true });
  await fs.writeFile(path.join(to, 'settings.json'), '{"name":"other"}');
  const result = await tryMigrateLibrary(from, to);
  assert.equal(result.ok, false);
  assert.equal(await fs.readFile(path.join(to, 'settings.json'), 'utf-8'), '{"name":"other"}');
  await fs.access(path.join(from, 'documents', 'a.json'));
});

test('an identical file already in the new folder (an earlier, interrupted move) is fine', async (t) => {
  const { from, to } = await library(t);
  await fs.mkdir(path.join(to, 'documents'), { recursive: true });
  await fs.writeFile(path.join(to, 'documents', 'a.json'), '{}');
  const result = await tryMigrateLibrary(from, to);
  assert.equal(result.ok, true);
  await fs.access(path.join(to, 'originals', 'a.pdf'));
  await assert.rejects(fs.access(path.join(from, 'documents')));
});

test('a save to the old folder during the copy is carried over by the second pass', async (t) => {
  const { from, to } = await library(t);
  const realCopy = fs.copyFile;
  let saved = false;
  t.mock.method(fs, 'copyFile', async (src: string, dest: string, mode?: number) => {
    await realCopy(src, dest, mode);
    if (!saved && src.endsWith('a.json')) {
      saved = true;
      // The app autosaves while the move runs.
      await fs.writeFile(src, '{"annotations":[1]}');
      await fs.utimes(src, new Date(), new Date(Date.now() + 5000));
    }
  });
  const result = await tryMigrateLibrary(from, to);
  t.mock.restoreAll();
  assert.equal(result.ok, true);
  assert.equal(await fs.readFile(path.join(to, 'documents', 'a.json'), 'utf-8'), '{"annotations":[1]}');
});
