/**
 * The OCR engine: tesseract.js in a Web Worker, English and Urdu, entirely offline. Its worker,
 * core and models are the app's own files under `/ocr/` (see `ocrAssets` in vite.config.ts), and
 * tesseract.js is loaded only when a read starts, so it costs nothing until the reader asks.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ocrWordsFromBlocks, type OcrBlock } from '../../../utils/ocrWords';
import { pageHasText } from '../textMarking';
import { untilAborted, type OcrEngine } from './ocrStore';

/** The languages pages are read in, as tesseract names them. */
export const OCR_LANGS = 'eng+urd';
/** Long side of the page image handed to tesseract, in pixels: enough for book type. */
const IMAGE_SIDE = 2400;

type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

let worker: Promise<TesseractWorker> | null = null;
/** Where the worker's progress goes: the page being read now. */
let report: (progress: number) => void = () => {};

function getWorker(): Promise<TesseractWorker> {
  worker ??= import('tesseract.js').then(({ createWorker }) =>
    createWorker(OCR_LANGS.split('+'), 1 /* LSTM only */, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/tesseract-core-simd-lstm.wasm.js',
      langPath: '/ocr',
      gzip: true,
      workerBlobURL: false,
      cacheMethod: 'none',
      logger: (m) => {
        if (m.status === 'recognizing text') report(m.progress);
      }
    })
  );
  return worker;
}

function stopWorker(): void {
  const w = worker;
  worker = null;
  void w?.then((x) => x.terminate()).catch(() => undefined);
}

/** The page drawn alone at reading resolution, for tesseract. */
async function pageImage(pdf: PDFDocumentProxy, n: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(8, IMAGE_SIDE / Math.max(base.width, base.height)) });
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

export const tesseractEngine: OcrEngine = {
  async pageHasText(pdf, n) {
    const page = await (pdf as PDFDocumentProxy).getPage(n);
    return pageHasText((await page.getTextContent()).items);
  },

  async recognize(pdf, n, onProgress, signal) {
    const aborted = () => new DOMException('cancelled', 'AbortError');
    if (signal.aborted) throw aborted();
    // Cancelling stops the worker mid-read; the next read starts a new one.
    const onAbort = () => stopWorker();
    signal.addEventListener('abort', onAbort, { once: true });
    report = onProgress;
    try {
      const image = await pageImage(pdf as PDFDocumentProxy, n);
      const w = await getWorker();
      // A terminated worker never answers its job: stop waiting the moment the read is cancelled.
      const { data } = await untilAborted(w.recognize(image, {}, { blocks: true, text: false }), signal);
      if (signal.aborted) throw aborted();
      return {
        words: ocrWordsFromBlocks((data.blocks ?? []) as unknown as OcrBlock[], image.width, image.height),
        langs: OCR_LANGS,
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
