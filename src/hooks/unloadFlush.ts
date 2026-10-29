/**
 * Saves pending autosaves when the window goes away (close, reload, quit).
 *
 * Every autosave registers its saver here. On `beforeunload`, pending values are sent as
 * `keepalive` PUTs to the same endpoints the normal saves use: a keepalive request outlives the
 * page. Chromium caps in-flight keepalive bodies at 64 KiB per page, so when the pending saves
 * are bigger than that the unload is cancelled once (Electron cancels silently, no dialog) and
 * the saves run as ordinary requests; the next close/reload/quit then finds nothing pending.
 * Only the first such unload is cancelled: if those saves fail, later unloads go through (best
 * effort keepalive). Electron's main process also ignores renderer unload cancels altogether
 * (`will-prevent-unload` in main.cjs) and flushes over IPC before closing instead.
 *
 * `flushAllPending` is also what a main-process "flush before quit" request should await.
 */

import { DebouncedSaver } from './debouncedSaver';

export interface UnloadRequest {
  url: string;
  body: string;
}

interface Entry {
  saver: DebouncedSaver<unknown>;
  toRequest: (value: unknown) => UnloadRequest;
}

/** Under Chromium's 64 KiB keepalive cap, with room for headers. */
const KEEPALIVE_BUDGET_BYTES = 60_000;

const entries = new Set<Entry>();
/** The unload is cancelled at most once per page lifetime, so a save that keeps failing cannot block closing. */
let cancelledOnce = false;

export function registerUnloadFlush<T>(saver: DebouncedSaver<T>, toRequest: (value: T) => UnloadRequest): () => void {
  const entry = { saver, toRequest } as unknown as Entry;
  entries.add(entry);
  return () => {
    entries.delete(entry);
  };
}

export async function flushAllPending(): Promise<boolean> {
  const results = await Promise.all([...entries].map((e) => e.saver.flush()));
  return results.every(Boolean);
}

function keepaliveSend({ url, body }: UnloadRequest): void {
  void fetch(url, {
    method: 'PUT',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body
  }).catch(() => {});
}

/** Returns true when it cancelled the unload to finish saving first. */
export function handleBeforeUnload(
  event: { preventDefault(): void; returnValue?: unknown },
  send: (request: UnloadRequest) => void = keepaliveSend
): boolean {
  // A paused saver holds marks that must not be written (pre-renumbering), so it is skipped.
  const due = [...entries].filter((e) => e.saver.pending() && !e.saver.paused());
  if (due.length === 0) return false;
  const requests = due.map((e) => e.toRequest(e.saver.pending()!.value));
  const bytes = requests.reduce((sum, r) => sum + new TextEncoder().encode(r.body).length, 0);
  if (bytes > KEEPALIVE_BUDGET_BYTES && !cancelledOnce) {
    cancelledOnce = true;
    event.preventDefault();
    event.returnValue = '';
    void flushAllPending();
    return true;
  }
  requests.forEach(send);
  due.forEach((e) => e.saver.cancel());
  return false;
}
