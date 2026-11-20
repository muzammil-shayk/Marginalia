/**
 * End-to-end checks of the "make text selectable" controls for scanned PDFs (pdf/OcrControls.tsx),
 * in the real app (Electron + the built server), on a throwaway library in the temp folder.
 * The OCR engine itself is checked in e2e-ocr.cjs; this drives it the way a reader does.
 *
 *   npm run test:e2e        (builds first)
 *
 * 1. Nothing is read on opening; each scanned page offers "Make text selectable".
 * 2. One page's button reads that page (with progress), then its words are selectable and the
 *    button goes.
 * 3. The toolbar panel offers the whole document, with honest copy; focus moves into it, Tab
 *    stays inside, Escape returns to its button; it reads what is left.
 * 4. A PDF with text of its own shows no page button.
 * 5. Cancel on a page read stops it: the button offers again and nothing is saved.
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

const LINE = 'The quick brown fox jumps over the lazy dog';
const W = 1200;
const H = 1600;

/** A one-page scan: a picture of a line of English, no text layer. Drawn in an Electron canvas. */
async function scannedPdf() {
  const w = new BrowserWindow({ show: false });
  await w.loadURL('data:text/html,<html><body></body></html>');
  const png = await w.webContents.executeJavaScript(`(() => {
    const c = document.createElement('canvas'); c.width = ${W}; c.height = ${H};
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111'; g.font = '48px serif'; g.fillText(${JSON.stringify(LINE)}, 100, 300);
    return c.toDataURL('image/png');
  })()`);
  w.destroy();
  const { PDFDocument } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(Buffer.from(png.split(',')[1], 'base64'));
  for (let i = 0; i < 2; i++) doc.addPage([W / 2, H / 2]).drawImage(image, { x: 0, y: 0, width: W / 2, height: H / 2 });
  return Buffer.from(await doc.save());
}

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-ocrui-'));
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
  const pdf = await api('/documents', 'POST', { title: 'Scan', text: 'A scanned page', format: 'PDF', filename: 'scan.pdf' });
  await fetch(`${base}/api/documents/${pdf.id}/original?filename=scan.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await scannedPdf() });

  const win = new BrowserWindow({ width: 1400, height: 900, show: false, webPreferences: { offscreen: true } });
  const js = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
  const until = (code, ms = 20000) =>
    js(`
      for (const t0 = performance.now(); performance.now() - t0 < ${ms}; await new Promise((r) => setTimeout(r, 150))) { const v = await (async () => { ${code} })(); if (v) return v; }
      return null;
    `);
  const s = { currentScreen: 'workspace', analysisDoc: { title: pdf.title, text: '', format: 'PDF', docId: pdf.id }, uploadedLibrary: [], documentNotes: {}, documentFormats: {} };
  await win.loadURL(base);
  await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(s))}); return true;`);
  await win.loadURL(base);
  if (!(await until(`return document.querySelector('[data-page-number="1"][data-painted]');`))) throw new Error('page 1 never painted');
  await sleep(1500);
  const ocrOnDisk = () => (fs.existsSync(path.join(store, 'ocr', pdf.id)) ? fs.readdirSync(path.join(store, 'ocr', pdf.id)) : []);

  const pill = (n) => js(`const p = document.querySelector('[data-page-number="${n}"] [data-ocr-page]'); return p ? p.textContent : null;`);
  /** Pages away from the view are not painted (and show nothing): look at one in view. */
  const view = async (n) => {
    await js(`document.querySelector('[data-page-number="${n}"]').scrollIntoView({ block: 'start' }); return true;`);
    await until(`return document.querySelector('[data-page-number="${n}"][data-painted]');`);
    await sleep(500);
  };
  const clickIn = (n, text) => js(`const b = [...document.querySelectorAll('[data-page-number="${n}"] [data-ocr-page] button')].find((x) => x.textContent.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true;`);
  await view(2);
  const offer2 = await pill(2);
  await view(1);
  const offers = [await pill(1), offer2];
  check('Each scanned page offers "Make text selectable"; nothing is read on opening', offers.every((t) => t && t.includes('Make text selectable')) && ocrOnDisk().length === 0, JSON.stringify({ offers, saved: ocrOnDisk() }));

  // 2. Page 1 by its own button.
  await clickIn(1, 'Make text selectable');
  const reading = await until(`const t = document.querySelector('[data-page-number="1"] [data-ocr-page] [role="status"]')?.textContent; return t && t.includes('Reading this page') ? t : null;`, 10000);
  const page1Words = await until(`const n = document.querySelectorAll('[data-page-number="1"] .marginalia-text-layer span').length; return n > 3 && !document.querySelector('[data-page-number="1"] [data-ocr-page]') ? n : null;`, 90000);
  await view(2);
  const page2Still = await pill(2);
  check('Page 1 button: progress, then selectable words and the button goes; page 2 still offers it', Boolean(reading) && Boolean(page1Words) && Boolean(page2Still) && ocrOnDisk().length === 1, JSON.stringify({ reading, page1Words, page2Still: Boolean(page2Still), saved: ocrOnDisk() }));

  // 3. The toolbar panel: what OCR can and cannot do, and the rest of the document.
  const opened = await js(`
    const b = document.querySelector('button[aria-label="Make scanned pages selectable"]');
    if (!b) return { button: false };
    b.click();
    await new Promise((r) => setTimeout(r, 400));
    const panel = document.querySelector('[data-ocr-menu]');
    return { button: true, text: panel?.textContent ?? '', inApp: Boolean(panel?.closest('#app-container')) };
  `);
  check(
    'The toolbar panel offers the whole document and is honest about Urdu and page edits',
    opened.button && /Make whole document selectable/.test(opened.text) && /Urdu \(Nastaliq\)/.test(opened.text) && /Inserting or deleting a page clears/.test(opened.text) && opened.inApp,
    JSON.stringify({ saved: ocrOnDisk(), ...opened, text: opened.text?.slice(0, 60) })
  );

  // Keyboard: focus moved into the panel, Tab stays inside it, Escape closes it back to its button.
  const wc = win.webContents;
  const press = async (keyCode, modifiers = []) => {
    wc.focus();
    wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    await sleep(150);
  };
  const inPanel = () => js(`return Boolean(document.activeElement?.closest('[data-ocr-menu]'));`);
  const focusedIn = await inPanel();
  await press('Tab');
  await press('Tab');
  await press('Tab', ['shift']);
  const stillIn = await inPanel();
  await press('Escape');
  const back = await js(`return { closed: !document.querySelector('[data-ocr-menu]'), onButton: document.activeElement?.getAttribute('aria-label') === 'Make scanned pages selectable' };`);
  check('Panel keyboard: focus moves in, Tab stays inside, Escape closes it back to its toolbar button', focusedIn && stillIn && back.closed && back.onButton, JSON.stringify({ focusedIn, stillIn, ...back }));
  await js(`document.querySelector('button[aria-label="Make scanned pages selectable"]').click(); return true;`);
  await sleep(400);

  await js(`[...document.querySelectorAll('[data-ocr-menu] button')].find((b) => b.textContent.includes('Make whole document selectable')).click(); return true;`);
  const progress = await until(`const t = document.querySelector('[data-ocr-menu] [role="status"]')?.textContent || ''; return /Reading page \\d of 2/.test(t) ? t : null;`, 15000);
  const done = await until(`const t = document.querySelector('[data-ocr-menu]')?.textContent || ''; return t.includes('Done: every page of 2') ? t : null;`, 120000);
  const words = await until(`const n = document.querySelectorAll('[data-page-number="2"] .marginalia-text-layer span').length; return n > 3 ? n : null;`, 10000);
  const page2Gone = !(await pill(2));
  check('The panel reads the rest (page n of N): both pages saved, no page button left', Boolean(progress) && Boolean(done) && Boolean(words) && page2Gone && ocrOnDisk().length === 2, JSON.stringify({ progress, done: Boolean(done), words, page2Gone, saved: ocrOnDisk() }));

  // 4. A PDF with text of its own.
  const { PDFDocument, StandardFonts } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const textDoc = await PDFDocument.create();
  textDoc.addPage([420, 595]).drawText('Plain text, nothing to read', { x: 40, y: 520, size: 14, font: await textDoc.embedFont(StandardFonts.TimesRoman) });
  const plain = await api('/documents', 'POST', { title: 'Plain', text: 'Plain', format: 'PDF', filename: 'plain.pdf' });
  await fetch(`${base}/api/documents/${plain.id}/original?filename=plain.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.from(await textDoc.save()) });
  const s2 = { ...s, analysisDoc: { title: plain.title, text: '', format: 'PDF', docId: plain.id } };
  await win.loadURL(base);
  await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(s2))}); return true;`);
  await win.loadURL(base);
  await until(`return document.querySelector('[data-page-number="1"] .marginalia-text-layer span');`);
  await sleep(800);
  check('A PDF with its own text shows no page button', (await pill(1)) === null);

  // 5. Cancel, on a second scan (last: it must not hold up the checks above if it misbehaves).
  const scan2 = await api('/documents', 'POST', { title: 'Scan two', text: 'A scanned page', format: 'PDF', filename: 'scan2.pdf' });
  await fetch(`${base}/api/documents/${scan2.id}/original?filename=scan2.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await scannedPdf() });
  const ocrOnDisk2 = () => (fs.existsSync(path.join(store, 'ocr', scan2.id)) ? fs.readdirSync(path.join(store, 'ocr', scan2.id)) : []);
  await win.loadURL(base);
  await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify({ ...s, analysisDoc: { title: scan2.title, text: '', format: 'PDF', docId: scan2.id } }))}); return true;`);
  await win.loadURL(base);
  await until(`return document.querySelector('[data-page-number="2"]');`);
  await view(2);
  await clickIn(2, 'Make text selectable');
  await until(`return document.querySelector('[data-page-number="2"] [data-ocr-page] [role="status"]');`, 10000);
  await clickIn(2, 'Cancel');
  const afterCancel = await until(`const t = document.querySelector('[data-page-number="2"] [data-ocr-page]')?.textContent; return t && t.includes('Make text selectable') ? t : null;`, 10000);
  await sleep(800);
  check('Cancel stops a page read: its button offers again and nothing is saved', Boolean(afterCancel) && ocrOnDisk2().length === 0, JSON.stringify({ afterCancel: Boolean(afterCancel), saved: ocrOnDisk2() }));


  win.destroy();
  fs.rmSync(store, { recursive: true, force: true });
}

app.disableHardwareAcceleration();
// The scan is drawn in a window of its own; closing it must not quit the run.
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
