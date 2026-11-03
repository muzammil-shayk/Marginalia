/**
 * Run with: npx tsx --test src/services/libraryRoutes.test.ts
 *
 * Motif tracing across the library, and a class pack made from one document and opened as a new
 * one, original file and marks included, on a temp store.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import express from 'express';
import router from './libraryRoutes';
import { attachOriginal, getDocument, getOriginal, saveDocument, saveSettings, setStoreDirectory, updateDocument } from './documentStore';

let base = '';
let close: () => void = () => {};
let root = '';

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'marginalia-library-routes-'));
  setStoreDirectory(root);
  const app = express();
  app.use(express.json({ limit: '200mb' }));
  app.use('/api', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  close = () => server.close();
});

after(async () => {
  close();
  await fs.rm(root, { recursive: true, force: true });
});

const post = (url: string, body: unknown) =>
  fetch(`${base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('a motif is traced by paragraph in text and by page in PDFs, documents without it left out', async () => {
  const odes = await saveDocument({ title: 'Odes', text: 'The moon rose.\n\nNo light.\n\nMoons again, and the moon.', format: 'TXT' });
  const book = await saveDocument({ title: 'Book', text: 'page one\n\n\n\npage three has a moon', format: 'PDF' });
  await saveDocument({ title: 'Prose', text: 'Nothing here.', format: 'TXT' });
  const res = await post('/motifs/trace', { terms: ['moon'] });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 4);
  assert.deepEqual(body.results.map((r: { id: string }) => r.id), [odes.id, book.id]);
  assert.deepEqual(body.results[0].hits.map((h: { paragraphIndex: number }) => h.paragraphIndex), [0, 2, 2]);
  assert.equal(body.results[1].location, 'page');
  assert.equal(body.results[1].hits[0].paragraphIndex, 2);

  const only = await (await post('/motifs/trace', { terms: ['moon'], docIds: [book.id] })).json();
  assert.deepEqual(only.results.map((r: { id: string }) => r.id), [book.id]);
  assert.equal((await post('/motifs/trace', { terms: ['  '] })).status, 400);
});

test('a class pack carries the document, its original and marks, and opens as a new document', async () => {
  await saveSettings({ name: 'Ms Raza', activeThemes: [{ id: 't1', name: 'Nature', color: '#aa0000' }] } as never);
  const src = await saveDocument({ title: 'Poem', text: 'Moon over water', format: 'PDF', filename: 'poem.pdf' });
  await attachOriginal(src.id, Buffer.from('%PDF-1.4 test'), 'poem.pdf');
  await updateDocument(src.id, { annotations: [{ id: 'm1', kind: 'highlight', page: 1, rects: [{ x: 0, y: 0, w: 0.1, h: 0.1 }], themeId: 't1' }] });

  const packRes = await fetch(`${base}/documents/${src.id}/class-pack?message=${encodeURIComponent('Read it twice')}`);
  assert.equal(packRes.status, 200);
  const pack = await packRes.json();
  assert.equal(pack.teacher, 'Ms Raza');
  assert.equal(pack.message, 'Read it twice');
  assert.deepEqual(pack.themes.map((t: { id: string }) => t.id), ['t1']);

  const opened = await (await post('/class-packs', pack)).json();
  assert.notEqual(opened.meta.id, src.id);
  assert.equal(opened.marks, 1);
  assert.equal(opened.teacher, 'Ms Raza');
  const doc = await getDocument(opened.meta.id);
  assert.equal(doc?.title, 'Poem');
  assert.equal(doc?.annotations[0].author, 'Ms Raza');
  assert.equal((await getOriginal(opened.meta.id))?.buffer.toString(), '%PDF-1.4 test');

  const bad = await post('/class-packs', { format: 'something else' });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /not a Marginalia class pack/);
  assert.equal((await fetch(`${base}/documents/nope/class-pack`)).status, 404);
});
