/**
 * A debounced autosave that can be flushed, cancelled and paused.
 *
 * Built for the PDF workspace, where a page insert or delete renumbers every mark on the server.
 * The old autosave checked its "busy renumbering" flag only when a timer was SCHEDULED, so a
 * timer already pending when the page operation started still fired mid-operation and PUT the
 * pre-shift page numbers back. Here the pause is checked when the timer FIRES, and
 * `runPageOperation` saves anything pending before the operation instead of racing it.
 */

export interface DebouncedSaver<T> {
  /** Remembers `value` as the one to write and (re)starts the timer. */
  schedule(value: T): void;
  /**
   * Writes the pending value now (after any save already in flight). Resolves true when nothing
   * is left unsaved. A paused saver writes nothing and resolves false if something is pending.
   */
  flush(): Promise<boolean>;
  /** Drops the pending value without writing it. */
  cancel(): void;
  pause(): void;
  resume(): void;
  pending(): { value: T } | null;
  paused(): boolean;
}

export function createDebouncedSaver<T>(opts: {
  save: (value: T) => Promise<boolean>;
  delayMs: number;
  onResult?: (ok: boolean) => void;
}): DebouncedSaver<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingValue: { value: T } | null = null;
  let isPaused = false;
  let inFlight: Promise<boolean> | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  /** Writes the pending value. On failure it goes back to pending unless a newer value arrived. */
  const write = (): Promise<boolean> => {
    const taken = pendingValue!;
    pendingValue = null;
    const run = opts.save(taken.value).then(
      (ok) => ok,
      () => false
    );
    inFlight = run;
    return run.then((ok) => {
      if (inFlight === run) inFlight = null;
      if (!ok && pendingValue === null) pendingValue = taken;
      opts.onResult?.(ok);
      return ok;
    });
  };

  return {
    schedule(value) {
      pendingValue = { value };
      clearTimer();
      if (isPaused) return;
      timer = setTimeout(() => {
        timer = null;
        // Checked here, when the timer fires, not only when it was scheduled.
        if (isPaused || !pendingValue) return;
        void write();
      }, opts.delayMs);
    },
    async flush() {
      clearTimer();
      if (inFlight) await inFlight;
      if (!pendingValue) return true;
      if (isPaused) return false;
      return write();
    },
    cancel() {
      clearTimer();
      pendingValue = null;
    },
    pause() {
      isPaused = true;
      clearTimer();
    },
    resume() {
      isPaused = false;
    },
    pending: () => pendingValue,
    paused: () => isPaused
  };
}

export type PageOperationOutcome<R> =
  | { status: 'unsaved' }
  | { status: 'failed' }
  | { status: 'done'; result: R; reloaded: boolean };

/**
 * Runs a page insert/delete around the autosave.
 *
 * 1. Saves anything pending first; if that fails the operation does not run, so no mark is lost
 *    to the reload that follows it.
 * 2. Pauses saving while the server renumbers.
 * 3. Re-reads the renumbered marks and `reset`s the history with them, so Undo cannot put the old
 *    page numbers back onto the changed PDF.
 * 4. On success, drops any edit made during the operation (it carries old page numbers). If the
 *    re-read failed, saving STAYS paused: the marks in memory are pre-shift and must never be
 *    written. On failure (or a throw) nothing was renumbered, so a pending edit is kept and its
 *    timer restarted.
 */
export async function runPageOperation<R, M>(deps: {
  saver: DebouncedSaver<M>;
  operate: () => Promise<R | null>;
  reload: () => Promise<M | null>;
  reset: (marks: M) => void;
}): Promise<PageOperationOutcome<R>> {
  const { saver } = deps;
  if (!(await saver.flush())) return { status: 'unsaved' };
  saver.pause();
  let renumbered = false;
  // Until the re-read succeeds, the marks in memory may be pre-shift (also when reload throws).
  let keepPaused = false;
  try {
    const result = await deps.operate();
    if (result === null) return { status: 'failed' };
    renumbered = true;
    keepPaused = true;
    const marks = await deps.reload();
    if (marks === null) return { status: 'done', result, reloaded: false };
    deps.reset(marks);
    keepPaused = false;
    return { status: 'done', result, reloaded: true };
  } finally {
    const kept = renumbered ? null : saver.pending();
    saver.cancel();
    if (!keepPaused) saver.resume();
    if (kept) saver.schedule(kept.value);
  }
}

/** Wraps a mark-changing call so it does nothing while `isBusy()` (a page insert/delete runs). */
export function gateWhileBusy<A extends unknown[]>(isBusy: () => boolean, fn: (...args: A) => void): (...args: A) => void {
  return (...args) => {
    if (!isBusy()) fn(...args);
  };
}
