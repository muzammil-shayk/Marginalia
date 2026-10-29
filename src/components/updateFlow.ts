/**
 * The update prompt's state, as a pure reducer so the updater's real event sequences can be tested
 * (`UpdatePrompt.test.ts`). `UpdatePrompt.tsx` renders it.
 */

import type { UpdateStatus } from '../utils/documentStorage';

/** A manual check that has heard nothing for this long stops counting as manual. */
export const MANUAL_TIMEOUT_MS = 30_000;

export type Result = { kind: 'current' } | { kind: 'error'; message: string };

export type Flow = {
  status: UpdateStatus;
  /** While a "Check Now" is in flight: the time it stops counting as manual. 0 = none. */
  manualUntil: number;
  /** Whether the manual check has reported anything beyond `checking`. */
  manualHeard: boolean;
  /** The answer to a manual check that found nothing to install. */
  result: Result | null;
  /** A manual check reopened a ready download the reader had put off with "Later". */
  forceReady: boolean;
  /** `downloading` carries no version, so the note keeps the one `available` announced. */
  fetchingVersion: string | null;
  noteHidden: boolean;
  installFailed: boolean;
};

export type FlowEvent =
  | { type: 'manual-check'; now: number }
  /** `checkForUpdates()` has returned. */
  | { type: 'manual-settled' }
  | { type: 'status'; next: UpdateStatus; now: number }
  | { type: 'hide-note' }
  | { type: 'close-result' }
  | { type: 'later' }
  | { type: 'install-failed' };

export const initialFlow: Flow = {
  status: { state: 'idle' },
  manualUntil: 0,
  manualHeard: false,
  result: null,
  forceReady: false,
  fetchingVersion: null,
  noteHidden: false,
  installFailed: false,
};

/**
 * A finished download stays until another download finishes or a different version turns up. The
 * 4-hourly re-check can report checking, the same version, not-available or an offline error, and
 * none of those undo a download that is ready to install.
 */
function nextStatus(prev: UpdateStatus, next: UpdateStatus): UpdateStatus {
  if (prev.state !== 'downloaded') return next;
  if (next.state === 'downloaded') return next;
  if (next.state === 'available' && next.version !== prev.version) return next;
  return prev;
}

export function reduceFlow(s: Flow, e: FlowEvent): Flow {
  switch (e.type) {
    case 'manual-check':
      return { ...s, manualUntil: e.now + MANUAL_TIMEOUT_MS, manualHeard: false };
    case 'manual-settled':
      // Nothing came back at all, so nothing is on its way: a later automatic check stays quiet.
      return s.manualUntil && !s.manualHeard ? { ...s, manualUntil: 0 } : s;
    case 'hide-note':
      return { ...s, noteHidden: true };
    case 'close-result':
      return { ...s, result: null };
    case 'later':
      return { ...s, result: null, forceReady: false, installFailed: false };
    case 'install-failed':
      return { ...s, installFailed: true };
    case 'status': {
      const { next, now } = e;
      const status = nextStatus(s.status, next);
      const out: Flow = { ...s, status };

      const newVersion =
        (next.state === 'available' && next.version !== s.fetchingVersion) ||
        (status.state === 'downloaded' && (s.status.state !== 'downloaded' || s.status.version !== status.version));
      if (next.state === 'available') out.fetchingVersion = next.version;
      if (newVersion) {
        out.noteHidden = false;
        out.installFailed = false;
        out.forceReady = false;
      }

      if (s.manualUntil <= now) {
        out.manualUntil = 0;
        return out;
      }
      // Only a check the reader asked for gets an answer.
      if (next.state === 'checking' || next.state === 'idle') return out;
      out.manualHeard = true;
      // A found update is still on its way: a re-check of a version already on disk reports
      // `available` and then `downloaded` from the cached file, and that `downloaded` is the answer.
      if (next.state === 'available' || next.state === 'downloading') {
        out.manualUntil = now + MANUAL_TIMEOUT_MS;
        return out;
      }
      out.manualUntil = 0;
      // A download that waits, even one put off with "Later", answers the check itself.
      if (status.state === 'downloaded') out.forceReady = true;
      else if (next.state === 'not-available') out.result = { kind: 'current' };
      else if (next.state === 'error') out.result = { kind: 'error', message: next.message };
      return out;
    }
  }
}

/** Which dialog shows. One at a time: a ready update outranks the answer to a manual check. */
export function selectDialog(
  s: Flow,
  /** The version the reader said "Later" to; `undefined` until it has been read from disk. */
  dismissed: string | null | undefined,
  changelogOpen = false,
): 'ready' | 'current' | 'error' | null {
  if (changelogOpen) return null;
  if (s.status.state === 'downloaded' && dismissed !== undefined && (s.status.version !== dismissed || s.forceReady)) return 'ready';
  return s.result?.kind ?? null;
}
