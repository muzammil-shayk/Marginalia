/**
 * Words and names for the marks archive (exports, import, restore). Pure, so they are tested.
 */

import { plural } from '../utils/plural';

const pad = (n: number) => String(n).padStart(2, '0');

/** "Today, 14:32" · "Yesterday, 09:05" · "3 Oct 2026, 14:32" (local time). '' for a bad date. */
export function backupTimeLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  const month = at.toLocaleString('en-GB', { month: 'short' });
  return `${at.getDate()} ${month} ${at.getFullYear()}, ${time}`;
}

/** What an import did, in one sentence. */
export function importSummary(added: number, themesAdded: number): string {
  if (added === 0) return 'Nothing new: every mark in that file is already here.';
  const themes = themesAdded ? ` and ${plural(themesAdded, 'theme')}` : '';
  return `Added ${plural(added, 'mark')}${themes}.`;
}

/** A title made safe for a file name; "document" when nothing is left. */
export function fileStem(title: string): string {
  const stem = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return stem || 'document';
}
