/**
 * Pasted base formatting (bold, italic, underline) cut to one piece of a paragraph. Pure, tested.
 *
 * The reader already cuts a paragraph into pieces at mark boundaries; this cuts one piece further
 * at style boundaries, so the base formatting sits under the marks without changing any offset.
 */

import type { TextStyle, TextStyleKind } from '../utils/pastedText';

export interface StyleRun {
  start: number;
  end: number;
  styles: TextStyleKind[];
}

export function styleRuns(start: number, end: number, styles: TextStyle[]): StyleRun[] {
  const here = styles.filter((s) => s.anchor.start < end && s.anchor.end > start);
  if (!here.length) return [{ start, end, styles: [] }];
  const cuts = new Set([start, end]);
  for (const s of here) {
    if (s.anchor.start > start) cuts.add(s.anchor.start);
    if (s.anchor.end < end) cuts.add(s.anchor.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const runs: StyleRun[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const kinds = [...new Set(here.filter((s) => s.anchor.start <= a && s.anchor.end >= b).map((s) => s.style))];
    runs.push({ start: a, end: b, styles: kinds });
  }
  return runs;
}
