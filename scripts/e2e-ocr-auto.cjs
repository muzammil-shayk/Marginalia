/**
 * End-to-end checks of scanned pages read on their own as the reader looks at them
 * (pdf/workspace/useAutoOcr.ts), in the real app (Electron + the built server), on a throwaway
 * library in the temp folder.
 *
 *   npm run test:e2e        (builds first)
 *
 * 1. A PDF with text of its own: nothing is read, ever.
 * 2. A scan opened at page 1: pages 1 and 2 are read (in view and the page after); far pages are not.
 * 3. Scrolled to page 7: 6, 7 and 8 are read; the pages scrolled past (3-5) are not.
 * 4. Book view at pages 5-6: those and their neighbours are read.
 * 5. A scan marked Urdu (/Lang ur): nothing is read on its own (OCR reads English only).
 * 6. A drag on that scan (Highlight armed) reads nothing either: one muted line says why.
 * Exits 0 when every check passes, 1 otherwise, printing each result.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const W = 1200;
const H = 1600;

/** An n-page scan: a picture of a line of English on each page, no text layer. `lang` sets /Lang. */
async function scannedPdf(n, lang) {
  const w = new BrowserWindow({ show: false });
  await w.loadURL('data:text/html,<html><body></body></html>');
  const png = await w.webContents.executeJavaScript(`(() => {
    const c = document.createElement('canvas'); c.width = ${W}; c.height = ${H};
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111'; g.font = '48px serif'; g.fillText('The harbour lantern burned all night', 100, 300);
    return c.toDataURL('image/png');
  })()`);
  w.destroy();
  const { PDFDocument, PDFName, PDFString } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(Buffer.from(png.split(',')[1], 'base64'));
  for (let i = 0; i < n; i++) doc.addPage([W / 2, H / 2]).drawImage(image, { x: 0, y: 0, width: W / 2, height: H / 2 });
  if (lang) doc.catalog.set(PDFName.of('Lang'), PDFString.of(lang));
  return Buffer.from(await doc.save());
}

async function textPdf() {
  const { PDFDocument, StandardFonts } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  for (let i = 1; i <= 4; i++) doc.addPage([420, 595]).drawText(`Plain text page ${i}`, { x: 40, y: 520, size: 14, font });
  return Buffer.from(await doc.save());
}

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-ocrauto-'));
  Object.assign(process.env, { MARGINALIA_STORE_DIR: store, MARGINALIA_EMBEDDED: '1', NODE_ENV: 'production', PORT: '0' });
  const server = require(path.join(ROOT, 'dist', 'server.cjs'));
  const port = await server.startServer({ staticRoot: path.join(ROOT, 'dist') });
  const base = `http://127.0.0.1:${port}`;
  const api = async (p, method = 'GET', body) => {
    const res = await fetch(`${base}/api${p}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return res.json();
  };
  const version = /CURRENT_APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'src', 'data', 'changelog.ts'), 'utf8'))[1];
  await api('/settings', 'PUT', { settings: { name: 'Reader', lastSeenVersion: version, activeThemes: [{ id: 'love', name: 'Love', color: '#b5527a' }] } });
  const upload = async (title, file, bytes) => {
    const d = await api('/documents', 'POST', { title, text: title, format: 'PDF', filename: file });
    await fetch(`${base}/api/documents/${d.id}/original?filename=${file}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
    return d;
  };
  const read = (id) => (fs.existsSync(path.join(store, 'ocr', id)) ? fs.readdirSync(path.join(store, 'ocr', id)).map((f) => Number(f.replace('.json', ''))).sort((a, b) => a - b) : []);

  const win = new BrowserWindow({ width: 1400, height: 900, show: false, webPreferences: { offscreen: true } });
  const js = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
  const until = async (fn, ms) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(300)) {
      const v = await fn();
      if (v) return v;
    }
    return null;
  };
  const open = async (doc) => {
    const s = { currentScreen: 'workspace', analysisDoc: { title: doc.title, text: '', format: 'PDF', docId: doc.id }, uploadedLibrary: [], documentNotes: {}, documentFormats: {} };
    await win.loadURL(base);
    await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(s))}); return true;`);
    await win.loadURL(base);
    await until(() => js(`return Boolean(document.querySelector('[data-page-number="1"][data-painted], [data-page-number][data-painted]'));`), 20000);
  };

  // 1. Text of its own: nothing read.
  const plain = await upload('Plain', 'plain.pdf', await textPdf());
  await open(plain);
  await sleep(5000);
  check('A PDF with text of its own: nothing is read', read(plain.id).length === 0 && !fs.existsSync(path.join(store, 'ocr', plain.id)), JSON.stringify(read(plain.id)));

  // 2. A scan at page 1.
  const scan = await upload('Harbour', 'harbour.pdf', await scannedPdf(8));
  await open(scan);
  const first = await until(() => (read(scan.id).includes(1) && read(scan.id).includes(2) ? read(scan.id) : null), 90000);
  await sleep(4000);
  const settled = read(scan.id);
  check('A scan opened at page 1: pages 1 and 2 are read, far pages are not', Boolean(first) && settled.every((n) => n <= 3) && !settled.includes(5), JSON.stringify({ first, settled }));
  const langs = settled.map((n) => JSON.parse(fs.readFileSync(path.join(store, 'ocr', scan.id, `${n}.json`), 'utf8')).langs);
  check('An English scan is read in English', langs.length > 0 && langs.every((l) => l === 'eng'), JSON.stringify(langs));

  // 3. Scrolled to page 7.
  await js(`document.querySelector('[data-page-number="7"]').scrollIntoView({ block: 'start' }); return true;`);
  const at7 = await until(() => ([6, 7, 8].every((n) => read(scan.id).includes(n)) ? read(scan.id) : null), 120000);
  await sleep(2000);
  const after7 = read(scan.id);
  check('Scrolled to page 7: 6, 7 and 8 are read; pages scrolled past (4, 5) are not', Boolean(at7) && !after7.includes(4) && !after7.includes(5), JSON.stringify({ after7 }));

  // 4. Book view at pages 5-6 (a fresh copy, so nothing is read yet).
  const book = await upload('Harbour book', 'harbour-book.pdf', await scannedPdf(8));
  await api(`/documents/${book.id}/reading-state`, 'PUT', { readingState: { scale: 1, page: 5, viewMode: 'spread' } });
  await open(book);
  const shown = await js(`return [...document.querySelectorAll('[data-page-number]')].filter((p) => !p.dataset.offstage).map((p) => Number(p.dataset.pageNumber));`);
  const bookRead = await until(() => (shown.every((n) => read(book.id).includes(n)) ? read(book.id) : null), 120000);
  await sleep(2000);
  const bookAfter = read(book.id);
  const far = bookAfter.filter((n) => n < Math.min(...shown) - 1 || n > Math.max(...shown) + 1);
  check('Book view: the pages shown are read, nothing far from them', Boolean(bookRead) && shown.length > 0 && far.length === 0, JSON.stringify({ shown, bookAfter }));

  // 5. Urdu: nothing read on its own.
  const urdu = await upload('Urdu scan', 'urdu.pdf', await scannedPdf(3, 'ur'));
  await open(urdu);
  await sleep(8000);
  check('A scan marked Urdu (/Lang ur): nothing is read on its own', read(urdu.id).length === 0, JSON.stringify(read(urdu.id)));

  // 6. The reader's drag on it: nothing read, one muted line.
  const wc = win.webContents;
  wc.focus();
  for (const type of ['keyDown', 'char', 'keyUp']) wc.sendInputEvent({ type, keyCode: 'H' });
  await sleep(300);
  const r = await js(`const b = document.querySelector('[data-page-number="1"]').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height };`);
  const a = { x: Math.round(r.x + r.w * 0.25), y: Math.round(r.y + r.h * 0.176) };
  const b = { x: Math.round(r.x + r.w * 0.93), y: a.y };
  wc.sendInputEvent({ type: 'mouseMove', x: a.x, y: a.y });
  wc.sendInputEvent({ type: 'mouseDown', x: a.x, y: a.y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 10; i++) {
    wc.sendInputEvent({ type: 'mouseMove', x: Math.round(a.x + ((b.x - a.x) * i) / 10), y: a.y, button: 'left' });
    await sleep(20);
  }
  wc.sendInputEvent({ type: 'mouseUp', x: b.x, y: b.y, button: 'left', clickCount: 1 });
  const said = await js(`for (const t0 = performance.now(); performance.now() - t0 < 10000; await new Promise((r) => setTimeout(r, 150))) { const t = document.querySelector('[data-page-number="1"] [data-ocr-page]')?.textContent; if (t) return t; } return null;`);
  await sleep(3000);
  check(
    "A drag on that scan reads nothing and says right-to-left books aren't supported",
    /right-to-left books aren.t supported yet/.test(said || '') && read(urdu.id).length === 0 && !fs.existsSync(path.join(store, 'ocr', urdu.id)),
    JSON.stringify({ said, read: read(urdu.id) })
  );

  win.destroy();
  fs.rmSync(store, { recursive: true, force: true });
}

app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  try {
    await main();
  } catch (err) {
    check('suite ran', false, err?.stack || String(err));
  }
  const failed = results.filter((r) => !r).length;
  console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nall ${results.length} checks passed`);
  app.exit(failed ? 1 : 0);
});
