/**
 * Debounced saving of reading progress (see `PUT /api/documents/:id/progress`). Readers report on
 * every scroll or page change; the server hears the latest report once the reader pauses, and a
 * pending one is flushed on leaving (`registerUnloadFlush`, see `useReadingProgress`).
 */

import { createDebouncedSaver, DebouncedSaver } from './debouncedSaver';
import type { UnloadRequest } from './unloadFlush';

export interface ProgressReport {
  position: number;
  total: number;
}

export function createProgressSaver(
  docId: string,
  deps: { save: (docId: string, report: ProgressReport) => Promise<boolean>; delayMs?: number }
): { report(position: number, total: number): void; saver: DebouncedSaver<ProgressReport>; unloadRequest(r: ProgressReport): UnloadRequest } {
  const saver = createDebouncedSaver<ProgressReport>({
    save: (report) => deps.save(docId, report),
    delayMs: deps.delayMs ?? 1500
  });
  return {
    report(position, total) {
      // Same rule the server applies; an invalid report would only be refused there.
      if (!Number.isFinite(position) || !Number.isFinite(total) || total <= 0 || position < 0) return;
      saver.schedule({ position, total });
    },
    saver,
    unloadRequest: (report) => ({ url: `/api/documents/${docId}/progress`, body: JSON.stringify(report) })
  };
}
