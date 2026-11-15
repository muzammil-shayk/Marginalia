/**
 * A class pack from a document with black-outs carries the cleaned copy, never the original.
 *
 * The server builds the pack from what is on disk (the readable original, its extracted text and
 * the marks as stored). Before it is saved, the renderer swaps in the true-redaction copy from
 * `redactedCopy` (each page with a black-out becomes a picture of itself with the black-outs
 * painted in), re-reads the document's text from that copy, and drops the quoted words of any
 * mark over a black-out. Deleting a black-out mark in the student's copy then uncovers only black.
 *
 * `cleanedPack` is pure and tested; `cleanClassPack` needs a canvas (the renderer).
 */

import type { ClassPack } from '../../../utils/classPack';
import { isBlackout, type Annotation } from '../annotationModel';
import { blackoutsByPage, touchesBlackout } from './redaction';

/** The pack with the cleaned document in, and no mark quoting words under a black-out. */
export function cleanedPack(pack: ClassPack, cleaned: { original: string; text: string }): ClassPack {
  const marks = pack.annotations as unknown as Annotation[];
  const blackouts = blackoutsByPage(marks);
  return {
    ...pack,
    document: { ...pack.document, original: cleaned.original, text: cleaned.text },
    annotations: pack.annotations.map((entry, i) => {
      const m = marks[i];
      const hidden = isBlackout(m) || touchesBlackout(m, blackouts.get(m.page) ?? []);
      if (!hidden || !('quote' in entry)) return entry;
      const { quote: _dropped, ...rest } = entry as typeof entry & { quote?: string };
      return rest;
    })
  };
}

const toBytes = (b64: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const toBase64 = (bytes: Uint8Array) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes as BlobPart]));
  });

/**
 * The pack text as the server sent it, cleaned if the document has black-outs. Throws rather than
 * return a pack that still holds the hidden words (no original to redact, or redaction failed).
 */
export async function cleanClassPack(body: string): Promise<string> {
  const pack = JSON.parse(body) as ClassPack;
  const blackouts = blackoutsByPage(pack.annotations as unknown as Annotation[]);
  if (!blackouts.size) return body;
  if (!pack.document.original) throw new Error('No original to redact');
  const [{ PDFDocument }, { redactedCopy }, { parseFile }] = await Promise.all([
    import('pdf-lib'),
    import('./redaction'),
    import('../../../utils/fileParser')
  ]);
  const bytes = toBytes(pack.document.original);
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const redacted = await (await redactedCopy(source, bytes.buffer as ArrayBuffer, blackouts)).save();
  // The text the student's copy is filed and searched under: read from the cleaned file, the way
  // an import reads it, so pages that became pictures contribute no words.
  const { text } = await parseFile(new File([redacted as BlobPart], 'cleaned.pdf', { type: 'application/pdf' }));
  return JSON.stringify(cleanedPack(pack, { original: await toBase64(redacted), text }));
}
