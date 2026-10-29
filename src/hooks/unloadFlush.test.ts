/**
 * Run with: npx tsx --test src/hooks/unloadFlush.test.ts
 *
 * Quitting, closing or reloading inside the 700 ms autosave window used to lose the last edits.
 * On `beforeunload` every pending save is sent as a keepalive request (it outlives the page);
 * when they are too big for the browser's keepalive budget, the unload is cancelled once and the
 * saves run normally instead.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDebouncedSaver } from './debouncedSaver';
import { flushAllPending, handleBeforeUnload, registerUnloadFlush, UnloadRequest } from './unloadFlush';

function fakeEvent() {
  return {
    prevented: false,
    returnValue: undefined as unknown,
    preventDefault() {
      this.prevented = true;
    }
  };
}

const toRequest = (id: string) => (marks: string) => ({ url: `/api/documents/${id}/annotations`, body: marks });

test('on unload a small pending save goes out as a keepalive request and the unload proceeds', () => {
  const writes: string[] = [];
  const saver = createDebouncedSaver({ save: async (v: string) => (writes.push(v), true), delayMs: 700 });
  const off = registerUnloadFlush(saver, toRequest('doc-a'));
  try {
    saver.schedule('{"annotations":[1]}');
    const sent: UnloadRequest[] = [];
    const event = fakeEvent();
    const cancelled = handleBeforeUnload(event, (r) => sent.push(r));
    assert.equal(cancelled, false);
    assert.equal(event.prevented, false);
    assert.deepEqual(sent, [{ url: '/api/documents/doc-a/annotations', body: '{"annotations":[1]}' }]);
    assert.equal(saver.pending(), null, 'sent value is no longer pending');
  } finally {
    off();
  }
});

test('nothing pending means nothing is sent and the unload proceeds', () => {
  const saver = createDebouncedSaver({ save: async () => true, delayMs: 700 });
  const off = registerUnloadFlush(saver, toRequest('doc-a'));
  try {
    const sent: UnloadRequest[] = [];
    assert.equal(handleBeforeUnload(fakeEvent(), (r) => sent.push(r)), false);
    assert.deepEqual(sent, []);
  } finally {
    off();
  }
});

test('pending saves over the keepalive budget cancel the unload and are saved normally', async () => {
  const writes: string[] = [];
  const saver = createDebouncedSaver({ save: async (v: string) => (writes.push(v), true), delayMs: 700 });
  const off = registerUnloadFlush(saver, toRequest('doc-big'));
  try {
    const big = 'x'.repeat(70_000);
    saver.schedule(big);
    const sent: UnloadRequest[] = [];
    const event = fakeEvent();
    assert.equal(handleBeforeUnload(event, (r) => sent.push(r)), true);
    assert.equal(event.prevented, true);
    assert.deepEqual(sent, []);
    await flushAllPending();
    assert.deepEqual(writes, [big]);
  } finally {
    off();
  }
});

test('a paused saver (mid page operation) sends nothing on unload', () => {
  const saver = createDebouncedSaver({ save: async () => true, delayMs: 700 });
  const off = registerUnloadFlush(saver, toRequest('doc-a'));
  try {
    saver.pause();
    saver.schedule('pre-shift marks');
    const sent: UnloadRequest[] = [];
    assert.equal(handleBeforeUnload(fakeEvent(), (r) => sent.push(r)), false);
    assert.deepEqual(sent, []);
  } finally {
    off();
  }
});

test('flushAllPending writes every registered saver and reports success', async () => {
  const writes: string[] = [];
  const a = createDebouncedSaver({ save: async (v: string) => (writes.push(v), true), delayMs: 700 });
  const b = createDebouncedSaver({ save: async (v: string) => (writes.push(v), true), delayMs: 700 });
  const offA = registerUnloadFlush(a, toRequest('a'));
  const offB = registerUnloadFlush(b, toRequest('b'));
  try {
    a.schedule('pdf marks');
    b.schedule('text notes');
    assert.equal(await flushAllPending(), true);
    assert.deepEqual(writes.sort(), ['pdf marks', 'text notes']);
  } finally {
    offA();
    offB();
  }
});

test('an unregistered saver is left alone', async () => {
  const writes: string[] = [];
  const saver = createDebouncedSaver({ save: async (v: string) => (writes.push(v), true), delayMs: 700 });
  registerUnloadFlush(saver, toRequest('a'))();
  saver.schedule('x');
  await flushAllPending();
  assert.deepEqual(writes, []);
});

test('second call lets the unload through: a save that keeps failing cannot block closing forever', async () => {
  const saver = createDebouncedSaver({ save: async () => false, delayMs: 700 });
  const off = registerUnloadFlush(saver, toRequest('doc-failing'));
  try {
    saver.schedule('y'.repeat(70_000));
    handleBeforeUnload(fakeEvent(), () => {}); // may cancel (at most once per page lifetime)
    await flushAllPending(); // fails
    saver.schedule('y'.repeat(70_001)); // still too big for keepalive, still unsaved
    const second = fakeEvent();
    assert.equal(handleBeforeUnload(second, () => {}), false);
    assert.equal(second.prevented, false);
  } finally {
    off();
  }
});
