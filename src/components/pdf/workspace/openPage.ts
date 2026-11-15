/**
 * Opening one page from the 4/6-page grid: back to single-page view, that page current, and the
 * window scrolled so it sits at the top. Pure of React, so it is tested (openPage.test.ts).
 */

export function openPageAt(
  page: number,
  deps: {
    showSingle: () => void;
    setCurrentPage: (page: number) => void;
    scrollRoot: () => ParentNode | null | undefined;
  }
): void {
  deps.showSingle();
  deps.setCurrentPage(page);
  // Again as the pages take their new sizes (each learns its size from pdf.js a moment later),
  // so the page lands at the top of the window rather than where it was mid-relayout.
  const jump = () => deps.scrollRoot()?.querySelector(`[data-page-number="${page}"]`)?.scrollIntoView({ block: 'start' });
  requestAnimationFrame(() => requestAnimationFrame(jump));
  window.setTimeout(jump, 250);
  window.setTimeout(jump, 600);
}
