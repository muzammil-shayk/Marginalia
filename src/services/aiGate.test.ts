/**
 * Run with: npx tsx --test src/services/aiGate.test.ts
 *
 * With the AI opt-in off (the default) no AI route does anything: it answers 403 before any
 * handler runs, so no key is read and nothing is sent anywhere.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireAi, setAiEnabled, isAiEnabled } from './aiGate';

function call() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };
  let nextCalled = false;
  requireAi({} as never, res as never, () => (nextCalled = true));
  return { res, nextCalled };
}

test('AI is off until the desktop shell says otherwise', () => {
  assert.equal(isAiEnabled(), false);
  const { res, nextCalled } = call();
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'AI features are turned off in Settings.', aiDisabled: true });
});

test('turned on, AI routes run; turned off again, they are refused again', () => {
  setAiEnabled(true);
  assert.equal(call().nextCalled, true);
  setAiEnabled(false);
  assert.equal(call().nextCalled, false);
});

test('only a real true turns it on', () => {
  setAiEnabled('yes' as never);
  assert.equal(isAiEnabled(), false);
});
