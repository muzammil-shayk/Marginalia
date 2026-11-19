/**
 * The element showing a PDF page at a given height. Usually there is one per page, but collapsed
 * to marks (PdfCollapsed.tsx) a page can be on screen as several strips, each its own copy of the
 * page clipped to a band marked `data-band-top`/`data-band-bottom` (page fractions). Anything
 * placed against a mark must use the strip that shows it, not the page's first strip.
 */
export function pageElementAt(root: ParentNode | null | undefined, page: number, y: number): HTMLElement | null {
  const all = Array.from(root?.querySelectorAll<HTMLElement>(`[data-page-number="${page}"]`) ?? []);
  const holds = (el: HTMLElement) => {
    const band = el.closest<HTMLElement>('[data-band-top]')?.dataset;
    return !band || (Number(band.bandTop) <= y && y <= Number(band.bandBottom));
  };
  return all.find(holds) ?? all[0] ?? null;
}
