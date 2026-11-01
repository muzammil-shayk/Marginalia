/**
 * Run with: npx tsx --test src/utils/markBackupsClient.test.ts
 *
 * Client calls for mark backups. A failed request answers null (not an empty list), so the UI can
 * tell "no backups" from "could not read them".
 */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchMarkBackups, restoreMarkBackup, checkpointMarkBackup } from './documentStorage';

const realFetch = globalThis.fetch;
afterEach(() => (globalThis.fetch = realFetch));
const calls: { url: string; method?: string }[] = [];
function fakeFetch(status: number, body: unknown) {
  calls.length = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

test('fetchMarkBackups answers the list', async () => {
  fakeFetch(200, { backups: [{ id: '1700000000000', savedAt: '2023-11-14T22:13:20.000Z', markCount: 3 }] });
  assert.deepEqual(await fetchMarkBackups('abc'), [{ id: '1700000000000', savedAt: '2023-11-14T22:13:20.000Z', markCount: 3 }]);
  assert.equal(calls[0].url, '/api/documents/abc/backups');
});

test('fetchMarkBackups answers null on failure', async () => {
  fakeFetch(500, {});
  assert.equal(await fetchMarkBackups('abc'), null);
  globalThis.fetch = (async () => { throw new Error('down'); }) as typeof fetch;
  assert.equal(await fetchMarkBackups('abc'), null);
});

test('restoreMarkBackup POSTs and answers the restored marks; null on failure', async () => {
  fakeFetch(200, { meta: { id: 'abc' }, annotations: [{ id: 'a' }] });
  assert.deepEqual(await restoreMarkBackup('abc', '1700000000000'), [{ id: 'a' }]);
  assert.deepEqual(calls[0], { url: '/api/documents/abc/backups/1700000000000/restore', method: 'POST' });
  fakeFetch(404, { error: 'x' });
  assert.equal(await restoreMarkBackup('abc', '1'), null);
});

test('checkpointMarkBackup POSTs with keepalive (survives the page closing) and never throws', async () => {
  let init: RequestInit | undefined;
  let url = '';
  globalThis.fetch = (async (u: string, i?: RequestInit) => ((url = u), (init = i), new Response('{"kept":true}'))) as typeof fetch;
  assert.equal(await checkpointMarkBackup('abc'), true);
  assert.equal(url, '/api/documents/abc/backups/checkpoint');
  assert.equal(init?.method, 'POST');
  assert.equal(init?.keepalive, true);
  globalThis.fetch = (async () => { throw new Error('down'); }) as typeof fetch;
  assert.equal(await checkpointMarkBackup('abc'), false);
});
