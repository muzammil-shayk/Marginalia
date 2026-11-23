/**
 * End-to-end checks of PDFs whose font has no letter map (no /ToUnicode, common in Urdu
 * Nastaliq/InPage exports): pdf.js gives their text layer control characters only. In the real
 * app (Electron + the built server), on a throwaway library in the temp folder, with real drags.
 *
 *   npm run test:e2e        (builds first)
 *
 * 1. On opening, the page counts as having no text, and nothing is read or saved: OCR refuses a
 *    page whose font has no letter map (read in English it would be garbage).
 * 2. Dragging across the line with Highlight armed reads nothing either and makes no mark: one
 *    muted line says the PDF hides its letters.
 * 3. A page with English text and one unmapped Urdu line: a drag over only the Urdu line says it
 *    can't be read (no silent nothing), makes no mark and reads nothing; English still marks.
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

/**
 * scripts/fixtures/urdu-no-map.pdf: LibreOffice (writer_web_pdf_Export) from HTML, then the Urdu
 * font's /ToUnicode deleted with pdf-lib. Page 1: three lines of one short Urdu sentence (Noto
 * Kufi Arabic); page 2: that sentence over a line of English whose font keeps its map. Few
 * distinct glyphs, so every unmapped code is below U+0020 (control characters only). A font with
 * more glyphs runs into printable codes (garbage letters), which this suite does not cover.
 */
const FIXTURE = path.join(__dirname, 'fixtures', 'urdu-no-map.pdf');

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-nomap-'));
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
  const pdf = await api('/documents', 'POST', { title: 'Purani kitaben', text: 'Urdu', format: 'PDF', filename: 'nomap.pdf' });
  await fetch(`${base}/api/documents/${pdf.id}/original?filename=nomap.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: fs.readFileSync(FIXTURE) });

  const win = new BrowserWindow({ width: 1400, height: 900, show: false, webPreferences: { offscreen: true } });
  const wc = win.webContents;
  const js = (code) => wc.executeJavaScript(`(async () => { ${code} })()`);
  const until = (code, ms = 20000) =>
    js(`
      for (const t0 = performance.now(); performance.now() - t0 < ${ms}; await new Promise((r) => setTimeout(r, 150))) { const v = await (async () => { ${code} })(); if (v) return v; }
      return null;
    `);
  const s = { currentScreen: 'workspace', analysisDoc: { title: pdf.title, text: '', format: 'PDF', docId: pdf.id }, uploadedLibrary: [], documentNotes: {}, documentFormats: {} };
  await win.loadURL(base);
  await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(s))}); return true;`);
  await win.loadURL(base);
  if (!(await until(`return document.querySelector('[data-page-number="1"][data-painted] .marginalia-text-layer span');`))) throw new Error(`page 1 never painted: ${await js(`return JSON.stringify({ pages: document.querySelectorAll('[data-page-number]').length, painted: Boolean(document.querySelector('[data-page-number="1"][data-painted]')), layer: document.querySelector('[data-page-number="1"] .marginalia-text-layer')?.innerHTML.slice(0, 200), body: document.body.innerText.slice(0, 200) });`)}`);
  const ocrOnDisk = () => (fs.existsSync(path.join(store, 'ocr', pdf.id)) ? fs.readdirSync(path.join(store, 'ocr', pdf.id)) : []);
  const marks = async () => (await api(`/documents/${pdf.id}/annotations`)).annotations || [];
  const dragOn = async (n, from, to) => {
    const r = await js(`const b = document.querySelector('[data-page-number="${n}"]').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height };`);
    const at = ([fx, fy]) => ({ x: Math.round(r.x + r.w * fx), y: Math.round(r.y + r.h * fy) });
    const a = at(from);
    const b = at(to);
    wc.sendInputEvent({ type: 'mouseMove', x: a.x, y: a.y });
    wc.sendInputEvent({ type: 'mouseDown', x: a.x, y: a.y, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 10; i++) {
      wc.sendInputEvent({ type: 'mouseMove', x: Math.round(a.x + ((b.x - a.x) * i) / 10), y: Math.round(a.y + ((b.y - a.y) * i) / 10), button: 'left' });
      await sleep(20);
    }
    wc.sendInputEvent({ type: 'mouseUp', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await sleep(100);
  };
  const keyTap = async (keyCode) => {
    wc.focus();
    wc.sendInputEvent({ type: 'keyDown', keyCode });
    wc.sendInputEvent({ type: 'char', keyCode });
    wc.sendInputEvent({ type: 'keyUp', keyCode });
    await sleep(200);
  };
  /** Page fractions across the first line of spans on page n with (`letters`) or without letters. */
  const lineOn = (n, letters) =>
    js(`const p = document.querySelector('[data-page-number="${n}"]').getBoundingClientRect();
      const spans = [...document.querySelectorAll('[data-page-number="${n}"] .marginalia-text-layer span')].filter((x) => x.textContent.trim() && /[\\p{L}]/u.test(x.textContent) === ${letters});
      const rs = spans.map((x) => x.getBoundingClientRect()).filter((r) => r.width > 0);
      const top = Math.min(...rs.map((r) => r.top));
      const line = rs.filter((r) => r.top < top + 8);
      const y = (line[0].top + line[0].bottom) / 2;
      return { from: [(Math.min(...line.map((r) => r.left)) + 4 - p.left) / p.width, (y - p.top) / p.height], to: [(Math.max(...line.map((r) => r.right)) - 4 - p.left) / p.width, (y - p.top) / p.height] };`);
  const view = async (n) => {
    await js(`document.querySelector('[data-page-number="${n}"]').scrollIntoView({ block: 'start' }); return true;`);
    await until(`return document.querySelector('[data-page-number="${n}"][data-painted] .marginalia-text-layer span');`);
    await sleep(500);
  };

  // 1. Opening: no text of its own; an Urdu page is never read on its own.
  await view(1);
  await sleep(6000);
  const opened = await js(`const p = document.querySelector('[data-page-number="1"]'); return { noText: p.hasAttribute('data-no-text'), chip: Boolean(p.querySelector('[data-ocr-page]')), ocrSpans: p.querySelectorAll('span[data-ocr]').length };`);
  check('A page with only control characters counts as no text; nothing is read or saved on opening', opened.noText && !opened.chip && !opened.ocrSpans && ocrOnDisk().length === 0, JSON.stringify({ ...opened, saved: ocrOnDisk() }));

  // 2. Highlight armed, a drag across the line: nothing is read, one muted line says why.
  await keyTap('H');
  const line1 = await lineOn(1, false);
  await dragOn(1, line1.from, line1.to);
  const said = await until(`return document.querySelector('[data-page-number="1"] [data-ocr-page]')?.textContent || null;`, 10000);
  await sleep(3000);
  const marked = (await marks()).length;
  check(
    'Dragging on it reads nothing and makes no mark: one muted line says the PDF hides its letters',
    /can.t be read: the PDF hides its letters/.test(said || '') && marked === 0 && ocrOnDisk().length === 0,
    JSON.stringify({ said, marked, saved: ocrOnDisk() })
  );

  // 3. Page 2 has English text: a drag over only its unmapped Urdu line is said, not dropped.
  await view(2);
  const before = (await marks()).length;
  const urdu2 = await lineOn(2, false);
  await dragOn(2, urdu2.from, urdu2.to);
  const note = await until(`return document.querySelector('[data-unreadable-note]')?.textContent || null;`, 5000);
  // The note pill reads in both themes: text >= 4.5:1 on its own ground, and a dark ground in dark mode.
  const pill = await js(`
    const el = document.querySelector('[data-unreadable-note]');
    // Tailwind 4 gives oklch/color() values: let a canvas turn them into sRGB, over the page's ground.
    const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
    const rgb = (c, under) => { ctx.clearRect(0, 0, 1, 1); for (const f of [under, c]) { ctx.fillStyle = f; ctx.fillRect(0, 0, 1, 1); } return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const read = (under) => { const s = getComputedStyle(el); const bg = rgb(s.backgroundColor, under); const g = lum(bg), t = lum(rgb(s.color, 'rgb(' + bg + ')')); return { ground: g, contrast: (Math.max(g, t) + 0.05) / (Math.min(g, t) + 0.05) }; };
    const root = document.querySelector('.dark') ? null : document.body;
    const light = read('#f3efe7');
    root?.classList.add('dark');
    const dark = read('#0b0b0a');
    root?.classList.remove('dark');
    return { light, dark };`);
  check('The unreadable note pill keeps >= 4.5:1 text in light and dark, on a dark ground in dark mode',
    pill.light.contrast >= 4.5 && pill.dark.contrast >= 4.5 && pill.dark.ground < 0.1, JSON.stringify(pill));
  await sleep(1500);
  const after = await marks();
  const noRead = !ocrOnDisk().includes('2.json') && !(await js(`return Boolean(document.querySelector('[data-page-number="2"] [data-ocr-page]'));`));
  // A second unreadable drag on the same page restarts the note's 4 s timer.
  const firstShown = Date.now() - 1500;
  await sleep(1500);
  await js(`getSelection().removeAllRanges(); return true;`);
  await dragOn(2, urdu2.from, urdu2.to);
  await sleep(Math.max(0, firstShown + 5000 - Date.now()));
  const stillShown = await js(`return Boolean(document.querySelector('[data-unreadable-note]'));`);
  check('A second unreadable drag on the same page keeps the note up for another 4 s', stillShown, JSON.stringify({ stillShown, sinceFirst: Date.now() - firstShown }));
  await js(`getSelection().removeAllRanges(); return true;`);
  const english2 = await lineOn(2, true);
  await dragOn(2, english2.from, english2.to);
  let english = [];
  for (const t0 = Date.now(); Date.now() - t0 < 5000 && !english.length; await sleep(200)) english = (await marks()).filter((a) => a.page === 2);
  check(
    'On a page with text, a drag over only unreadable letters says so, makes no mark and reads nothing; English there still marks',
    /can.t be read/.test(note || '') && after.length === before && noRead && english.length === 1 && /Plain English words/.test(english[0].quote),
    JSON.stringify({ note, before, after: after.length, noRead, english: english.map((m) => m.quote) })
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
