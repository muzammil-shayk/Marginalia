/**
 * The OCR engine: tesseract.js in a Web Worker, English only, entirely offline. Its worker, core
 * and model are the app's own files under `/ocr/` (see `ocrAssets` in vite.config.ts), and
 * tesseract.js is loaded only when a read starts, so it costs nothing until the reader asks.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PSM } from 'tesseract.js';
import { ocrWordsFromBlocks, type OcrBlock } from '../../../utils/ocrWords';
import { pageHasText, pageHasUnmappedText } from '../textMarking';
import { isRtlDocument } from './autoOcr';
import { untilAborted, type OcrEngine } from './ocrStore';

/** Long side of the page image handed to tesseract, in pixels: enough for book type. */
const IMAGE_SIDE = 2400;
/** Automatic page layout: columns, headings and running heads are found as blocks. */
const PSM_AUTO = '3' as PSM;

type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

/** pdf.js scale that draws a `width` x `height` page with a long side of `side` pixels. */
export function ocrImageScale(width: number, height: number, side: number): number {
  return side / Math.max(width, height);
}

const rtlDocs = new WeakMap<PDFDocumentProxy, Promise<boolean>>();
/** The PDF's catalog /Lang or /Direction says right to left. */
function isRtl(pdf: PDFDocumentProxy): Promise<boolean> {
  let known = rtlDocs.get(pdf);
  if (!known) {
    known = Promise.all([pdf.getMetadata().catch(() => null), pdf.getViewerPreferences().catch(() => null)]).then(([meta, prefs]) =>
      isRtlDocument({ language: (meta?.info as { Language?: string } | undefined)?.Language, direction: (prefs as { Direction?: string } | null)?.Direction })
    );
    rtlDocs.set(pdf, known);
  }
  return known;
}

/** The page drawn alone at reading resolution, for tesseract. */
async function drawPage(pdf: PDFDocumentProxy, n: number, side: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: ocrImageScale(base.width, base.height, side) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext('2d')!;
  // White under the page: a transparent scan reads as black to tesseract.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, canvas } as Parameters<typeof page.render>[0]).promise;
  return canvas;
}

/** What the engine needs from the outside: tests pass fakes. */
export interface TesseractDeps {
  createWorker(logger: (m: { status: string; progress: number }) => void): Promise<TesseractWorker>;
  pageImage(pdf: PDFDocumentProxy, n: number, side: number): Promise<HTMLCanvasElement>;
}

export function createTesseractEngine(deps: TesseractDeps): OcrEngine {
  const { pageImage } = deps;
  /** One worker, English loaded and page layout set once. */
  let worker: Promise<TesseractWorker> | null = null;
  /** Where the worker's progress goes: the page being read now. */
  let report: (progress: number) => void = () => {};

  function getWorker(): Promise<TesseractWorker> {
    worker ??= deps
      .createWorker((m) => {
        if (m.status === 'recognizing text') report(m.progress);
      })
      .then(async (w) => {
        await w.setParameters({ tessedit_pageseg_mode: PSM_AUTO });
        return w;
      });
    return worker;
  }

  function stopWorker(): void {
    const w = worker;
    worker = null;
    void w?.then((x) => x.terminate()).catch(() => undefined);
  }

  return {
    async pageHasText(pdf, n) {
      const page = await (pdf as PDFDocumentProxy).getPage(n);
      return pageHasText((await page.getTextContent()).items);
    },

    isRtl(pdf) {
      return isRtl(pdf as PDFDocumentProxy);
    },

    pageUnmapped(pdf, n) {
      return (pdf as PDFDocumentProxy)
        .getPage(n)
        .then((p) => p.getTextContent())
        .then((c) => pageHasUnmappedText(c.items), () => false);
    },

    async recognize(pdf, n, onProgress, signal) {
      const aborted = () => new DOMException('cancelled', 'AbortError');
      if (signal.aborted) throw aborted();
      // Cancelling stops the worker mid-read; the next read starts a new one.
      const onAbort = () => stopWorker();
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        // Checked after every wait: a worker made after a cancel would outlive the release.
        const image = await untilAborted(pageImage(pdf as PDFDocumentProxy, n, IMAGE_SIDE), signal);
        const w = await untilAborted(getWorker(), signal);
        report = onProgress;
        // A terminated worker never answers its job: stop waiting the moment the read is cancelled.
        const { data } = await untilAborted(w.recognize(image, {}, { blocks: true, text: false }), signal);
        if (signal.aborted) throw aborted();
        return {
          words: ocrWordsFromBlocks((data.blocks ?? []) as unknown as OcrBlock[], image.width, image.height),
          langs: 'eng',
          createdAt: new Date().toISOString()
        };
      } catch (err) {
        throw signal.aborted ? aborted() : err;
      } finally {
        signal.removeEventListener('abort', onAbort);
        report = () => {};
      }
    },

    release() {
      stopWorker();
    }
  };
}

export const tesseractEngine = createTesseractEngine({
  createWorker: (logger) =>
    import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1 /* LSTM only */, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/tesseract-core-simd-lstm.wasm.js',
        langPath: '/ocr',
        gzip: true,
        workerBlobURL: false,
        cacheMethod: 'none',
        logger
      })
    ),
  pageImage: drawPage
});
