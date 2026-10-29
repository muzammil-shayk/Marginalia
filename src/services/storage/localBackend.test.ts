/**
 * Run with: npx tsx --test src/services/storage/localBackend.test.ts
 *
 * Every test works on its own temp store; the real library is never touched.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { LocalDocumentBackend } from './localBackend';
import type { StoredAnnotation } from './types';

async function tempStore(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'marginalia-store-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, backend: new LocalDocumentBackend(root) };
}

async function makeDoc(backend: LocalDocumentBackend, bytes = Buffer.from('%PDF-old')) {
  const meta = await backend.saveDocument({ title: 'Book', text: 'Some text', format: 'PDF', filename: 'book.pdf' });
  assert.equal(await backend.attachOriginal(meta.id, bytes, 'book.pdf'), true);
  return meta.id;
}

const mark = (id: string, page: number): StoredAnnotation => ({ id, page } as StoredAnnotation);

// ── Item 8: corrupt records ──────────────────────────────────────────────────

test('a record write keeps the previous version as {id}.json.bak', async (t) => {
  const { root, backend } = await tempStore(t);
  const id = await makeDoc(backend);
  await backend.updateDocument(id, { title: 'Renamed' });
  const bak = JSON.parse(await fs.readFile(path.join(root, 'documents', `${id}.json.bak`), 'utf-8'));
  assert.equal(bak.title, 'Book');
});

test('a corrupt record falls back to its .bak and stays listed', async (t) => {
  const { root, backend } = await tempStore(t);
  const id = await makeDoc(backend);
  await backend.updateDocument(id, { title: 'Renamed' });
  await fs.writeFile(path.join(root, 'documents', `${id}.json`), '{"title": "Ren');
  t.mock.method(console, 'error', () => {});
  assert.equal((await backend.getDocument(id))?.title, 'Book');
  assert.deepEqual((await backend.listDocuments()).map((d) => d.id), [id]);
});

test('a corrupt record with no usable .bak is logged and quarantined to .corrupt', async (t) => {
  const { root, backend } = await tempStore(t);
  const id = await makeDoc(backend);
  const docs = path.join(root, 'documents');
  await fs.rm(path.join(docs, `${id}.json.bak`), { force: true });
  await fs.writeFile(path.join(docs, `${id}.json`), 'not json');
  const errors = t.mock.method(console, 'error', () => {});
  assert.equal(await backend.getDocument(id), null);
  // Timestamped name (`.json.corrupt-<time>`) so a later corruption cannot overwrite it.
  const [quarantined] = (await fs.readdir(docs)).filter((n) => n.startsWith(`${id}.json.corrupt`));
  assert.equal(await fs.readFile(path.join(docs, quarantined), 'utf-8'), 'not json');
  await assert.rejects(fs.access(path.join(docs, `${id}.json`)));
  assert.ok(errors.mock.callCount() >= 1);
});

test('the sweeper keeps an original whose record is only a .bak or a .corrupt file', async (t) => {
  const { root, backend } = await tempStore(t);
  const docs = path.join(root, 'documents');
  const onlyBak = await makeDoc(backend);
  const onlyCorrupt = await makeDoc(backend);
  await fs.rename(path.join(docs, `${onlyBak}.json`), path.join(docs, `${onlyBak}.json.bak`));
  await fs.rename(path.join(docs, `${onlyCorrupt}.json`), path.join(docs, `${onlyCorrupt}.json.corrupt`));
  await backend.sweepExpiredDocuments();
  await fs.access(path.join(root, 'originals', `${onlyBak}.pdf`));
  await fs.access(path.join(root, 'originals', `${onlyCorrupt}.pdf`));
});

// ── Item 1: originals are never overwritten in place ─────────────────────────

test('attachOriginal replaces the file by rename, not by writing into it', async (t) => {
  const { root, backend } = await tempStore(t);
  const id = await makeDoc(backend);
  const file = path.join(root, 'originals', `${id}.pdf`);
  const before = (await fs.stat(file)).ino;
  await backend.attachOriginal(id, Buffer.from('%PDF-new'), 'book.pdf');
  assert.notEqual((await fs.stat(file)).ino, before);
  assert.equal(await fs.readFile(file, 'utf-8'), '%PDF-new');
});

test('a page edit swaps the original by rename and keeps the old bytes as {id}.prev', async (t) => {
  const { root, backend } = await tempStore(t);
  const id = await makeDoc(backend);
  const file = path.join(root, 'originals', `${id}.pdf`);
  const before = (await fs.stat(file)).ino;
  const result = await backend.editPdfPages(id, async ({ annotations }) => ({
    pdf: Buffer.from('%PDF-edited'),
    annotations,
    result: 'ok'
  }));
  assert.equal(result, 'ok');
  assert.notEqual((await fs.stat(file)).ino, before);
  assert.equal(await fs.readFile(file, 'utf-8'), '%PDF-edited');
  assert.equal(await fs.readFile(path.join(root, 'originals', `${id}.prev`), 'utf-8'), '%PDF-old');
  assert.deepEqual((await fs.readdir(path.join(root, 'originals'))).sort(), [`${id}.pdf`, `${id}.prev`].sort());
  assert.equal((await backend.getOriginal(id))?.filename, 'book.pdf');
});

test('a page edit returns null for a document that does not exist', async (t) => {
  const { backend } = await tempStore(t);
  const result = await backend.editPdfPages('a'.repeat(32), async ({ annotations }) => ({
    pdf: Buffer.from('x'),
    annotations,
    result: 'ok'
  }));
  assert.equal(result, null);
});

// ── Item 2: marks and PDF change together ────────────────────────────────────

test('a page edit reads the marks inside the lock, after a write queued before it', async (t) => {
  const { backend } = await tempStore(t);
  const id = await makeDoc(backend);
  void backend.updateDocument(id, { annotations: [mark('a', 1), mark('b', 2)] });
  let seen: string[] = [];
  await backend.editPdfPages(id, async ({ annotations }) => {
    seen = annotations.map((a) => a.id);
    return { pdf: Buffer.from('%PDF-edited'), annotations: annotations.map((a) => ({ ...a, page: (a.page as number) + 1 })), result: 1 };
  });
  assert.deepEqual(seen, ['a', 'b']);
  assert.deepEqual((await backend.getDocument(id))?.annotations.map((a) => a.page), [2, 3]);
});

test('a crash during the PDF swap rolls forward to the new PDF and the new marks', async (t) => {
  const { root, backend } = await tempStore(t);
  const id = await makeDoc(backend);
  await backend.updateDocument(id, { annotations: [mark('a', 1)] });
  const realRename = fs.rename;
  const rename = t.mock.method(fs, 'rename', async (from: string, to: string) => {
    if (String(from).endsWith(`${id}.next`)) throw new Error('simulated crash');
    return realRename(from, to);
  });
  await assert.rejects(
    backend.editPdfPages(id, async ({ annotations }) => ({
      pdf: Buffer.from('%PDF-edited'),
      annotations: annotations.map((a) => ({ ...a, page: (a.page as number) + 1 })),
      result: 1
    }))
  );
  rename.mock.restore();

  const restarted = new LocalDocumentBackend(root);
  assert.equal((await restarted.getOriginal(id))?.buffer.toString(), '%PDF-edited');
  assert.deepEqual((await restarted.getDocument(id))?.annotations.map((a) => a.page), [2]);
  assert.deepEqual((await fs.readdir(path.join(root, 'originals'))).sort(), [`${id}.pdf`, `${id}.prev`].sort());
});

test('a crash before the marks are committed keeps the old PDF and the old marks', async (t) => {
  const { root, backend } = await tempStore(t);
  const id = await makeDoc(backend);
  await backend.updateDocument(id, { annotations: [mark('a', 1)] });
  const realRename = fs.rename;
  const rename = t.mock.method(fs, 'rename', async (from: string, to: string) => {
    if (String(to).endsWith(`${id}.json`)) throw new Error('simulated crash');
    return realRename(from, to);
  });
  await assert.rejects(
    backend.editPdfPages(id, async ({ annotations }) => ({
      pdf: Buffer.from('%PDF-edited'),
      annotations: annotations.map((a) => ({ ...a, page: (a.page as number) + 1 })),
      result: 1
    }))
  );
  rename.mock.restore();

  const restarted = new LocalDocumentBackend(root);
  assert.equal((await restarted.getOriginal(id))?.buffer.toString(), '%PDF-old');
  assert.deepEqual((await restarted.getDocument(id))?.annotations.map((a) => a.page), [1]);
  assert.ok(!(await fs.readdir(path.join(root, 'originals'))).includes(`${id}.next`));
});

test('deleting a document removes its .bak, .corrupt and .prev files too', async (t) => {
  const { root, backend } = await tempStore(t);
  const id = await makeDoc(backend);
  await backend.editPdfPages(id, async ({ annotations }) => ({ pdf: Buffer.from('%PDF-e'), annotations, result: 1 }));
  await fs.writeFile(path.join(root, 'documents', `${id}.json.corrupt`), 'x');
  await backend.deleteDocument(id);
  assert.deepEqual(await fs.readdir(path.join(root, 'documents')), []);
  assert.deepEqual(await fs.readdir(path.join(root, 'originals')), []);
});

// ── Item 4: settings ─────────────────────────────────────────────────────────

test('client settings merge into the stored ones and never change gemini fields', async (t) => {
  const { backend } = await tempStore(t);
  await backend.saveSettings({ geminiApiKey: 'secret', geminiModel: 'm1', userName: 'A', activeThemes: [1] });
  await backend.saveClientSettings({ userName: 'B', geminiApiKey: '', geminiModel: 'other' });
  assert.deepEqual(await backend.getSettings(), {
    geminiApiKey: 'secret',
    geminiModel: 'm1',
    userName: 'B',
    activeThemes: [1]
  });
});

test('settings are written by rename, leaving no temp file behind', async (t) => {
  const { root, backend } = await tempStore(t);
  await backend.saveSettings({ a: 1 });
  const file = path.join(root, 'settings.json');
  const before = (await fs.stat(file)).ino;
  await backend.saveClientSettings({ a: 2 });
  assert.notEqual((await fs.stat(file)).ino, before);
  assert.deepEqual((await fs.readdir(root)).filter((n) => n.startsWith('settings')), ['settings.json']);
});

test('settings sent to the renderer carry no gemini fields', async () => {
  const { publicSettings } = await import('./types');
  assert.deepEqual(publicSettings({ geminiApiKey: 'secret', geminiModel: 'm', userName: 'A' }), { userName: 'A' });
  assert.equal(publicSettings(null), null);
});

// ── Phase A review fixes: one locked settings writer, unique corrupt copies ───

test('a gemini key write merges into the stored settings instead of replacing them', async (t) => {
  const { backend } = await tempStore(t);
  await backend.saveClientSettings({ userName: 'A', activeThemes: [1] });
  await backend.saveSettings({ geminiApiKey: 'k' });
  assert.deepEqual(await backend.getSettings(), { userName: 'A', activeThemes: [1], geminiApiKey: 'k' });
});

test('a key write racing a client settings write keeps both', async (t) => {
  const { backend } = await tempStore(t);
  await backend.saveClientSettings({ userName: 'A' });
  await Promise.all([backend.saveSettings({ geminiApiKey: 'k' }), backend.saveClientSettings({ userName: 'B' })]);
  assert.deepEqual(await backend.getSettings(), { userName: 'B', geminiApiKey: 'k' });
});

test('a corrupt settings.json is backed up to .bad before the key write', async (t) => {
  const { backend, root } = await tempStore(t);
  await fs.writeFile(path.join(root, 'settings.json'), '{not json');
  await backend.saveSettings({ geminiApiKey: 'k' });
  const bad = (await fs.readdir(root)).filter((n) => n.startsWith('settings.json.bad'));
  assert.equal(bad.length, 1);
  assert.equal(await fs.readFile(path.join(root, bad[0]), 'utf-8'), '{not json');
  assert.deepEqual(await backend.getSettings(), { geminiApiKey: 'k' });
});

test('a second settings corruption keeps the first .bad copy', async (t) => {
  const { backend, root } = await tempStore(t);
  await fs.writeFile(path.join(root, 'settings.json'), 'first');
  await backend.saveClientSettings({ a: 1 });
  await new Promise((r) => setTimeout(r, 2));
  await fs.writeFile(path.join(root, 'settings.json'), 'second');
  await backend.saveClientSettings({ a: 2 });
  const bad = (await fs.readdir(root)).filter((n) => n.startsWith('settings.json.bad')).sort();
  const contents = await Promise.all(bad.map((n) => fs.readFile(path.join(root, n), 'utf-8')));
  assert.deepEqual(contents.sort(), ['first', 'second']);
});

test('a second record corruption keeps the first .corrupt copy, and delete removes both', async (t) => {
  const { backend, root } = await tempStore(t);
  const id = await makeDoc(backend);
  const docs = path.join(root, 'documents');
  const errors = t.mock.method(console, 'error', () => {});
  await fs.writeFile(path.join(docs, `${id}.json`), 'first');
  await backend.getDocument(id);
  await new Promise((r) => setTimeout(r, 2));
  await fs.writeFile(path.join(docs, `${id}.json`), 'second');
  await backend.getDocument(id);
  errors.mock.restore();
  const corrupt = (await fs.readdir(docs)).filter((n) => n.startsWith(`${id}.json.corrupt`));
  const contents = await Promise.all(corrupt.map((n) => fs.readFile(path.join(docs, n), 'utf-8')));
  assert.deepEqual(contents.sort(), ['first', 'second']);
  await backend.deleteDocument(id);
  assert.deepEqual((await fs.readdir(docs)).filter((n) => n.startsWith(id)), []);
});

test('the gemini filter ignores case, on the way out and on the way in', async (t) => {
  const { publicSettings } = await import('./types');
  assert.deepEqual(publicSettings({ GeminiApiKey: 'secret', GEMINI_MODEL: 'm', userName: 'A' }), { userName: 'A' });
  const { backend } = await tempStore(t);
  await backend.saveClientSettings({ GeminiApiKey: 'from-client', userName: 'A' });
  assert.deepEqual(await backend.getSettings(), { userName: 'A' });
});
