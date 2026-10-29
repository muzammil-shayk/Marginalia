/**
 * The time shown on a text-reader note.
 *
 * Notes used to store the literal "Just now" as their time, forever. New notes carry an ISO
 * `createdAt` and the label is computed from it. Older notes have no real time recorded, so they
 * show nothing rather than a wrong one.
 */

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Read-side shape: `createdAt` is optional because notes saved before it existed lack it. */
export type TimedNote = { timestamp?: string; createdAt?: string };

export function noteTimeLabel(note: TimedNote, now: Date): string {
  const created = note.createdAt ? new Date(note.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return '';
  const seconds = Math.round((now.getTime() - created.getTime()) / 1000);
  if (seconds < 60) return relative.format(0, 'second');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relative.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  const days = Math.max(1, Math.round(hours / 24));
  if (days < 30) return relative.format(-days, 'day');
  return created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
