/**
 * Run with: npx tsx --test src/utils/feedback.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEEDBACK_EMAIL, feedbackMailto } from './feedback';

test('a mail to the feedback address with the version and platform', () => {
  const url = new URL(feedbackMailto({ version: '2.7.0', platform: 'win32' }));
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, FEEDBACK_EMAIL);
  assert.equal(url.searchParams.get('subject'), 'Marginalia 2.7.0 feedback');
  assert.match(url.searchParams.get('body')!, /Marginalia 2\.7\.0 on Windows$/);
});

test('no platform, no platform line', () => {
  const body = new URL(feedbackMailto({ version: '2.7.0' })).searchParams.get('body')!;
  assert.match(body, /Marginalia 2\.7\.0$/);
});
