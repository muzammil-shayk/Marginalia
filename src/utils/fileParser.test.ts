/**
 * Run with: npx tsx --test src/utils/fileParser.test.ts
 *
 * DOCX and EPUB are zip files: a small file can unpack to gigabytes (a "zip bomb") and freeze the
 * app while it is read. The zip's own directory is checked first, against generous limits.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { deflateRawSync } from 'node:zlib';
import { parseFile, zipInflatesTooLarge, zipTooLarge } from './fileParser';

async function zip(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const z = new JSZip();
  for (const [name, data] of Object.entries(files)) z.file(name, data);
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** Rewrites every central-directory entry's declared uncompressed size. */
function declareSize(bytes: Uint8Array, size: number): Uint8Array {
  const out = bytes.slice();
  const view = new DataView(out.buffer);
  for (let i = 0; i + 46 <= out.length; i++) {
    if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, size, true);
  }
  return out;
}

test('an ordinary small zip passes', async () => {
  assert.equal(zipTooLarge(await zip({ 'word/document.xml': '<w:document/>', 'a.txt': 'hello' })), null);
});

test('more entries than the limit is refused', async () => {
  const bytes = await zip({ a: '1', b: '2', c: '3', d: '4' });
  assert.match(zipTooLarge(bytes, { maxEntries: 3 }) ?? '', /too large/);
  assert.equal(zipTooLarge(bytes, { maxEntries: 4 }), null);
});

test('more unpacked bytes than the limit is refused, however small the file', async () => {
  const bytes = await zip({ 'zeros.xml': new Uint8Array(2 * 1024 * 1024) });
  assert.ok(bytes.length < 50_000, 'the zip itself is tiny');
  assert.match(zipTooLarge(bytes, { maxBytes: 1024 * 1024 }) ?? '', /too large/);
});

test('with the default limits, a zip declaring gigabytes inside is refused', async () => {
  const bytes = declareSize(await zip({ 'a.xml': 'x', 'b.xml': 'y' }), 0x70000000);
  assert.match(zipTooLarge(bytes) ?? '', /too large/);
});

test('a ZIP64 size marker (4 GB or more) is refused', async () => {
  const bytes = declareSize(await zip({ 'a.xml': 'x' }), 0xffffffff);
  assert.match(zipTooLarge(bytes) ?? '', /too large/);
});

test('not a zip at all: left to the format reader to report', () => {
  assert.equal(zipTooLarge(new TextEncoder().encode('plain words')), null);
});

test('opening an oversized DOCX or EPUB fails with that reason before it is unpacked', async () => {
  const bytes = declareSize(await zip({ 'a.xml': 'x', 'b.xml': 'y' }), 0x70000000);
  for (const name of ['big.docx', 'big.epub']) {
    await assert.rejects(parseFile(new File([bytes], name)), /too large/, name);
  }
});

/**
 * A zip built by hand around raw deflate data, whose headers declare `declared` bytes per entry
 * whatever the data really inflates to: the lie a zip bomb tells to pass a directory check.
 * CRCs are left at 0 (JSZip does not check them unless asked).
 */
function lyingZip(entries: Record<string, Uint8Array>, declared: number): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, raw] of Object.entries(entries)) {
    const nameBytes = enc.encode(name);
    const data = deflateRawSync(raw);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 8, true); // deflate
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, declared, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, declared, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const dirSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, dirSize, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

test('a zip whose headers claim tiny sizes but inflates past the limit is refused', async () => {
  const bytes = lyingZip({ 'a.xml': new Uint8Array(2 * 1024 * 1024), 'b.xml': new Uint8Array(2 * 1024 * 1024) }, 10);
  assert.equal(zipTooLarge(bytes, { maxBytes: 3 * 1024 * 1024 }), null, 'the directory check is fooled');
  assert.match((await zipInflatesTooLarge(bytes, { maxBytes: 3 * 1024 * 1024 })) ?? '', /too large/);
});

test('the real-size check counts every entry together, not each alone', async () => {
  const bytes = lyingZip({ 'a.xml': new Uint8Array(2 * 1024 * 1024), 'b.xml': new Uint8Array(2 * 1024 * 1024) }, 10);
  assert.equal(await zipInflatesTooLarge(bytes, { maxBytes: 4 * 1024 * 1024 }), null);
  assert.match((await zipInflatesTooLarge(bytes, { maxBytes: 4 * 1024 * 1024 - 1 })) ?? '', /too large/);
});

test('the real-size check refuses more entries than the limit', async () => {
  const bytes = await zip({ a: '1', b: '2', c: '3', d: '4' });
  assert.match((await zipInflatesTooLarge(bytes, { maxEntries: 3 })) ?? '', /too large/);
  assert.equal(await zipInflatesTooLarge(bytes, { maxEntries: 4 }), null);
});

test('an honest ordinary zip passes the real-size check', async () => {
  assert.equal(await zipInflatesTooLarge(await zip({ 'word/document.xml': '<w:document/>', 'a.txt': 'hello' })), null);
});

test('not a zip: the real-size check leaves it to the format reader', async () => {
  assert.equal(await zipInflatesTooLarge(new TextEncoder().encode('plain words')), null);
});

test('opening a DOCX or EPUB that lies about its size and inflates past 512 MB is refused', async () => {
  // 513 MB of zeros deflates to about half a megabyte; the headers say 10 bytes.
  const bytes = lyingZip({ 'word/document.xml': new Uint8Array(513 * 1024 * 1024) }, 10);
  assert.equal(zipTooLarge(bytes), null, 'the directory check is fooled');
  for (const name of ['bomb.docx', 'bomb.epub']) {
    await assert.rejects(parseFile(new File([bytes], name)), /too large/, name);
  }
});
