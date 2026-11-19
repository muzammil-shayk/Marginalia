/**
 * Collapse to marks: the document folded shut around what the reader marked, in the spirit of
 * LiquidText's pinch. Pure, so it can be tested and shared by the text reader (paragraphs) and the
 * PDF workspace (bands of a page).
 *
 * The reader keeps some units (the marked ones), with `context` units either side, and the rest
 * fold into one "N hidden" row per run, which can be opened on its own.
 */

/** A run of units to show, or a run folded away. `from` and `to` are inclusive indices. */
export type CollapseSegment = { kind: 'show' | 'fold'; from: number; to: number };

/**
 * The document as shown and folded runs, in order. `keep` are the units that matter (any order,
 * duplicates and out-of-range values ignored), `context` how many units around each to show too,
 * and `opened` the folds (by `foldKey`) the reader has opened since.
 */
export function collapseSegments(count: number, keep: Iterable<number>, context = 0, opened: ReadonlySet<string> = new Set()): CollapseSegment[] {
  if (count <= 0) return [];
  const shown = new Array<boolean>(count).fill(false);
  const pad = Math.max(0, Math.floor(context));
  for (const k of keep) {
    if (!Number.isInteger(k) || k < 0 || k >= count) continue;
    for (let i = Math.max(0, k - pad); i <= Math.min(count - 1, k + pad); i++) shown[i] = true;
  }
  // Runs of the same kind.
  const runs: CollapseSegment[] = [];
  for (let i = 0; i < count; i++) {
    const kind = shown[i] ? 'show' : 'fold';
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.to = i;
    else runs.push({ kind, from: i, to: i });
  }
  // An opened fold is shown, and joins the runs either side of it.
  const out: CollapseSegment[] = [];
  for (const r of runs) {
    const kind = r.kind === 'fold' && opened.has(foldKey(r)) ? 'show' : r.kind;
    const last = out[out.length - 1];
    if (last && last.kind === kind && kind === 'show') last.to = r.to;
    else out.push({ kind, from: r.from, to: r.to });
  }
  return out;
}

/** How a fold is remembered once opened: by the units it covers. */
export function foldKey(s: Pick<CollapseSegment, 'from' | 'to'>): string {
  return `${s.from}-${s.to}`;
}

/** How many units the segments show. */
export function shownCount(segments: CollapseSegment[]): number {
  return segments.reduce((n, s) => (s.kind === 'show' ? n + s.to - s.from + 1 : n), 0);
}

/** Which marks count when collapsing: all of them, one theme's, terminology, or notes only. */
export type CollapseFilter = { type: 'all' } | { type: 'theme'; id: string } | { type: 'terminology' } | { type: 'notes' };

/** The parts of a mark the filter looks at (a text mark or a PDF annotation). */
export interface CollapsibleMark {
  kind: string;
  themeIds?: string[];
  isTerminology?: boolean;
  /** Black-outs hide; they are not something to read again. */
  blackout?: boolean;
}

/** Formatting carried over from a pasted or imported text is not a mark. */
const NOT_MARKS = new Set(['bold', 'format']);

/** Whether a mark counts under the filter. */
export function markMatches(mark: CollapsibleMark, filter: CollapseFilter): boolean {
  if (NOT_MARKS.has(mark.kind) || mark.blackout) return false;
  switch (filter.type) {
    case 'all':
      return true;
    case 'theme':
      return (mark.themeIds ?? []).includes(filter.id);
    case 'terminology':
      return mark.isTerminology === true;
    case 'notes':
      return mark.kind === 'note';
  }
}

/** A vertical stretch of a page, in page fractions (0 top, 1 bottom). */
export interface Band {
  top: number;
  bottom: number;
}

/**
 * PDF: the bands of one page to show, from the marks' own vertical extents. Each grows by
 * `context` (page fraction) above and below, stays on the page, and bands that then touch or come
 * within `join` of each other merge, so two marks a line apart show as one strip.
 */
export function pageBands(extents: Band[], context = 0.02, join = 0.03): Band[] {
  const grown = extents
    .filter((b) => Number.isFinite(b.top) && Number.isFinite(b.bottom))
    .map((b) => ({ top: Math.max(0, Math.min(b.top, b.bottom) - context), bottom: Math.min(1, Math.max(b.top, b.bottom) + context) }))
    .sort((a, b) => a.top - b.top);
  const out: Band[] = [];
  for (const b of grown) {
    const last = out[out.length - 1];
    if (last && b.top - last.bottom <= join) last.bottom = Math.max(last.bottom, b.bottom);
    else out.push({ ...b });
  }
  return out;
}

/** The shapes a PDF mark can have, in page fractions (see pdf/annotationModel.ts). */
export interface ExtentShape {
  rects?: { y: number; h: number }[];
  box?: { y: number; h: number };
  points?: { y: number }[];
  from?: { y: number };
  to?: { y: number };
}

/** How far down a PDF page a mark reaches, top to bottom; null for a mark with no shape. */
export function markExtent(a: ExtentShape): Band | null {
  const ys: number[] = [];
  for (const r of a.rects ?? []) ys.push(r.y, r.y + r.h);
  if (a.box) ys.push(a.box.y, a.box.y + a.box.h);
  for (const p of a.points ?? []) ys.push(p.y);
  if (a.from) ys.push(a.from.y);
  if (a.to) ys.push(a.to.y);
  const ok = ys.filter(Number.isFinite);
  if (!ok.length) return null;
  return { top: Math.min(...ok), bottom: Math.max(...ok) };
}

/** PDF context steps (page fractions around each mark), for the bar's 0–3: about a line, a few, a paragraph, more. */
export const PDF_CONTEXT = [0.022, 0.05, 0.1, 0.18];

/** The bit of a pdf.js document that page sizes are read from. */
export interface PageSizeSource {
  getPage(n: number): Promise<{ getViewport(o: { scale: number }): { width: number; height: number } }>;
}

/**
 * Each page's size at `scale`. A page pdf.js cannot open is left out (its strips keep their
 * placeholder height) instead of failing the lot, so landing still happens.
 */
export async function readPageSizes(pdf: PageSizeSource, scale: number, pages: number[]): Promise<Map<number, { w: number; h: number }>> {
  const list = await Promise.all(
    pages.map((n) =>
      pdf.getPage(n).then(
        (p) => {
          const v = p.getViewport({ scale });
          return [n, { w: v.width, h: v.height }] as const;
        },
        () => null
      )
    )
  );
  return new Map(list.filter((e) => e !== null));
}
