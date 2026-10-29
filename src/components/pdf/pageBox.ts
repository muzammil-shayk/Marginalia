import type { PDFPage } from 'pdf-lib';

/**
 * How a page-fraction mark maps to PDF points on one page.
 *
 * Marks are fractions of the page as the reader SAW it: pdf.js draws the visible box (CropBox
 * clipped to the MediaBox), with `/Rotate` applied. Scaling by the MediaBox from 0,0 put every
 * mark on a cropped page (most scans, many trimmed books) in the wrong place. So this scales by
 * the visible box and adds its x/y offset.
 *
 * `toPdf` takes a fraction in VISUAL space (top-left origin, rotation applied) and returns
 * points in the page's UNROTATED content space (bottom-left origin) — content is always drawn
 * there, the viewer applies `/Rotate` afterwards. The per-rotation cases were derived against
 * pdf.js's `viewport.convertToPdfPoint`. `pw` is the VISUAL width that width/weight fractions are
 * relative to (the box is transposed on a 90/270-degree page).
 */
export function pageTransform(page: PDFPage) {
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  const x0 = Math.max(media.x, crop.x);
  const y0 = Math.max(media.y, crop.y);
  const w = Math.min(media.x + media.width, crop.x + crop.width) - x0;
  const h = Math.min(media.y + media.height, crop.y + crop.height) - y0;
  const pw = rotation === 90 || rotation === 270 ? h : w;

  const toPdf = (x: number, y: number): [number, number] => {
    switch (rotation) {
      case 90:
        return [x0 + y * w, y0 + x * h];
      case 180:
        return [x0 + (1 - x) * w, y0 + y * h];
      case 270:
        return [x0 + (1 - y) * w, y0 + (1 - x) * h];
      default:
        return [x0 + x * w, y0 + (1 - y) * h];
    }
  };
  return { rotation, pw, toPdf };
}
