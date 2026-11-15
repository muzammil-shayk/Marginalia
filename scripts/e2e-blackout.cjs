/**
 * End-to-end checks of "Black it out" in the PDF workspace, in the real app (Electron + the built
 * server), on a throwaway library in the temp folder — never the reader's own.
 *
 *   npm run test:e2e        (builds first)
 *
 * 1. Words mode: selecting text with it armed covers each selected line with a solid bar.
 * 2. Exporting asks first, and says the words are still underneath.
 * 3. "Keep the text underneath": the hidden words are still in the file (the warning is true).
 * 4. "Remove the hidden text too": the hidden words are nowhere in the file, in any stream, while
 *    the page without a black-out keeps its text.

 * 5. Class pack over a black-out: the word is nowhere in the pack's JSON or PDF, and the pack opens.
 * Exits 0 when every check passes, 1 otherwise, printing each result.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const SECRET = 'Ozymandias';
async function samplePdf() {
  const { PDFDocument, StandardFonts } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const one = doc.addPage([420, 595]);
  one.drawText(`My name is ${SECRET}, King of Kings`, { x: 40, y: 520, size: 14, font });
  const two = doc.addPage([420, 595]);
  two.drawText('Nothing beside remains', { x: 40, y: 520, size: 14, font });
  return Buffer.from(await doc.save());
}

/** Every stream in a PDF, inflated where it can be, as latin1 text (plus the raw file). */
function pdfText(bytes) {
  const raw = bytes.toString('latin1');
  const out = [raw];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    const chunk = bytes.subarray(start, end);
    try {
      out.push(zlib.inflateSync(chunk).toString('latin1'));
    } catch {
      out.push(chunk.toString('latin1'));
    }
  }
  return out.join('\n');
}
/** The word as pdf-lib writes standard-font text: a literal or a hex string. */
const hasWord = (text, word) => text.includes(word) || text.toUpperCase().includes(Buffer.from(word, 'latin1').toString('hex').toUpperCase());

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-blackout-'));
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-dl-'));
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
  const pdf = await api('/documents', 'POST', { title: 'King', text: 'My name', format: 'PDF', filename: 'king.pdf' });
  await fetch(`${base}/api/documents/${pdf.id}/original?filename=king.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await samplePdf() });

  const win = new BrowserWindow({ width: 1600, height: 900, show: false, webPreferences: { offscreen: true } });
  let saved = null;
  win.webContents.session.on('will-download', (_e, item) => {
    const file = path.join(downloads, `${Date.now()}-${item.getFilename()}`);
    item.setSavePath(file);
    item.once('done', () => (saved = file));
  });
  const js = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
  /**
   * Polls until the tool and page 1's text are there, up to 20 s (slow runners outlast a fixed
   * sleep). The text layer div is mounted empty; its spans come after the page paints.
   */
  const ready = async () => {
    const ok = await js(`
      for (const t0 = performance.now(); performance.now() - t0 < 20000; await new Promise((r) => setTimeout(r, 100)))
        if (document.querySelector('button[aria-label^="Black it out"]') && document.querySelector('[data-page-number="1"] .marginalia-text-layer span')) return true;
      return false;
    `);
    if (!ok) throw new Error('the workspace never showed Black it out and page 1');
  };
  const session = { currentScreen: 'workspace', analysisDoc: { title: pdf.title, text: '', format: 'PDF', docId: pdf.id }, uploadedLibrary: [], documentNotes: {}, documentFormats: {} };
  await win.loadURL(base);
  await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(session))}); return true;`);
  await win.loadURL(base);
  await ready();

  // 1. Words mode.
  await js(`
    const tool = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('Black it out') && !(b.getAttribute('aria-label') || '').includes('options'));
    tool.click();
    await new Promise((r) => setTimeout(r, 300));
    let words = [...document.querySelectorAll('button[role="radio"]')].find((b) => b.textContent.trim() === 'Words');
    if (!words) { document.querySelector('button[aria-label="Black it out options"]').click(); await new Promise((r) => setTimeout(r, 300)); words = [...document.querySelectorAll('button[role="radio"]')].find((b) => b.textContent.trim() === 'Words'); }
    words.click();
    await new Promise((r) => setTimeout(r, 200));
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return true;
  `);
  await sleep(400);
  await js(`
    const layer = document.querySelector('[data-page-number="1"] .marginalia-text-layer');
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
    let node; for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.includes('${SECRET}')) { node = n; break; }
    const r = document.createRange();
    r.setStart(node, node.data.indexOf('${SECRET}'));
    r.setEnd(node, node.data.indexOf('${SECRET}') + ${SECRET.length});
    getSelection().removeAllRanges(); getSelection().addRange(r);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  `);
  await sleep(1500);
  const marks = (await api(`/documents/${pdf.id}/annotations`)).annotations;
  const bars = marks.filter((m) => m.blackout && m.kind === 'rect' && m.filled);
  check('Words: the selected line gets a solid bar, with no quote kept', bars.length === 1 && bars[0].page === 1 && !bars[0].quote, JSON.stringify(marks.map((m) => ({ kind: m.kind, blackout: m.blackout, quote: m.quote }))));

  // 2–4. Export.
  const exportWith = async (choice) => {
    saved = null;
    await js(`
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const open = document.querySelector('button[aria-label="Export"]');
      if (open) { open.click(); await new Promise((r) => setTimeout(r, 300)); [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save PDF').click(); }
      else [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Export PDF')).click();
      return true;
    `);
    await sleep(600);
    const dialog = await js(`return document.querySelector('[aria-labelledby="blackout-export-title"]')?.textContent ?? null;`);
    await js(`[...document.querySelectorAll('[aria-labelledby="blackout-export-title"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(choice)}).click(); return true;`);
    for (let i = 0; i < 60 && !saved; i++) await sleep(250);
    return { dialog, file: saved };
  };
  const kept = await exportWith('Keep the text underneath');
  check('Export asks first, and says the words are still underneath', Boolean(kept.dialog && kept.dialog.includes('still in the PDF underneath')), kept.dialog?.slice(0, 80));
  const keptText = kept.file ? pdfText(fs.readFileSync(kept.file)) : '';
  check('Keeping the text: the hidden word is still in the file, as the dialog warned', hasWord(keptText, SECRET));

  const red = await exportWith('Remove the hidden text too');
  const redBytes = red.file ? fs.readFileSync(red.file) : Buffer.alloc(0);
  const redText = pdfText(redBytes);
  const { PDFDocument } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = red.file ? await PDFDocument.load(redBytes) : null;
  check(
    'Removing it: the hidden word is nowhere in the file; both pages are there and page 2 keeps its text',
    Boolean(doc) && !hasWord(redText, SECRET) && !hasWord(redText, 'King of Kings') && doc.getPageCount() === 2 && hasWord(redText, 'Nothing beside remains'),
    red.file ? path.basename(red.file) : 'no file'
  );

  // 5. Class pack: a highlight over the blacked-out word whose quote names it. The saved pack (JSON
  //    and its embedded PDF) must not hold the word anywhere, and must still open as a document.
  const bar = bars[0];
  const over = { id: 'over1', page: 1, kind: 'highlight', color: '#b5527a', themeIds: ['love'], themeId: 'love', rects: [{ ...bar.box }], quote: `My name is ${SECRET}`, text: 'teacher note', createdAt: new Date().toISOString() };
  await fetch(`${base}/api/documents/${pdf.id}/annotations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ annotations: [...marks, over] }) });
  await win.loadURL(base);
  await ready();
  saved = null;
  const clicked = await js(`
    const open = document.querySelector('button[aria-label="Export"]');
    if (!open) return 'missing export';
    open.click(); await new Promise((r) => setTimeout(r, 400));
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().toLowerCase() === 'save class pack' && x.checkVisibility());
    if (!b) return 'missing pack button';
    b.click(); return 'ok';
  `);
  for (let i = 0; i < 80 && !saved; i++) await sleep(250);
  const packText = saved ? fs.readFileSync(saved, 'utf8') : '';
  const pack = packText ? JSON.parse(packText) : null;
  const packPdf = pack?.document?.original ? Buffer.from(pack.document.original, 'base64') : Buffer.alloc(0);
  const packPdfText = pdfText(packPdf);
  const packDoc = packPdf.length ? await PDFDocument.load(packPdf) : null;
  check('Class pack saved', Boolean(pack), clicked);
  check('Class pack JSON (text, quotes) holds no blacked-out word', Boolean(pack) && !packText.includes(SECRET) && !packText.includes('King of Kings'));
  check(
    'Class pack PDF: the word is in no stream; 2 pages; page 2 keeps its text',
    Boolean(packDoc) && !hasWord(packPdfText, SECRET) && !hasWord(packPdfText, 'King of Kings') && packDoc.getPageCount() === 2 && hasWord(packPdfText, 'Nothing beside remains')
  );
  const opened = await (await fetch(`${base}/api/class-packs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: packText || '{}' })).json();
  const studentDoc = opened.meta ? await api(`/documents/${opened.meta.id}`) : null;
  check('Class pack opens via POST /api/class-packs, with no blacked-out word stored', Boolean(studentDoc) && !JSON.stringify(studentDoc).includes(SECRET), opened.meta ? '' : JSON.stringify(opened).slice(0, 120));

  win.destroy();
  fs.rmSync(store, { recursive: true, force: true });
  fs.rmSync(downloads, { recursive: true, force: true });
  const failed = results.filter((ok) => !ok).length;
  console.log(failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`);
  app.exit(failed ? 1 : 0);
}

app.disableHardwareAcceleration();
app.whenReady().then(main).catch((err) => {
  console.error('e2e failed:', err);
  app.exit(1);
});
