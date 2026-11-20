/**
 * End-to-end checks of Find in document (Cmd/Ctrl+F) in the PDF workspace, in the real app
 * (Electron + the built server), on a throwaway library in the temp folder, with real key presses.
 *
 *   npm run test:e2e        (builds first)
 *
 * 1. Escape closes Find and clears its paint even when focus has left the find field.
 * 2. Book view: a hit on the next pair turns the book there, instead of landing on a hidden page.
 * 3. Collapsed to marks: a hit outside the strips opens the document at it, in view.
 * 4. A scanned page read by OCR is searched too, and its hit is painted on the OCR words.
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

/** Ten pages; "lantern" on pages 1 (bottom line), 4 and 9; page 10 is a picture with no text. */
async function samplePdf() {
  const { PDFDocument, StandardFonts } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  for (let n = 1; n <= 9; n++) {
    const page = doc.addPage([420, 595]);
    page.drawText(`Page ${n}: the river ran on and on`, { x: 40, y: 520, size: 14, font });
    page.drawText([1, 4, 9].includes(n) ? 'a lantern glowed by the water' : 'nothing glowed by the water', { x: 40, y: 100, size: 14, font });
  }
  // A 1x1 grey pixel stretched over the page: a "scan" with no text layer.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg==', 'base64');
  const image = await doc.embedPng(png);
  doc.addPage([420, 595]).drawImage(image, { x: 0, y: 0, width: 420, height: 595 });
  return Buffer.from(await doc.save());
}

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-find-'));
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
  const pdf = await api('/documents', 'POST', { title: 'River', text: 'the river ran on', format: 'PDF', filename: 'river.pdf' });
  await fetch(`${base}/api/documents/${pdf.id}/original?filename=river.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await samplePdf() });
  // Page 10's OCR, saved as the app saves it: "lantern" in the middle of the page.
  await api(`/documents/${pdf.id}/ocr/10`, 'PUT', { words: [{ text: 'old', x: 0.2, y: 0.5, w: 0.1, h: 0.03, line: 0 }, { text: 'lantern', x: 0.32, y: 0.5, w: 0.2, h: 0.03, line: 0 }], langs: 'eng+urd', createdAt: new Date().toISOString() });

  const win = new BrowserWindow({ width: Number(process.env.E2E_WIDTH) || 1280, height: 800, show: false, webPreferences: { offscreen: true } });
  const js = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
  const waitFor = (selector, ms = 20000) =>
    js(`
      for (const t0 = performance.now(); performance.now() - t0 < ${ms}; await new Promise((r) => setTimeout(r, 100)))
        if (document.querySelector(${JSON.stringify(selector)})) return true;
      return false;
    `);
  const open = async () => {
    const s = { currentScreen: 'workspace', analysisDoc: { title: pdf.title, text: '', format: 'PDF', docId: pdf.id }, uploadedLibrary: [], documentNotes: {}, documentFormats: {} };
    await win.loadURL(base);
    await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(s))}); return true;`);
    await win.loadURL(base);
    if (!(await waitFor('[data-page-number="1"][data-painted] .marginalia-text-layer span'))) throw new Error('page 1 never showed its text');
    await sleep(800);
  };
  const MOD = process.platform === 'darwin' ? 'meta' : 'control';
  const key = async (keyCode, modifiers = []) => {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    await sleep(150);
  };
  const find = async (query) => {
    await key('F', [MOD]);
    await sleep(400);
    for (const ch of query) win.webContents.sendInputEvent({ type: 'char', keyCode: ch });
    await sleep(900);
  };
  /** The current hit: its text, its page, and whether it can be seen (not offstage, not clipped by a strip, on screen). */
  const current = () => js(`
    const c = CSS.highlights.get('find-current');
    const r = c && [...c][0];
    if (!r) return null;
    const el = r.startContainer.parentElement;
    const box = r.getBoundingClientRect();
    const band = el.closest('.pdf-band')?.getBoundingClientRect();
    const seen = !el.closest('[data-offstage]') && box.width > 0 && box.top >= 0 && box.bottom <= innerHeight && (!band || (box.top >= band.top && box.bottom <= band.bottom));
    return { text: r.toString(), page: Number(el.closest('[data-page-number]')?.dataset.pageNumber), seen, count: document.querySelector('#find-count')?.textContent };
  `);

  // 1. Escape after focus left the field.
  await open();
  await find('lantern');
  await js(`document.activeElement.blur(); return true;`);
  await key('Escape');
  await sleep(400);
  const after = await js(`return { bar: !!document.querySelector('[role="search"]'), hit: CSS.highlights.get('find-hit')?.size ?? 0 };`);
  check('Escape closes Find and clears its paint with focus off the field', !after.bar && after.hit === 0, JSON.stringify(after));

  // 2. Book view: Enter to the hit on page 4 turns the book to pages 3-4.
  await api(`/documents/${pdf.id}/reading-state`, 'PUT', { readingState: { scale: 1, page: 1, viewMode: 'spread' } });
  await open();
  await find('lantern');
  // Hits are on pages 1, 4, 9 and 10; the book may open on any pair, so the check is relative.
  const shown = () => js(`return [...document.querySelectorAll('[data-page-number]')].filter((p) => !p.dataset.offstage).map((p) => Number(p.dataset.pageNumber));`);
  const from = Number((await current())?.count?.split(' of ')[0]);
  const pairBefore = await shown();
  const expected = [1, 4, 9, 10][from % 4];
  await key('Return');
  await sleep(2000);
  const book = await current();
  check('Book view: the next hit on another pair turns the book to it', !pairBefore.includes(expected) && book?.page === expected && book.seen, JSON.stringify({ pairBefore, expected, book }));
  await key('Escape');

  // 3. Collapsed to marks: a mark on page 1's top line; the hit on its bottom line is outside the strip.
  await api(`/documents/${pdf.id}/reading-state`, 'PUT', { readingState: { scale: 1, page: 1, viewMode: 'single' } });
  await api(`/documents/${pdf.id}/annotations`, 'PUT', {
    annotations: [{ id: 'm1', page: 1, kind: 'highlight', color: '#b5527a', themeIds: ['love'], rects: [{ x: 0.09, y: 0.1, w: 0.5, h: 0.03 }], quote: 'Page 1', author: 'Reader', createdAt: new Date().toISOString() }]
  });
  await open();
  await key('C');
  await sleep(2000);
  const strips = await js(`return document.querySelectorAll('[data-collapse-page]').length;`);
  await find('lantern');
  await sleep(1500);
  const col = await current();
  check('Collapsed: a hit outside the strips opens the document at it, in view', strips > 0 && col?.page === 1 && col.seen, JSON.stringify({ strips, col }));
  await key('Escape');

  // 4. The OCR page is searched: four hits, the last on page 10's OCR words.
  await open();
  await find('lantern');
  const total = await js(`return document.querySelector('#find-count')?.textContent;`);
  await key('Return', ['shift']);
  await sleep(2500);
  const ocr = await current();
  check('A page read by OCR is searched, its hit painted on the OCR words', /of 4$/.test(total || '') && ocr?.page === 10 && ocr.text === 'lantern' && ocr.seen, JSON.stringify({ total, ocr }));

  win.destroy();
  fs.rmSync(store, { recursive: true, force: true });
  const failed = results.filter((ok) => !ok).length;
  console.log(failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`);
  app.exit(failed ? 1 : 0);
}

app.disableHardwareAcceleration();
app.whenReady().then(main).catch((err) => {
  console.error('e2e failed:', err);
  app.exit(1);
});
