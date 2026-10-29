/**
 * Lets the renderer finish its pending (debounced) saves before a window closes or the app quits.
 *
 * Protocol (renderer side in preload.cjs `onFlushPendingSaves`): main sends
 * `marginalia:flush-pending-saves` with a request id; the renderer runs its flush and answers
 * `marginalia:flush-pending-saves-done` with (requestId, ok). Main waits at most `timeoutMs`, so a
 * hung renderer can delay quitting but never block it.
 */

const REQUEST = 'marginalia:flush-pending-saves';
const DONE = 'marginalia:flush-pending-saves-done';
let nextRequestId = 1;

/** Resolves true/false with the renderer's answer, or false on timeout or a destroyed window. */
function requestFlush(webContents, ipcMain, timeoutMs = 3000) {
  if (!webContents || webContents.isDestroyed()) return Promise.resolve(false);
  const requestId = nextRequestId++;
  return new Promise((resolve) => {
    const finish = (ok) => {
      clearTimeout(timer);
      ipcMain.removeListener(DONE, onDone);
      resolve(ok);
    };
    const onDone = (_event, id, ok) => {
      if (id === requestId) finish(ok === true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    ipcMain.on(DONE, onDone);
    try {
      webContents.send(REQUEST, requestId);
    } catch {
      finish(false);
    }
  });
}

/**
 * A `close` / `before-quit` handler that holds the first event, flushes once, then calls
 * `proceed` (which closes or quits again). Every event after that passes untouched, so the
 * repeated close/quit cannot loop. Events arriving mid-flush are held and dropped.
 * `skip()` true lets an event through untouched: a window close that is part of a quit which has
 * already flushed must not be prevented, or it cancels the quit (Cmd+Q on macOS left the app alive).
 */
function createExitGuard(flush, skip = () => false) {
  let state = 'idle';
  return (event, proceed) => {
    if (state === 'done' || skip()) return;
    event.preventDefault();
    if (state === 'flushing') return;
    state = 'flushing';
    let flushing;
    try {
      flushing = Promise.resolve(flush());
    } catch {
      flushing = Promise.resolve(false);
    }
    flushing
      .catch(() => false)
      .then(() => {
        state = 'done';
        proceed();
      });
  };
}

module.exports = { requestFlush, createExitGuard };
