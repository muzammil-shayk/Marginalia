/**
 * Run with: npx tsx --test electron/renderGuard.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';
import os from 'os';

const { isRenderRequestAllowed, guardRenderWindow } = createRequire(import.meta.url)('./renderGuard.cjs');

const tmpFile = path.join(os.tmpdir(), 'marginalia-export-1.html');
const tmpUrl = pathToFileURL(tmpFile).href;

test('the print window may load only its own temp file and data: URLs', () => {
  const allowed = new Set([tmpFile]);
  for (const url of [tmpUrl, 'data:image/png;base64,AA']) {
    assert.equal(isRenderRequestAllowed(url, allowed), true, url);
  }
  for (const url of [
    pathToFileURL(path.join(os.tmpdir(), 'marginalia-export-2.html')).href,
    pathToFileURL(path.join(os.homedir(), '.ssh', 'id_rsa')).href,
    'file:///etc/passwd',
    'https://evil.example/x.png',
    'http://127.0.0.1:3001/api/documents',
    'ws://evil.example',
    'ftp://evil.example/a',
    'blob:https://evil.example/1',
    'not a url'
  ]) {
    assert.equal(isRenderRequestAllowed(url, allowed), false, url);
  }
});

test('with no temp file registered, no file: URL is allowed', () => {
  assert.equal(isRenderRequestAllowed(tmpUrl, new Set()), false);
});

/** A fake BrowserWindow whose session is shared, as the render partition is. */
function fakeWindow(session: { webRequest: { onBeforeRequest(fn: unknown): void } }) {
  return {
    webContents: { on() {}, setWindowOpenHandler() {}, session }
  };
}

test('each render window allows only its own temp file, on a shared session, until released', () => {
  let handler!: (details: { url: string }, cb: (r: { cancel: boolean }) => void) => void;
  const session = { webRequest: { onBeforeRequest: (fn: typeof handler) => (handler = fn) } };
  const ask = (url: string) => {
    let cancel: boolean | undefined;
    handler({ url }, (r) => (cancel = r.cancel));
    return cancel === false;
  };
  const fileA = path.join(os.tmpdir(), 'marginalia-export-a.html');
  const fileB = path.join(os.tmpdir(), 'marginalia-export-b.html');
  const releaseA = guardRenderWindow(fakeWindow(session), fileA);
  const releaseB = guardRenderWindow(fakeWindow(session), fileB);
  assert.equal(ask(pathToFileURL(fileA).href), true);
  assert.equal(ask(pathToFileURL(fileB).href), true);
  assert.equal(ask('file:///etc/hosts'), false);
  releaseA();
  assert.equal(ask(pathToFileURL(fileA).href), false);
  assert.equal(ask(pathToFileURL(fileB).href), true);
  releaseB();
});
