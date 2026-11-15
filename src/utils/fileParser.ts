/**
 * Client-side file parser for extracting text from uploaded documents.
 * Supports: .txt, .pdf, .docx, .epub, .htm/.html
 */

import { prepareHtmlDocument } from './htmlDocument';
import { collectEpubText } from './epubText';

export interface ParseResult {
  title: string;
  text: string;
  pageCount?: number;
  format: string;
  /**
   * HTML imports only: the self-contained, print-ready document. It is converted to a PDF on
   * the way into the store so the annotating workspace can paginate and mark it up like any
   * other PDF — see `utils/htmlDocument.ts` for why pagination happens at import time.
   */
  printableHtml?: string;
  /** HTML imports only: how many sibling files (images, stylesheets) were embedded. */
  inlinedAssets?: number;
  /**
   * True for a PDF whose pages carry no text layer — a scan, or a book assembled from page
   * images. The file is perfectly readable and annotatable; only the things that need machine
   * -readable text (selection, search, AI analysis) are unavailable, and the caller says so
   * rather than the import failing.
   */
  textLayerMissing?: boolean;
}

/**
 * Parse a File object and extract its text content.
 */
export async function parseFile(file: File, siblings: File[] = []): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const title = file.name.replace(/\.[^/.]+$/, '');

  switch (ext) {
    case 'txt':
      return parseTxt(file, title);
    case 'pdf':
      return parsePdf(file, title);
    case 'docx':
      return parseDocx(file, title);
    case 'epub':
      return parseEpub(file, title);
    case 'htm':
    case 'html':
    case 'xhtml':
      return parseHtml(file, siblings);
    default:
      throw new Error(
        `Unsupported file format: .${ext}. Supported formats: .txt, .pdf, .docx, .epub, .htm`
      );
  }
}

/**
 * Parse plain text files using FileReader.
 */
async function parseTxt(file: File, title: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (!text.trim()) {
        reject(new Error('The text file is empty.'));
        return;
      }
      resolve({ title, text: text.trim(), format: 'TXT' });
    };
    reader.onerror = () => reject(new Error('Failed to read the text file.'));
    reader.readAsText(file);
  });
}

/**
 * Parse PDF files using pdfjs-dist (Mozilla PDF.js).
 */
async function parsePdf(file: File, title: string): Promise<ParseResult> {
  const pdfjsLib = await import('pdfjs-dist');

  // Set the worker source to the bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  // The same WASM decoders the viewer needs — see `PDF_WASM_URL` in `components/pdf/PdfWorkspace`.
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, wasmUrl: '/pdf-wasm/' }).promise;

  // Note: page boundaries are intentionally NOT embedded as their own
  // "--- Page N ---" text blocks here. Paragraph indices computed from this
  // text (by the reader) rely on splitting on blank lines, and a divider
  // block would silently shift every paragraph index after it out of sync.
  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
      .trim();
    if (pageText) {
      textParts.push(pageText);
    }
  }

  const fullText = textParts.join('\n\n');

  /*
    A PDF with no extractable text is NOT a failure.

    Scanned books, and books assembled from page images, have no text layer at all — and refusing
    them meant the one kind of document a reader most wants to mark up by hand could not be opened
    at all. The pages render perfectly in the viewer and every drawing tool works on them; the
    only things genuinely unavailable are the ones that need machine-readable words. So the import
    succeeds, and stands in a short note explaining what is missing, because the store needs some
    text to file the document under and a silent empty string would read as a corrupt import.
  */
  if (!fullText.trim()) {
    return {
      title,
      text:
        `${title}\n\n` +
        'This PDF has no text layer — it is a scan, or a document built from page images. ' +
        'You can read it and annotate it by hand, but selecting text and searching it need ' +
        'machine-readable words, which this file does not carry. ' +
        'Running it through OCR first would restore them.',
      pageCount: pdf.numPages,
      format: 'PDF',
      textLayerMissing: true
    };
  }

  return {
    title,
    text: fullText.trim(),
    pageCount: pdf.numPages,
    format: 'PDF'
  };
}

/**
 * Parse DOCX files using mammoth.js.
 */
async function parseDocx(file: File, title: string): Promise<ParseResult> {
  const arrayBuffer = await zipBytes(file);
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer });

  if (!result.value.trim()) {
    throw new Error('The DOCX file appears to be empty or contains no extractable text.');
  }

  return {
    title,
    text: result.value.trim(),
    format: 'DOCX'
  };
}

/**
 * Parse EPUB files using epubjs.
 * Extracts text from each chapter/spine item.
 */
async function parseEpub(file: File, title: string): Promise<ParseResult> {
  const arrayBuffer = await zipBytes(file);
  const ePub = (await import('epubjs')).default;
  const book = ePub(arrayBuffer);

  await book.ready;

  // Block-by-block, so paragraphs and headings stay separate paragraphs (see epubText.ts).
  const spine = book.spine as any;
  const hrefs: string[] = spine.items.map((item: any) => item.href).filter(Boolean);
  const fullText = await collectEpubText(hrefs, (href) => book.load(href));

  // Clean up
  book.destroy();

  if (!fullText.trim()) {
    throw new Error('Could not extract text from this EPUB. The file may be DRM-protected or corrupted.');
  }

  return {
    title,
    text: fullText.trim(),
    format: 'EPUB'
  };
}

/**
 * Parse an HTML document, together with any sibling files selected alongside it.
 *
 * Unlike the other formats this returns more than text: it also returns a self-contained copy
 * of the page with its images and stylesheets embedded, because the caller converts that to a
 * PDF so the document becomes annotatable rather than read-only.
 */
async function parseHtml(file: File, siblings: File[]): Promise<ParseResult> {
  const prepared = await prepareHtmlDocument(file, siblings);
  return {
    title: prepared.title,
    text: prepared.text,
    format: 'HTML',
    printableHtml: prepared.printableHtml,
    inlinedAssets: prepared.inlinedAssets
  };
}

/** Generous for any real book or document: a long illustrated EPUB unpacks to tens of MB. */
const MAX_UNZIPPED_BYTES = 512 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 20_000;

/**
 * DOCX and EPUB are zip files, and a few KB can unpack to gigabytes (a "zip bomb"), freezing the
 * app while it is read. This reads the zip's own directory, before anything is unpacked, and
 * returns the reason to refuse it, or null. Not a zip (no directory found): null, and the format
 * reader reports the problem as before.
 *
 * This is only the fast path: it trusts the sizes the directory declares. `zipInflatesTooLarge`
 * then counts the real bytes, which catches a file that lies about them.
 */
export function zipTooLarge(bytes: Uint8Array, limits: { maxBytes?: number; maxEntries?: number } = {}): string | null {
  const maxBytes = limits.maxBytes ?? MAX_UNZIPPED_BYTES;
  const maxEntries = limits.maxEntries ?? MAX_ZIP_ENTRIES;
  const tooLarge = tooLargeMessage(maxBytes, maxEntries);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory record: 22 bytes, then a comment of up to 65,535.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const entries = view.getUint16(end + 10, true);
  const offset = view.getUint32(end + 16, true);
  // ZIP64 markers: a directory too big for the classic fields.
  if (entries === 0xffff || offset === 0xffffffff) return tooLarge;
  if (entries > maxEntries) return tooLarge;
  let total = 0;
  let at = offset;
  for (let n = 0; n < entries; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) return null;
    const size = view.getUint32(at + 24, true);
    if (size === 0xffffffff) return tooLarge;
    total += size;
    if (total > maxBytes) return tooLarge;
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return null;
}

interface ZipStream {
  on(event: 'data', listener: (chunk: Uint8Array) => void): ZipStream;
  on(event: 'error' | 'end', listener: () => void): ZipStream;
  pause(): ZipStream;
  resume(): ZipStream;
}

function tooLargeMessage(maxBytes: number, maxEntries: number): string {
  return `This file is too large to open: it unpacks to more than ${Math.round(maxBytes / 1024 / 1024)} MB or ${maxEntries.toLocaleString('en-US')} parts.`;
}

/**
 * The real check: unpacks every entry once, counting the bytes as they come out and discarding
 * them, and stops the moment the running total passes the limit, so a lying bomb never unpacks
 * in full. Returns the reason to refuse, or null. Not a zip, or a damaged entry: null, and the
 * format reader reports the problem as before.
 */
export async function zipInflatesTooLarge(
  bytes: Uint8Array,
  limits: { maxBytes?: number; maxEntries?: number } = {}
): Promise<string | null> {
  const maxBytes = limits.maxBytes ?? MAX_UNZIPPED_BYTES;
  const maxEntries = limits.maxEntries ?? MAX_ZIP_ENTRIES;
  const JSZip = (await import('jszip')).default;
  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return null;
  }
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > maxEntries) return tooLargeMessage(maxBytes, maxEntries);
  let total = 0;
  for (const entry of entries) {
    const over = await new Promise<boolean>((resolve) => {
      // Documented JSZip API (ZipObject#internalStream) that its type definitions leave out.
      const stream = (entry as unknown as { internalStream(type: 'uint8array'): ZipStream }).internalStream('uint8array');
      stream
        .on('data', (chunk: Uint8Array) => {
          total += chunk.length;
          if (total > maxBytes) {
            stream.pause();
            resolve(true);
          }
        })
        .on('error', () => resolve(false))
        .on('end', () => resolve(false))
        .resume();
    });
    if (over) return tooLargeMessage(maxBytes, maxEntries);
  }
  return null;
}

/** The file's bytes, refused with a clear reason when the zip inside is too large to unpack. */
async function zipBytes(file: File): Promise<ArrayBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const reason = zipTooLarge(bytes) ?? (await zipInflatesTooLarge(bytes));
  if (reason) throw new Error(reason);
  return arrayBuffer;
}

