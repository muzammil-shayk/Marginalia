/**
 * Run with: npx tsx --test src/services/geminiConfig.test.ts
 *
 * What is left of the Gemini router after thematic analysis was removed (2.5.0): the key
 * settings, behind the AI opt-in. The analysis routes are gone, and stored analyses on disk are
 * left alone (see localBackend.test.ts).
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import express from 'express';
import router from './geminiConfig';
import { setAiEnabled } from './aiGate';
import { setStoreDirectory } from './documentStore';

let base = '';
let close: () => void = () => {};
let root = '';

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'marginalia-gemini-test-'));
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
  setAiEnabled(false);
  await fs.rm(root, { recursive: true, force: true });
});

test('with AI off, the key settings are refused and nothing is written', async () => {
  setAiEnabled(false);
  assert.equal((await fetch(`${base}/gemini-config`)).status, 403);
  const put = await fetch(`${base}/gemini-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: 'k' })
  });
  assert.equal(put.status, 403);
  await assert.rejects(fs.stat(path.join(root, 'settings.json')));
});

test('with AI on, the key settings answer without ever returning the key', async () => {
  setAiEnabled(true);
  await fetch(`${base}/gemini-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: 'secret-key' })
  });
  const body = await (await fetch(`${base}/gemini-config`)).json();
  assert.equal(body.configured, true);
  assert.equal(JSON.stringify(body).includes('secret-key'), false);
});

test('the gate does not touch other API routes', async () => {
  setAiEnabled(false);
  const res = await fetch(`${base}/documents`);
  assert.deepEqual(await res.json(), { fellThrough: true });
});

test('the thematic analysis routes are gone, whatever the setting', async () => {
  setAiEnabled(true);
  const id = 'a'.repeat(32);
  for (const [method, url] of [
    ['POST', `/documents/${id}/analysis`],
    ['GET', `/documents/${id}/analysis`],
    ['GET', `/documents/${id}/book-metadata`],
    ['POST', '/analyze-from-web']
  ]) {
    const res = await fetch(`${base}${url}`, { method });
    assert.deepEqual(await res.json(), { fellThrough: true }, `${method} ${url}`);
  }
});
