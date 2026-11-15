/**
 * Run with: npx tsx --test electron/linkPolicy.test.ts
 * Which links the app window hands to the OS, and which navigations it keeps.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const { isSafeExternalUrl, isAppNavigation } = createRequire(import.meta.url)('./linkPolicy.cjs');

test('http(s) links go to the browser; other schemes do not', () => {
  assert.equal(isSafeExternalUrl('https://example.com/a?b=c'), true);
  assert.equal(isSafeExternalUrl('http://example.com'), true);
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'smb://host/share', 'not a url', '']) {
    assert.equal(isSafeExternalUrl(url), false, url);
  }
});

test('mailto only to the feedback address, alone, with at most the subject and body Send feedback fills in', () => {
  assert.equal(isSafeExternalUrl('mailto:marginaliaannotator@gmail.com'), true);
  assert.equal(isSafeExternalUrl('mailto:MarginaliaAnnotator@gmail.com'), true);
  assert.equal(isSafeExternalUrl('mailto:marginaliaannotator@gmail.com?subject=Marginalia%20feedback&body=Hi%0A2.9.0'), true);
  for (const url of [
    'mailto:marginaliaannotator@gmail.com?cc=someone@example.com',
    'mailto:marginaliaannotator@gmail.com?bcc=someone@example.com',
    'mailto:marginaliaannotator@gmail.com?subject=Hi&to=someone@example.com',
    'mailto:marginaliaannotator@gmail.com?subject=Hi&attach=/etc/passwd',
    'mailto:marginaliaannotator@gmail.com?subject=Hi&CC=someone@example.com',
    'mailto:marginaliaannotator@gmail.com,someone@example.com',
    'mailto:someone@example.com',
    'mailto:%E0%A4%A'
  ]) {
    assert.equal(isSafeExternalUrl(url), false, url);
  }
});

test('navigation stays only on the app itself; an unparseable URL is not the app', () => {
  assert.equal(isAppNavigation('http://127.0.0.1:4321/reader', 4321), true);
  assert.equal(isAppNavigation('http://127.0.0.1:9999/', 4321), false);
  assert.equal(isAppNavigation('https://example.com/', 4321), false);
  assert.equal(isAppNavigation('::not a url::', 4321), false);
});
