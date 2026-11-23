/**
 * End-to-end checks of OCR for scanned PDF pages, in the real app (Electron + the built server,
 * production CSP), on a throwaway library in the temp folder, with every request off this
 * machine blocked and recorded.
 *
 *   npm run test:e2e        (builds first)
 *
 * 1. Opening a scanned PDF marked Urdu (right to left: OCR reads English only) loads no OCR file,
 *    starts no worker and saves no OCR.
 * 2. The app serves its own OCR files (worker, core, English model), and no Urdu model.
 * 3. The bundled tesseract.js, pointed at those files, reads an English scan in the app window,
 *    and nothing is fetched from the web.
 * 4. A page's saved OCR words become a selectable layer; a highlight over them keeps their words.
 * 5. Urdu OCR words saved by an older version still load as a selectable layer and can be marked.
 * 6. Deleting a page in the app drops the OCR (page numbers moved): no old words stay on any page.
 * Exits 0 when every check passes, 1 otherwise, printing each result.
 */

const { app, BrowserWindow, session } = require('electron');
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
  const { PDFDocument, PDFName, PDFString } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  // Marked Urdu: OCR refuses right-to-left documents (ocrRefusal), so nothing here is read on its
  // own; the engine is driven by hand below.
  doc.catalog.set(PDFName.of('Lang'), PDFString.of('ur'));
  const image = await doc.embedPng(Buffer.from(png.split(',')[1], 'base64'));
  for (let i = 0; i < 2; i++) doc.addPage([W / 2, H / 2]).drawImage(image, { x: 0, y: 0, width: W / 2, height: H / 2 });
  return Buffer.from(await doc.save());
}

async function main() {
  const offMachine = [];
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const local = /^(https?:\/\/127\.0\.0\.1[:/]|data:|blob:|devtools:|chrome-extension:)/.test(details.url);
    if (!local) offMachine.push(details.url);
    cb({ cancel: !local });
  });

  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-ocr-'));
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
    if (!(await waitFor('[data-page-number="1"][data-painted]'))) throw new Error('page 1 never painted');
  };
  const ocrOnDisk = () => (fs.existsSync(path.join(store, 'ocr', pdf.id)) ? fs.readdirSync(path.join(store, 'ocr', pdf.id)) : []);

  // 1. Nothing on open.
  await open();
  await sleep(2500);
  const requested = await js(`return performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/ocr/'));`);
  const spans = await js(`return document.querySelectorAll('[data-page-number="1"] .marginalia-text-layer span').length;`);
  check('Opening a scanned PDF marked Urdu loads no OCR file and saves no OCR (never read: English only)', requested.length === 0 && ocrOnDisk().length === 0 && spans === 0, JSON.stringify({ requested, saved: ocrOnDisk(), spans }));

  // 2. The OCR files are the app's own.
  const files = ['worker.min.js', 'tesseract-core-simd-lstm.wasm.js', 'eng.traineddata.gz'];
  const served = await Promise.all(files.map(async (f) => {
    const res = await fetch(`${base}/ocr/${f}`);
    return [f, res.status, (await res.arrayBuffer()).byteLength];
  }));
  const urdModel = await fetch(`${base}/ocr/urd.traineddata.gz`).then(async (res) => [res.status, (await res.arrayBuffer()).byteLength]);
  check('The app serves its own OCR worker, core and English model, and no Urdu model', served.every(([, status, size]) => status === 200 && size > 100000) && !(urdModel[0] === 200 && urdModel[1] > 100000), JSON.stringify({ served, urdModel }));

  // 3. The bundled tesseract.js reads the scan offline, with the app's own paths.
  // The bundled tesseract.js chunk (hashed name): the one whose exports hold createWorker.
  const chunks = fs.readdirSync(path.join(ROOT, 'dist', 'assets')).filter((f) => f.endsWith('.js') && fs.readFileSync(path.join(ROOT, 'dist', 'assets', f), 'utf8').includes('createScheduler'));
  const engineSource = fs.readFileSync(path.join(ROOT, 'src', 'components', 'pdf', 'ocr', 'tesseractEngine.ts'), 'utf8');
  const option = (name) => new RegExp(`${name}: '([^']+)'`).exec(engineSource)?.[1];
  const read = await js(`
    let lib = null;
    for (const f of ${JSON.stringify(chunks)}) {
      lib = Object.values(await import('/assets/' + f)).find((v) => v && typeof v.createWorker === 'function') ?? null;
      if (lib) break;
    }
    if (!lib) throw new Error('no tesseract.js chunk among ' + ${JSON.stringify(JSON.stringify(chunks))});
    const page = document.querySelector('[data-page-number="1"] canvas');
    const worker = await lib.createWorker('eng', 1, { workerPath: '${option('workerPath')}', corePath: '${option('corePath')}', langPath: '${option('langPath')}', gzip: true, workerBlobURL: false, cacheMethod: 'none' });
    const { data } = await worker.recognize(page, {}, { text: true, blocks: true });
    await worker.terminate();
    return data.text;
  `).catch((e) => `error: ${e.message}`);
  check('The bundled tesseract.js reads an English scan in the app, offline', /quick brown fox jumps over the lazy dog/i.test(read) && offMachine.length === 0, JSON.stringify({ read: String(read).trim(), offMachine }));

  // 4. Saved OCR words: a selectable layer, highlighted with their words. Boxes where the line
  // was drawn (y 300 baseline, 48px), as page fractions.
  const words = [['The', 100, 182], ['quick', 190, 300], ['brown', 312, 448]].map(([text, x0, x1]) => ({ text, x: x0 / W, y: 262 / H, w: (x1 - x0) / W, h: 50 / H, line: 0 }));
  await fetch(`${base}/api/documents/${pdf.id}/ocr/1`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words, langs: 'eng+urd', createdAt: new Date().toISOString() }) });
  const urdu = ['یہ', 'ایک', 'شام'].map((text, i) => ({ text, x: (900 - i * 150) / W, y: 500 / H, w: 120 / W, h: 50 / H, line: 0, rtl: true }));
  await fetch(`${base}/api/documents/${pdf.id}/ocr/2`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words: urdu, langs: 'eng+urd', createdAt: new Date().toISOString() }) });
  await open();
  const ready = await waitFor('[data-page-number="1"] .marginalia-text-layer span[data-ocr]');
  const highlight = async (pageNo) => {
    await js(`
      const layer = document.querySelector('[data-page-number="${pageNo}"] .marginalia-text-layer');
      layer.scrollIntoView();
      const r = document.createRange(); r.selectNodeContents(layer);
      getSelection().removeAllRanges(); getSelection().addRange(r);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return true;
    `);
    await sleep(400);
    await js(`
      const menu = document.querySelector('[aria-label="Mark the selection"]');
      if (!menu) throw new Error('selection menu did not open');
      [...menu.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').startsWith('Highlight')).click();
      return true;
    `);
    await sleep(1500);
    return (await api(`/documents/${pdf.id}/annotations`)).annotations.filter((m) => m.page === pageNo);
  };
  const m1 = ready ? await highlight(1) : [];
  check('Saved OCR words are a selectable layer; a highlight over them keeps their words', ready && m1.length === 1 && m1[0].quote === 'The quick brown' && m1[0].rects?.length === 1, JSON.stringify({ ready, marks: m1.map((m) => ({ quote: m.quote, rects: m.rects?.length })) }));

  // 5. Urdu words an older version saved: still a layer, still marked (as plain text).
  await js(`document.querySelector('[data-page-number="2"]').scrollIntoView(); return true;`);
  const old = await waitFor('[data-page-number="2"] .marginalia-text-layer span[data-ocr]');
  const m2 = old ? await highlight(2) : [];
  const q2 = m2[0]?.quote || '';
  check('Urdu OCR words saved by an older version still load and can be marked', old && m2.length === 1 && ['یہ', 'ایک', 'شام'].every((w) => q2.includes(w)), JSON.stringify({ old, quotes: m2.map((m) => m.quote) }));

  // 6. Delete page 1 in the app: page 2 (Urdu) becomes page 1; no OCR words may stay on it.
  const before = await js(`return document.querySelectorAll('span[data-ocr]').length;`);
  await js(`
    document.querySelector('[data-page-number="1"]').scrollIntoView();
    document.querySelector('[aria-label="Delete page 1"]').click();
    await new Promise((r) => setTimeout(r, 300));
    [...document.querySelectorAll('[data-page-number="1"] button')].find((b) => b.textContent.trim() === 'Delete').click();
    return true;
  `);
  await waitFor('[data-page-number="1"][data-painted]');
  await sleep(3000);
  const left = await js(`return { pages: document.querySelectorAll('[data-page-number]').length, words: [...document.querySelectorAll('span[data-ocr]')].map((s) => s.textContent) };`);
  check('Deleting a page drops the OCR: no old words stay on any page', before > 0 && left.pages === 1 && left.words.length === 0 && ocrOnDisk().length === 0, JSON.stringify({ before, left, saved: ocrOnDisk() }));

  win.destroy();
  fs.rmSync(store, { recursive: true, force: true });
  const failed = results.filter((ok) => !ok).length;
  console.log(failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`);
  app.exit(failed ? 1 : 0);
}

app.on('window-all-closed', () => {});
app.disableHardwareAcceleration();
app.whenReady().then(main).catch((err) => {
  console.error('e2e failed:', err);
  app.exit(1);
});
