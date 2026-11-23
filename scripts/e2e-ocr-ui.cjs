/**
 * End-to-end checks of reading scanned PDF pages (OCR) the way a reader does, in the real app
 * (Electron + the built server), on a throwaway library in the temp folder, with real mouse drags.
 * The OCR engine itself is checked in e2e-ocr.cjs.
 *
 *   npm run test:e2e        (builds first)
 *
 * English scans, so pages in view are also read on their own (useAutoOcr): page 1 is a dense page
 * that takes a while, so a drag on page 2 meanwhile is the reader's read, which goes first.
 * 1. Nothing sits over a scanned page at rest (no button; an empty live region waits).
 * 2. Dragging across a line of page 2 with Highlight armed, while page 1 is read on its own, reads
 *    page 2 (small progress), then the same drag is replayed: a highlight with the line's words.
 * 3. The toolbar panel offers the whole document, with honest copy; focus moves into it, Tab
 *    stays inside, Escape returns to its button; it reads what is left.
 * 4. A drag on a PDF with text of its own reads nothing and shows no progress.
 * 5. Cancel on a page read stops it: the progress goes and nothing is saved.
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

/** A six-page scan, no text layer: page 1 a dense page of English, the rest one line. Small pages, so two show at once. */
async function scannedPdf() {
  const w = new BrowserWindow({ show: false });
  await w.loadURL('data:text/html,<html><body></body></html>');
  const draw = (dense) => w.webContents.executeJavaScript(`(() => {
    const c = document.createElement('canvas'); c.width = ${W}; c.height = ${H};
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111'; g.font = '${dense ? 28 : 48}px serif';
    if (${dense}) for (let i = 0; i < 44; i++) g.fillText('Line ' + i + ' of a long page the reader has not reached yet', 60, 60 + i * 34);
    else g.fillText(${JSON.stringify(LINE)}, 100, 300);
    return c.toDataURL('image/png');
  })()`);
  const pngs = [await draw(true), await draw(false)];
  w.destroy();
  const { PDFDocument } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  const [dense, line] = await Promise.all(pngs.map((png) => doc.embedPng(Buffer.from(png.split(',')[1], 'base64'))));
  for (let i = 0; i < 6; i++) doc.addPage([W / 4, H / 4]).drawImage(i === 0 ? dense : line, { x: 0, y: 0, width: W / 4, height: H / 4 });
  return Buffer.from(await doc.save());
}

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-ocrui-'));
  try {
    await run(store);
  } finally {
    fs.rmSync(store, { recursive: true, force: true });
  }
}

async function run(store) {
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
  // Small enough that pages 1 and 2 are both on screen.
  const twoInView = async () => {
    await until(`return document.querySelector('[data-page-number="1"][data-painted]');`);
    for (let i = 0; i < 12 && (await js(`return document.querySelector('[data-page-number="1"]').getBoundingClientRect().height;`)) > 380; i++) {
      // The toolbar folds zoom into More at this width.
      await js(`if (!document.querySelector('button[aria-label="Zoom out"]')) document.querySelector('[aria-label^="More:"]')?.click(); await new Promise((r) => setTimeout(r, 200)); document.querySelector('button[aria-label="Zoom out"]')?.click(); return true;`);
      await sleep(150);
    }
    return until(`return document.querySelector('[data-page-number="2"][data-painted]');`);
  };
  if (!(await twoInView())) throw new Error('page 2 never painted ' + JSON.stringify(await js(`return { z: [...document.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label')).filter((l) => /zoom/i.test(l)), p: [...document.querySelectorAll('[data-page-number]')].map((e) => [e.dataset.pageNumber, Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().height), e.hasAttribute('data-painted')]) };`)));
  const ocrOnDisk = () => (fs.existsSync(path.join(store, 'ocr', pdf.id)) ? fs.readdirSync(path.join(store, 'ocr', pdf.id)) : []);

  const pill = (n) => js(`const p = document.querySelector('[data-page-number="${n}"] [data-ocr-page]'); return p ? p.textContent : null;`);
  const marks = async (id) => (await api(`/documents/${id}/annotations`)).annotations || [];
  const wc0 = win.webContents;
  /** A real mouse drag across page n, from and to page fractions. */
  const dragOn = async (n, from, to) => {
    const r = await js(`const b = document.querySelector('[data-page-number="${n}"]').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height };`);
    const at = ([fx, fy]) => ({ x: Math.round(r.x + r.w * fx), y: Math.round(r.y + r.h * fy) });
    const a = at(from);
    const b = at(to);
    wc0.sendInputEvent({ type: 'mouseMove', x: a.x, y: a.y });
    wc0.sendInputEvent({ type: 'mouseDown', x: a.x, y: a.y, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 10; i++) {
      wc0.sendInputEvent({ type: 'mouseMove', x: Math.round(a.x + ((b.x - a.x) * i) / 10), y: Math.round(a.y + ((b.y - a.y) * i) / 10), button: 'left' });
      await sleep(20);
    }
    wc0.sendInputEvent({ type: 'mouseUp', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await sleep(100);
  };
  const keyTap = async (keyCode) => {
    wc0.focus();
    wc0.sendInputEvent({ type: 'keyDown', keyCode });
    wc0.sendInputEvent({ type: 'char', keyCode });
    wc0.sendInputEvent({ type: 'keyUp', keyCode });
    await sleep(200);
  };
  // The line of the scan runs from x ~330 to 1100 of 1200, y ~227 to 337 of 1600: its middle is ~0.176.
  const LINE_FROM = [0.25, 0.176];
  const LINE_TO = [0.93, 0.176];
  const clickIn = (n, text) => js(`const b = [...document.querySelectorAll('[data-page-number="${n}"] [data-ocr-page] button')].find((x) => x.textContent.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true;`);
  const rest2 = await pill(2);
  // An empty live region waits on the page, so the reading progress is announced when it starts.
  const live = await js(`const l = document.querySelector('[data-page-number="2"] [data-ocr-live]'); return l ? { role: l.getAttribute('role'), text: l.textContent } : null;`);
  check(
    'Nothing sits over a scanned page at rest (an empty live region waits for progress)',
    rest2 === null && !ocrOnDisk().includes('2.json') && live?.role === 'status' && live.text === '',
    JSON.stringify({ rest2, live, saved: ocrOnDisk() })
  );

  // 2. A drag across the line with Highlight armed, while page 1 is read on its own: page 2 is read first, then the drag becomes a highlight.
  await keyTap('H');
  await dragOn(2, LINE_FROM, LINE_TO);
  const reading = await until(`const t = document.querySelector('[data-page-number="2"] [data-ocr-live]')?.textContent; const chip = document.querySelector('[data-page-number="2"] [data-ocr-page]')?.textContent; return t && t.includes('Reading this page') && chip?.includes('Reading this page') ? t : null;`, 10000);
  const hl = await (async () => {
    for (const t0 = Date.now(); Date.now() - t0 < 90000; await sleep(300)) {
      const m = (await marks(pdf.id)).filter((a) => a.kind === 'highlight');
      if (m.length) return m;
    }
    return [];
  })();
  const quote = hl[0]?.quote || '';
  check(
    'Dragging on a scanned page reads it (small progress), then the drag is a highlight of the line on that page',
    Boolean(reading) && hl.length === 1 && hl[0].page === 2 && /quick/i.test(quote) && /brown/i.test(quote) && ocrOnDisk().includes('2.json'),
    JSON.stringify({ reading, marks: hl.length, quote, saved: ocrOnDisk() })
  );
  await keyTap('V');

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
    'The toolbar panel offers the whole document and is honest about right-to-left books and page edits',
    opened.button && /Make whole document selectable/.test(opened.text) && /right-to-left books aren.t supported yet/.test(opened.text) && /Inserting or deleting a page clears/.test(opened.text) && opened.inApp,
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
  const progress = await until(`const t = document.querySelector('[data-ocr-menu] [role="status"]')?.textContent || ''; return /Reading page \\d of 6/.test(t) ? t : null;`, 15000);
  const done = await until(`const t = document.querySelector('[data-ocr-menu]')?.textContent || ''; return t.includes('Done: every page of 6') ? t : null;`, 120000);
  const words = await until(`const n = document.querySelectorAll('[data-page-number="2"] .marginalia-text-layer span').length; return n > 3 ? n : null;`, 10000);
  const page2Gone = !(await pill(2));
  check('The panel reads the rest (page n of N): every page saved, nothing left over the page', Boolean(progress) && Boolean(done) && Boolean(words) && page2Gone && ocrOnDisk().length === 6, JSON.stringify({ progress, done: Boolean(done), words, page2Gone, saved: ocrOnDisk() }));
  const savedLangs = ocrOnDisk().map((f) => JSON.parse(fs.readFileSync(path.join(store, 'ocr', pdf.id, f), 'utf8')).langs);
  check('Every page is read in English', savedLangs.length === 6 && savedLangs.every((l) => l === 'eng'), JSON.stringify(savedLangs));

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
  await dragOn(1, [0.1, 0.12], [0.6, 0.12]);
  await sleep(1500);
  check('A drag on a PDF with its own text reads nothing and shows no progress', (await pill(1)) === null && !fs.existsSync(path.join(store, 'ocr', plain.id)), JSON.stringify({ pill: await pill(1) }));
  await js(`getSelection().removeAllRanges(); return true;`);

  // 5. Cancel, on a second scan (last: it must not hold up the checks above if it misbehaves).
  const scan2 = await api('/documents', 'POST', { title: 'Scan two', text: 'A scanned page', format: 'PDF', filename: 'scan2.pdf' });
  await fetch(`${base}/api/documents/${scan2.id}/original?filename=scan2.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await scannedPdf() });
  const ocrOnDisk2 = () => (fs.existsSync(path.join(store, 'ocr', scan2.id)) ? fs.readdirSync(path.join(store, 'ocr', scan2.id)) : []);
  await win.loadURL(base);
  await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify({ ...s, analysisDoc: { title: scan2.title, text: '', format: 'PDF', docId: scan2.id } }))}); return true;`);
  await win.loadURL(base);
  await twoInView();
  await dragOn(2, LINE_FROM, LINE_TO);
  await until(`return document.querySelector('[data-page-number="2"] [data-ocr-page]');`, 10000);
  await clickIn(2, 'Cancel');
  const afterCancel = await until(`return document.querySelector('[data-page-number="2"] [data-ocr-page]') ? null : 'gone';`, 10000);
  check('Cancel stops a page read: the progress goes and nothing of it is saved', Boolean(afterCancel) && !ocrOnDisk2().includes('2.json'), JSON.stringify({ afterCancel: Boolean(afterCancel), saved: ocrOnDisk2() }));

  // 6. Cancel on an automatic read: the reader's Cancel lets auto-OCR go on, so one starts again; cancelling it pauses auto-OCR here.
  const autoPage = await until(`const c = [...document.querySelectorAll('[data-ocr-page]')].find((x) => [...x.querySelectorAll('button')].some((b) => b.textContent.includes('Cancel'))); return c ? c.closest('[data-page-number]').dataset.pageNumber : null;`, 15000);
  const savedAtCancel = ocrOnDisk2().length;
  if (autoPage) await clickIn(autoPage, 'Cancel');
  await until(`return document.querySelector('[data-ocr-page]') ? null : 'gone';`, 5000);
  const restarted = await until(`return document.querySelector('[data-ocr-page]') ? 'chip' : null;`, 2500);
  await sleep(500);
  check(
    'Cancel on an automatic read: no page starts reading again for 2.5 s and nothing more is saved',
    Boolean(autoPage) && !restarted && ocrOnDisk2().length === savedAtCancel,
    JSON.stringify({ autoPage, restarted, savedAtCancel, saved: ocrOnDisk2() })
  );

  win.destroy();
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
