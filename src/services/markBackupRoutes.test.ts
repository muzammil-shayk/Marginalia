/**
 * Run with: npx tsx --test src/services/markBackupRoutes.test.ts
 *
 * The HTTP side of mark backups: list (time, mark count) and restore, on a temp store.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import express from 'express';
import router from './markBackupRoutes';
import { setStoreDirectory, saveDocument, updateDocument } from './documentStore';

let base = '';
let close: () => void = () => {};
let root = '';

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'marginalia-backup-routes-'));
  setStoreDirectory(root);
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  app.use((_req, res) => res.status(404).json({ fellThrough: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  close = () => server.close();
});

after(async () => {
  close();
  await fs.rm(root, { recursive: true, force: true });
});

test('GET backups lists them; POST restore puts one back and answers the restored marks', async () => {
  const { id } = await saveDocument({ title: 'B', text: 't', format: 'PDF' });
  await updateDocument(id, { annotations: [{ id: 'a', page: 1 }, { id: 'b', page: 1 }] });
  await updateDocument(id, { annotations: [{ id: 'c', page: 2 }] });
  const list = await (await fetch(`${base}/documents/${id}/backups`)).json();
  assert.equal(list.backups.length, 1);
  assert.equal(list.backups[0].markCount, 2);

  const res = await fetch(`${base}/documents/${id}/backups/${list.backups[0].id}/restore`, { method: 'POST' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.annotations.map((a: { id: string }) => a.id), ['a', 'b']);
  assert.equal(body.meta.annotationCount, 2);
});

test('restore of a missing backup or document is a 404', async () => {
  const { id } = await saveDocument({ title: 'B', text: 't', format: 'PDF' });
  for (const url of [`${base}/documents/${id}/backups/1700000000000/restore`, `${base}/documents/${'0'.repeat(32)}/backups/1700000000000/restore`]) {
    const res = await fetch(url, { method: 'POST' });
    assert.equal(res.status, 404);
    assert.equal(typeof (await res.json()).error, 'string', 'answered by the route, not the fall-through');
  }
});

test('an unrelated /api route falls through the router', async () => {
  const res = await fetch(`${base}/health`);
  assert.deepEqual(await res.json(), { fellThrough: true });
});

test('POST checkpoint keeps the live marks once; a repeat keeps nothing', async () => {
  const { id } = await saveDocument({ title: 'B', text: 't', format: 'PDF' });
  await updateDocument(id, { annotations: [{ id: 'a', page: 1 }] });
  const first = await fetch(`${base}/documents/${id}/backups/checkpoint`, { method: 'POST' });
  assert.deepEqual(await first.json(), { kept: true });
  const again = await fetch(`${base}/documents/${id}/backups/checkpoint`, { method: 'POST' });
  assert.deepEqual(await again.json(), { kept: false });
});
