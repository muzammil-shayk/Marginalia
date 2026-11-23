/**
 * Where a key or swipe takes the PDF book. `at` is the open page, `pending` the page a turn is
 * still waiting to paint (or null). A second step the same way while it waits is the reader
 * asking again, not asking for one more pair: that turn goes now, so no pair is skipped.
 * Null when there is nowhere to go.
 */
export function bookStep(at: number, pending: number | null, step: 1 | -1, pageCount: number): { page: number; now: boolean } | null {
  if (pending !== null && Math.sign(pending - at) === step) return { page: pending, now: true };
  const from = pending ?? at;
  const pair = Math.max(0, Math.min(Math.floor((pageCount - 1) / 2), Math.floor((from - 1) / 2) + step));
  const page = pair * 2 + 1;
  return Math.floor((from - 1) / 2) === pair ? null : { page, now: false };
}
