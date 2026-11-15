/**
 * Run with: npx tsx --test server.test.ts
 *
 * The real server app on a temp store: security headers on every response, the inline original
 * served so it can never run as a page, mark colours checked on save, and per-route body limits
 * that actually apply.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';

let base = '';
let root = '';
let close: () => void = () => {};
let store: typeof import('./src/services/documentStore');

const CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' data: blob:; " +
  "style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'marginalia-server-'));
  process.env.MARGINALIA_EMBEDDED = '1';
  process.env.NODE_ENV = 'production';
  const server = await import('./server');
  store = await import('./src/services/documentStore');
  store.setStoreDirectory(root);
  const listening = server.app.listen(0, '127.0.0.1');
  await new Promise((r) => listening.once('listening', r));
  base = `http://127.0.0.1:${(listening.address() as AddressInfo).port}`;
  close = () => listening.close();
});

after(async () => {
  close();
  await fs.rm(root, { recursive: true, force: true });
});

const json = (method: string, url: string, body: unknown) =>
  fetch(`${base}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('every response carries the Content-Security-Policy', async () => {
  for (const url of ['/api/health', '/api/documents/nope', '/api/storage']) {
    const res = await fetch(`${base}${url}`);
    assert.equal(res.headers.get('content-security-policy'), CSP, url);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', url);
  }
});

test('the inline original is served sandboxed and never sniffed, so an HTML original cannot run as the app', async () => {
  const meta = await store.saveDocument({ title: 'Page', text: 'x', format: 'HTML', filename: 'page.html' });
  await store.attachOriginal(meta.id, Buffer.from('<script>alert(1)</script>'), 'page.html');
  const res = await fetch(`${base}/api/documents/${meta.id}/original?disposition=inline`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('content-security-policy'), 'sandbox');
});

test('PUT annotations stores a mark with a url() colour without that colour', async () => {
  const meta = await store.saveDocument({ title: 'Doc', text: 'words', format: 'PDF', filename: 'd.pdf' });
  const res = await json('PUT', `/api/documents/${meta.id}/annotations`, {
    annotations: [
      { id: 'a', kind: 'highlight', page: 1, color: 'url(https://example.com/beacon.png)', quote: 'q' },
      { id: 'b', kind: 'highlight', page: 1, color: '#ffd400' }
    ]
  });
  assert.equal(res.status, 200);
  const doc = await store.getDocument(meta.id);
  assert.deepEqual(doc!.annotations.map((a) => [a.id, a.color]), [['a', undefined], ['b', '#ffd400']]);
  assert.equal(doc!.annotations[0].quote, 'q');
});

test('per-route body limits apply: annotations stop at 25 MB, documents take 30 MB, HTML import takes 60 MB', async () => {
  const meta = await store.saveDocument({ title: 'Big', text: 'words', format: 'TXT' });
  const big = (mb: number) => 'x'.repeat(mb * 1024 * 1024);
  const marks = await json('PUT', `/api/documents/${meta.id}/annotations`, { annotations: [{ id: 'a', kind: 'note', page: 1, text: big(26) }] });
  assert.equal(marks.status, 413);
  const doc = await json('POST', '/api/documents', { title: 'Long', text: big(30), format: 'TXT' });
  assert.equal(doc.status, 200);
  // No renderer outside the desktop app: 501 means the 60 MB body was read, not refused.
  const html = await json('POST', '/api/documents/from-html', { title: 'H', text: 'words', html: big(60) });
  assert.equal(html.status, 501);
});

test('routes without a large limit refuse a body over the small default', async () => {
  const meta = await store.saveDocument({ title: 'Small', text: 'words', format: 'TXT' });
  const res = await json('PATCH', `/api/documents/${meta.id}`, { title: 'x'.repeat(6 * 1024 * 1024) });
  assert.equal(res.status, 413);
});

test('ordinary JSON routes still read their bodies', async () => {
  const meta = await store.saveDocument({ title: 'Plain', text: 'one\n\ntwo', format: 'TXT' });
  assert.equal((await json('PATCH', `/api/documents/${meta.id}`, { title: 'Renamed' })).status, 200);
  assert.equal((await json('PUT', `/api/documents/${meta.id}/progress`, { position: 1, total: 2 })).status, 200);
  assert.equal((await json('PUT', `/api/documents/${meta.id}/reading-state`, { readingState: { scale: 1, page: 1, viewMode: 'single' } })).status, 200);
  assert.equal((await json('PUT', '/api/settings', { settings: { name: 'Reader' } })).status, 200);
  assert.equal((await json('POST', '/api/motifs/trace', { terms: ['two'] })).status, 200);
  assert.equal((await store.getDocument(meta.id))!.title, 'Renamed');
});
