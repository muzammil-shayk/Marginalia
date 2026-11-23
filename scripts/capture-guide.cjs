/**
 * Makes the screenshots for "Getting the most from Marginalia" (src/data/guide.ts), from the real
 * app, so the guide shows exactly what a reader sees.
 *
 *   npm run guide:capture        (builds first; writes src/assets/guide/<id>.jpg)
 *
 * It starts the built server on a throwaway library in the temp folder (never the reader's own),
 * fills it with sample documents and marks, opens the app in an offscreen window at 1280×800 and
 * walks it screen by screen. Run it again after changing anything the guide shows.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'src', 'assets', 'guide');
const WIDTH = 1280;
const HEIGHT = 800;
/** Saved width: sharp on the guide's two-column grid, small enough to ship in the app. */
const SAVE_WIDTH = 960;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Sample library ──────────────────────────────────────────────────────────

const SHORE = [
  'The tide goes out along the sand\nThe gulls go wheeling west\nThe boats lie waiting near the land\nAnd all the shore is rest',
  'The lamp is lit above the bay\nThe nets are hung to dry\nThe children run the long way home\nBeneath a reddening sky'
].join('\n\n');

const NIGHT = [
  'The stars come out at night\nThe sea is grey by day\nThe lamp gives off its light\nAnd sorrow fades away',
  'The moon is up, the moon is high\nAnd silver runs along the sky\nThe garden keeps the evening rain\nAnd every leaf is lit again',
  'I kept the letter by the door\nI read it twice and then once more\nThe moon came in across the floor\nAnd asked me nothing, as before'
].join('\n\n');

const ESSAY = [
  'Reading slowly is a way of keeping company with a book. The pencil in the margin is not a tool for taking the text apart but a way of answering it, line by line, the way one answers a letter.',
  'Every reader has a private index. A word underlined in one chapter returns, changed, three hundred pages later, and the second underline only makes sense because of the first. The margin is where that index is written.',
  'Old commonplace books were built this way. A reader copied out a sentence, wrote the author and the page beside it, and filed it under a heading: Time, Memory, the Sea. Years later the headings had become an argument of their own.',
  'Themes are not labels stuck on afterwards. They are the shape a reading takes when the same image keeps arriving: the moon over water, the closed door, the letter read twice. Marking them is how a reader notices the pattern before naming it.',
  'A note in the margin should sit beside the line it answers. Pushed to the end of the chapter it becomes a footnote; kept level with its words it stays part of the conversation.',
  'The best marks are small. A single word circled, a question mark, a line drawn under half a sentence. They are reminders, not essays, and they are written for the reader who comes back.',
  'Coming back is the point. A book read once is a visit; a book read with a pencil is a place one can return to, finding the earlier reader still there, waiting at the edge of the page.',
  'Two readings rarely agree. The second notices what the first rushed past, and quarrels with what the first was sure of. Both belong in the margin, one under the other, dated.',
  'Some readers keep a separate notebook. Others write only in the book. Either way the habit is the same: to slow down, to answer back, and to keep the answer where it can be found.',
  'In the end a well-marked book is a map of attention. It shows where the reader stopped, what made them stop, and which roads they meant to walk again.'
].join('\n\n');

const THEMES = [
  { id: '1', name: 'Key Concepts', color: '#4f8f7a' },
  { id: '2', name: 'Questions', color: '#6d6ad8' },
  { id: '3', name: 'Metaphors', color: '#d97a2b' },
  { id: '4', name: 'Night', color: '#3f6fb5' },
  { id: '5', name: 'Memory', color: '#b5527a' }
];

const now = new Date().toISOString();
const tm = (id, p, start, end, quote, extra = {}) => ({
  id,
  kind: 'highlight',
  anchor: { paragraphIndex: p, start, end },
  themeId: null,
  quote,
  author: 'Reader',
  createdAt: now,
  updatedAt: now,
  ...extra
});
const at = (text, word, from = 0) => {
  const start = text.indexOf(word, from);
  return [start, start + word.length];
};

function nightMarks() {
  const p = NIGHT.split('\n\n');
  const [m0s, m0e] = at(p[1], 'The moon is up');
  const [s0, s1] = at(p[0], 'stars come out');
  const [l0, l1] = at(p[0], 'gives off its light');
  const [d0, d1] = at(p[2], 'The moon came in across the floor');
  const [r0, r1] = at(p[2], 'I read it twice');
  return [
    tm('n1', 0, s0, s1, 'stars come out', { themeId: '4', color: '#3f6fb5', board: { x: 24, y: 24 } }),
    // One passage, two themes: drawn in the first, with a dot for the second.
    tm('n2', 1, m0s, m0e, 'The moon is up', { themeIds: ['4', '3'], color: '#3f6fb5', links: ['n4'], board: { x: 280, y: 160 } }),
    tm('n4', 2, d0, d1, 'The moon came in across the floor', { themeId: '5', color: '#b5527a', links: ['n2'], board: { x: 40, y: 300 } }),
    tm('n5', 2, r0, r1, 'I read it twice', {
      kind: 'note',
      themeId: '5',
      color: '#b5527a',
      title: 'Rereading',
      text: 'The letter is read the way this poem asks to be read: twice, then once more.'
    }),
    tm('n6', 0, l0, l1, 'gives off its light', { kind: 'underline', themeId: '1', color: '#4f8f7a' })
  ];
}

function essayMarks() {
  const p = ESSAY.split('\n\n');
  const [a0, a1] = at(p[1], 'private index');
  const [b0, b1] = at(p[2], 'commonplace books');
  const [c0, c1] = at(p[3], 'the moon over water');
  const [d0, d1] = at(p[4], 'sit beside the line it answers');
  return [
    tm('e1', 1, a0, a1, 'private index', { themeId: '1', color: '#4f8f7a' }),
    tm('e2', 2, b0, b1, 'commonplace books', { themeId: '1', color: '#4f8f7a', isTerminology: true }),
    tm('e3', 3, c0, c1, 'the moon over water', { themeId: '3', color: '#d97a2b' }),
    tm('e4', 4, d0, d1, 'sit beside the line it answers', {
      kind: 'note',
      themeId: '2',
      color: '#6d6ad8',
      title: 'Where notes belong',
      text: 'Level with the words, not at the end of the chapter.'
    })
  ];
}

async function samplePdf() {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const paras = ESSAY.split('\n\n');
  for (let n = 0; n < 8; n++) {
    const page = doc.addPage([420, 595]);
    page.drawText(`On Marginalia — ${n + 1}`, { x: 40, y: 545, size: 15, font: bold, color: rgb(0.15, 0.15, 0.15) });
    let y = 510;
    for (const para of [paras[n % paras.length], paras[(n + 3) % paras.length]]) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        if (font.widthOfTextAtSize(`${line} ${w}`, 11.5) > 340) {
          page.drawText(line, { x: 40, y, size: 11.5, font });
          y -= 17;
          line = w;
        } else line = line ? `${line} ${w}` : w;
      }
      page.drawText(line, { x: 40, y, size: 11.5, font });
      y -= 30;
    }
  }
  return Buffer.from(await doc.save());
}

/** A two-page scan: pictures of printed lines, with no text layer (for the OCR card). */
async function scannedPdf() {
  const W = 1240;
  const H = 1754;
  const w = new BrowserWindow({ show: false });
  await w.loadURL('data:text/html,<html><body></body></html>');
  const lines = ESSAY.split('\n\n').slice(0, 2).join(' ').match(/.{1,52}(\s|$)/g).map((l) => l.trim());
  const png = await w.webContents.executeJavaScript(`(() => {
    const c = document.createElement('canvas'); c.width = ${W}; c.height = ${H};
    const g = c.getContext('2d'); g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#222'; g.font = 'bold 44px Georgia, serif'; g.fillText('On Marginalia (scanned)', 110, 190);
    g.font = '34px Georgia, serif';
    ${JSON.stringify(lines)}.forEach((l, i) => g.fillText(l, 110, 290 + i * 54));
    return c.toDataURL('image/png');
  })()`);
  w.destroy();
  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(Buffer.from(png.split(',')[1], 'base64'));
  for (let i = 0; i < 2; i++) doc.addPage([420, 595]).drawImage(image, { x: 0, y: 0, width: 420, height: 595 });
  return Buffer.from(await doc.save());
}

/** A page with a chart and its caption (the Area highlight card: a figure has no words to select). */
async function figurePdf() {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const page = doc.addPage([420, 595]);
  const ink = rgb(0.15, 0.15, 0.15);
  page.drawText('How a Reader Marks a Book', { x: 40, y: 545, size: 15, font: bold, color: ink });
  ['Over one slow reading, the marks thin out in the middle chapters and', 'return at the end, when the opening images come back changed.'].forEach((l, i) =>
    page.drawText(l, { x: 40, y: 512 - i * 17, size: 11.5, font, color: ink })
  );
  // The chart: axes, six bars, chapter numbers.
  const x0 = 70;
  const y0 = 300;
  page.drawLine({ start: { x: x0, y: y0 }, end: { x: 370, y: y0 }, thickness: 1, color: ink });
  page.drawLine({ start: { x: x0, y: y0 }, end: { x: x0, y: 460 }, thickness: 1, color: ink });
  page.drawText('marks', { x: 44, y: 448, size: 9, font: italic, color: ink });
  [120, 96, 70, 34, 58, 140].forEach((h, i) => {
    const x = x0 + 18 + i * 48;
    page.drawRectangle({ x, y: y0 + 1, width: 28, height: h, color: rgb(0.42, 0.47, 0.55) });
    page.drawText(String(i + 1), { x: x + 11, y: y0 - 14, size: 9.5, font, color: ink });
  });
  page.drawText('chapter', { x: 200, y: y0 - 30, size: 9, font: italic, color: ink });
  page.drawText('Figure 1. Marks made in each chapter of one reading.', { x: 70, y: y0 - 52, size: 10.5, font: italic, color: ink });
  return Buffer.from(await doc.save());
}

function pdfMarks() {
  const base = { themeId: null, author: 'Reader', createdAt: now };
  return [
    { ...base, id: 'p1', page: 1, kind: 'highlight', color: '#4f8f7a', themeId: '1', rects: [{ x: 0.093, y: 0.122, w: 0.79, h: 0.028 }], quote: 'Reading slowly is a way of keeping company' },
    { ...base, id: 'p2', page: 1, kind: 'ink', color: '#d97a2b', weight: 0.004, points: [{ x: 0.1, y: 0.42 }, { x: 0.3, y: 0.4 }, { x: 0.5, y: 0.43 }, { x: 0.7, y: 0.41 }] },
    { ...base, id: 'p3', page: 1, kind: 'rect', color: '#3f6fb5', weight: 0.004, box: { x: 0.08, y: 0.47, w: 0.84, h: 0.13 } },
    { ...base, id: 'p4', page: 1, kind: 'rect', color: '#000000', weight: 0, filled: true, box: { x: 0.095, y: 0.66, w: 0.5, h: 0.032 } },
    { ...base, id: 'p5', page: 1, kind: 'arrow', color: '#b5527a', weight: 0.004, from: { x: 0.85, y: 0.78 }, to: { x: 0.7, y: 0.7 } },
    { ...base, id: 'p7', page: 1, kind: 'ink', arrowHead: true, color: '#3f6fb5', weight: 0.004, points: Array.from({ length: 20 }, (_, i) => ({ x: 0.93 - Math.sin((i / 19) * Math.PI * 0.55) * 0.08, y: 0.25 + (i / 19) * 0.2 })) },
    { ...base, id: 'p6', page: 1, kind: 'note', color: '#6d6ad8', themeId: '2', box: { x: 0.62, y: 0.8, w: 0.3, h: 0.12 }, text: 'Compare the closing image with page 4.', noteStyle: 'translucent' }
  ];
}

// ── Driving the window ──────────────────────────────────────────────────────

/** Helpers defined in the page after each load. */
const PAGE_HELPERS = `
  window.__q = (sel, text) => {
    const els = [...document.querySelectorAll(sel)];
    const el = text === undefined ? els[0] : els.find((e) =>
      (e.getAttribute('aria-label') || '').includes(text) || (e.title || '').includes(text) || e.textContent.trim() === text || e.textContent.includes(text));
    if (!el) throw new Error('not found: ' + sel + ' ' + (text || ''));
    return el;
  };
  window.__click = (sel, text) => { window.__q(sel, text).click(); return true; };
  // A PDF view button, from the toolbar row or, on a narrow window, from its "More" menu.
  window.__view = async (label) => {
    const inline = [...document.querySelectorAll('button[role="radio"]')].find((b) => (b.getAttribute('aria-label') || '').includes(label));
    if (inline) return inline.click(), true;
    document.querySelector('[aria-label^="More:"]').click();
    await new Promise((r) => setTimeout(r, 300));
    window.__click('button[role="radio"]', label);
    // Closed the way a click elsewhere closes it, so the picture is not covered.
    await new Promise((r) => setTimeout(r, 200));
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return true;
  };
  window.__type = (sel, value) => {
    const el = window.__q(sel);
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  // A point on screen, in percent of the window (= of the saved picture): an element's centre,
  // or a spot on PDF page one given in page fractions.
  window.__pt = (el) => {
    const r = el.getBoundingClientRect();
    return { x: +(((r.left + r.width / 2) / innerWidth) * 100).toFixed(1), y: +(((r.top + r.height / 2) / innerHeight) * 100).toFixed(1) };
  };
  window.__pagePt = (fx, fy) => {
    const r = document.querySelector('[data-page-number="1"]').getBoundingClientRect();
    return { x: +(((r.left + fx * r.width) / innerWidth) * 100).toFixed(1), y: +(((r.top + fy * r.height) / innerHeight) * 100).toFixed(1) };
  };
  window.__tool = (label) => {
    const b = [...document.querySelectorAll('button[aria-label]')].find((e) => e.getAttribute('aria-label').startsWith(label) && !e.getAttribute('aria-label').includes('options'));
    if (!b) throw new Error('no tool ' + label);
    return b;
  };
  window.__rect = (sel, text, pad = 12) => {
    const r = window.__q(sel, text).getBoundingClientRect();
    return { x: Math.max(0, Math.floor(r.left - pad)), y: Math.max(0, Math.floor(r.top - pad)), width: Math.ceil(r.width + 2 * pad), height: Math.ceil(r.height + 2 * pad) };
  };
  window.__select = (paraIdx, word) => {
    const p = document.getElementById('reader-para-text-' + paraIdx);
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.data.indexOf(word);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + word.length);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true }));
      document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse', bubbles: true }));
      return true;
    }
    throw new Error('word not found: ' + word);
  };
  true;
`;

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-guide-'));
  process.env.MARGINALIA_STORE_DIR = store;
  process.env.MARGINALIA_EMBEDDED = '1';
  process.env.NODE_ENV = 'production';
  process.env.PORT = '0';
  const server = require(path.join(DIST, 'server.cjs'));
  const port = await server.startServer({ staticRoot: DIST });
  const base = `http://127.0.0.1:${port}`;
  const api = async (p, method = 'GET', body) => {
    const res = await fetch(`${base}/api${p}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`${method} ${p}: ${res.status}`);
    return res.json();
  };
  const version = /CURRENT_APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'src', 'data', 'changelog.ts'), 'utf8'))[1];

  // Documents, oldest first so the shelf reads in a sensible order.
  const essay = await api('/documents', 'POST', { title: 'On Marginalia', text: ESSAY, format: 'TXT', layout: 'verbatim' });
  const night = await api('/documents', 'POST', { title: 'Night Songs', text: NIGHT, format: 'TXT', layout: 'verbatim' });
  const shore = await api('/documents', 'POST', { title: 'The Shore', text: SHORE, format: 'TXT', layout: 'verbatim' });
  const pdf = await api('/documents', 'POST', { title: 'Reading Slowly', text: ESSAY, format: 'PDF', filename: 'reading-slowly.pdf' });
  await fetch(`${base}/api/documents/${pdf.id}/original?filename=reading-slowly.pdf`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: await samplePdf()
  });
  const scan = await api('/documents', 'POST', { title: 'A Scanned Essay', text: 'Scanned', format: 'PDF', filename: 'scanned-essay.pdf' });
  await fetch(`${base}/api/documents/${scan.id}/original?filename=scanned-essay.pdf`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: await scannedPdf()
  });
  await api(`/documents/${essay.id}/annotations`, 'PUT', { annotations: essayMarks() });
  await api(`/documents/${night.id}/annotations`, 'PUT', { annotations: nightMarks() });
  await api(`/documents/${pdf.id}/annotations`, 'PUT', { annotations: pdfMarks() });
  for (const [id, position, total] of [[essay.id, 6, 10], [night.id, 3, 3], [shore.id, 2, 3], [pdf.id, 3, 8]]) {
    await api(`/documents/${id}/progress`, 'PUT', { position, total }).catch(() => {});
  }
  const settings = {
    name: 'Reader',
    typography: 'Literata (Default)',
    fontSize: 18,
    darkMode: false,
    readerMode: false,
    activeThemes: THEMES,
    terminologyColor: '#c08a2e',
    lastSeenVersion: version,
    poetry: {
      [shore.id]: { on: true, numbering: 'lines', prosody: true, metre: 'iambic, four and three beats' },
      [night.id]: { on: true, numbering: 'lines', prosody: false }
    },
    motifs: [{ id: 'mo-moon', name: 'The moon', terms: ['moon'] }]
  };
  await api('/settings', 'PUT', { settings });

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    webPreferences: { offscreen: true, contextIsolation: true, sandbox: true }
  });
  win.webContents.setFrameRate(30);
  const js = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
  const helpers = () => win.webContents.executeJavaScript(PAGE_HELPERS);

  /** Opens a screen (and a document) the way a reload of the app would restore it. */
  const open = async (screen, doc) => {
    const session = {
      currentScreen: screen,
      analysisDoc: doc ? { title: doc.title, text: '', format: doc.format, docId: doc.id } : { title: '', text: '' },
      uploadedLibrary: [],
      documentNotes: {},
      documentFormats: {}
    };
    await win.loadURL(base);
    await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(session))}); return true;`);
    await win.loadURL(base);
    await sleep(2200);
    await helpers();
  };

  fs.mkdirSync(OUT, { recursive: true });
  const made = [];
  const shot = async (id, rect) => {
    await sleep(500);
    const img = await win.webContents.capturePage(rect);
    const size = img.getSize();
    const out = size.width > SAVE_WIDTH ? img.resize({ width: SAVE_WIDTH, quality: 'best' }) : img;
    fs.writeFileSync(path.join(OUT, `${id}.jpg`), out.toJPEG(82));
    made.push(id);
    console.log(`[guide] ${id}.jpg ${size.width}x${size.height}`);
  };
  // GUIDE_ONLY=tool-a,tool-b remakes just those pictures (and merges their points); unset = all.
  const ONLY = process.env.GUIDE_ONLY ? new Set(process.env.GUIDE_ONLY.split(',').map((x) => x.trim())) : null;
  const step = async (id, fn) => {
    if (ONLY && !ONLY.has(id)) return;
    try {
      await fn();
    } catch (err) {
      console.error(`[guide] ${id} failed:`, err && err.message ? err.message : err);
    }
  };
  const full = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
  /** Where each card's picture zooms (and, for tools, where the pointer clicks): written to guidePoints.ts. */
  const points = {};
  const key = async (keyCode, modifiers = []) => {
    win.webContents.focus();
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    if (keyCode.length === 1 || keyCode === 'Enter') win.webContents.sendInputEvent({ type: 'char', keyCode: keyCode === 'Enter' ? '\r' : keyCode, modifiers });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    await sleep(60);
  };
  /** Types into whatever has focus; a newline is Shift+Enter, as a reader writes a second line. */
  const typeText = async (text) => {
    for (const ch of text) {
      if (ch === '\n') await key('Enter', ['shift']);
      else await key(ch);
    }
  };
  const rectOf = (sel, text, pad) => js(`return __rect(${JSON.stringify(sel)}, ${JSON.stringify(text)}, ${pad ?? 12});`);

  // Reading
  await step('shelf', async () => {
    await open('home');
    await shot('shelf', full);
  });
  await step('tracker', async () => {
    await js(`document.querySelector('[aria-label="My Margins Tracker views"]').closest('section').scrollIntoView({ block: 'start' }); return true;`);
    await sleep(600);
    await shot('tracker', full);
  });
  await step('reader', async () => {
    await open('reader', essay);
    await shot('reader', full);
  });
  await step('tagging', async () => {
    await shot('tagging', { x: 0, y: 0, width: WIDTH, height: 150 });
  });
  await step('popover', async () => {
    await js(`__select(0, 'The pencil in the margin'); return true;`);
    await sleep(700);
    await shot('popover', full);
    await js(`getSelection().removeAllRanges(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
  });
  await step('find', async () => {
    await js(`__click('button', 'Find in document'); return true;`);
    await sleep(400);
    await js(`__type('input[type="search"], input[aria-label*="Find"]', 'reader'); return true;`);
    await sleep(800);
    // Zoom to the first hit the Find bar painted.
    points.find = {
      focus: await js(`
        for (const p of document.querySelectorAll('[id^="reader-para-text-"]')) {
          const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            const i = n.data.toLowerCase().indexOf('reader');
            if (i < 0) continue;
            const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 6);
            const b = r.getBoundingClientRect();
            if (b.top > 0 && b.bottom < innerHeight) return { x: +(((b.left + b.width / 2) / innerWidth) * 100).toFixed(1), y: +(((b.top + b.height / 2) / innerHeight) * 100).toFixed(1) };
          }
        }
        return { x: 31, y: 22 };
      `)
    };
    await shot('find', full);
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
  });
  await step('export', async () => {
    await js(`__click('#reader-bar-export-btn'); return true;`);
    await sleep(800);
    await shot('export', full);
  });
  await step('spread', async () => {
    await open('reader', essay);
    await js(`__click('button[aria-label="Two-page spread"]'); return true;`);
    await sleep(1600);
    await shot('spread', full);
    await js(`__click('button[aria-label="Two-page spread"]'); return true;`);
    await sleep(600);
  });
  await step('margin', async () => {
    await open('reader', night);
    // Down to the last stanza, where the note sits beside its line.
    await js(`document.getElementById('reader-para-2').scrollIntoView({ block: 'center' }); return true;`);
    await sleep(700);
    await shot('margin', full);
  });
  await step('overlap', async () => {
    const r = await rectOf('#reader-para-1', undefined, 16);
    await shot('overlap', { x: r.x, y: r.y, width: Math.min(WIDTH - r.x, r.width + 300), height: r.height });
  });
  await step('board', async () => {
    await js(`__click('button', 'Excerpt board'); return true;`);
    await sleep(900);
    await js(`window.scrollTo(0, 0); return true;`);
    await sleep(300);
    await shot('board', full);
  });
  await step('poetry', async () => {
    await open('reader', shore);
    await sleep(800);
    await shot('poetry', full);
  });

  // PDF
  await step('pdftools', async () => {
    await open('workspace', { ...pdf, format: 'PDF' });
    await sleep(1500);
    // Two pages fit the window's height, so all of page one's marks are in view.
    await js(`await __view('2 pages, as a book'); return true;`);
    await sleep(2500);
    await shot('pdftools', full);
  });
  await step('pdfgrid', async () => {
    await js(`await __view('6 pages (3×2)'); return true;`);
    await sleep(3500);
    await shot('pdfgrid', full);
    await js(`await __view('1 page'); return true;`);
    await sleep(600);
  });
  // (Black it out has its own shot with the other toolbar tools, at the end.)
  await step('workspace', async () => {
    await open('workspace', { ...pdf, format: 'PDF' });
    await sleep(1500);
  });
  await step('markspanel', async () => {
    await js(`__click('button', 'Show marks panel'); return true;`);
    await sleep(900);
    await shot('markspanel', full);
    await js(`__click('button', 'Hide marks panel'); return true;`);
    await sleep(400);
  });
  await step('archive', async () => {
    await js(`__click('button[aria-label="Export"]'); return true;`);
    await sleep(800);
    await shot('archive', full);
    await js(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true;`);
  });

  // More of the reader
  await step('focus', async () => {
    // A PDF in focus mode, the tools called in from the left edge, a tool picked.
    await open('workspace', { ...pdf, format: 'PDF' });
    await sleep(1500);
    await js(`await __view('2 pages, as a book'); return true;`);
    await sleep(2000);
    // The ··· menu that switched the view must be shut first, or it is left hanging at the top edge.
    await js(`if (document.querySelector('[data-more-menu]')) document.querySelector('[aria-label^="More:"]').click(); return true;`);
    await sleep(400);
    await key('f');
    await sleep(900);
    win.webContents.sendInputEvent({ type: 'mouseMove', x: 3, y: Math.round(HEIGHT / 2) });
    await sleep(600);
    await js(`document.querySelector('[role="toolbar"][aria-label^="Focus mode tools"] button[aria-label="Freehand arrow"]').click(); return true;`);
    win.webContents.sendInputEvent({ type: 'mouseMove', x: 3, y: Math.round(HEIGHT / 2) + 10 });
    await sleep(700);
    points.focus = { focus: await js(`return __pt(document.querySelector('[role="toolbar"][aria-label^="Focus mode tools"]'));`) };
    await shot('focus', full);
    await key('f');
    await sleep(400);
  });
  await step('ocr', async () => {
    // A scanned page (selecting on it reads it), and the toolbar panel for the whole document.
    await open('workspace', { ...scan, format: 'PDF' });
    await sleep(2500);
    await js(`__click('button[aria-label="Make scanned pages selectable"]'); return true;`);
    await sleep(700);
    points.ocr = { focus: await js(`return __pt(document.querySelector('[data-page-number="1"]'));`) };
    await shot('ocr', full);
    await js(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true;`);
  });
  await step('terminology', async () => {
    await open('reader', essay);
    await js(`document.getElementById('reader-para-2').scrollIntoView({ block: 'center' }); return true;`);
    await sleep(600);
    const r = await rectOf('#reader-para-2', undefined, 16);
    await shot('terminology', { x: r.x, y: r.y, width: Math.min(WIDTH - r.x, r.width + 300), height: Math.min(HEIGHT - r.y, r.height) });
  });
  await step('links', async () => {
    await open('reader', night);
    await js(`document.querySelector('mark[data-mark-ids~="n2"]').click(); return true;`);
    await sleep(900);
    await shot('links', full);
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
  });

  // Finding across the library
  await step('search', async () => {
    await open('home');
    await js(`__click('#desktop-sidebar-nav button', 'Search'); return true;`);
    await sleep(500);
    await js(`__type('[role="dialog"] input', 'moon'); return true;`);
    await sleep(1500);
    await shot('search', full);
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
  });
  await step('motif', async () => {
    await open('home');
    await js(`__click('button', 'Trace a motif'); return true;`);
    await sleep(700);
    await js(`__click('button', 'The moon'); return true;`);
    await sleep(1600);
    await shot('motif', full);
  });

  // Settings and Add Document
  await step('thememanager', async () => {
    await open('settings');
    await js(`const h = [...document.querySelectorAll('h2, h3, span')].find((e) => /themes/i.test(e.textContent) && e.closest('section, div')); (h.closest('section') || h.parentElement).scrollIntoView({ block: 'start' }); window.scrollBy(0, -24); return true;`);
    await sleep(600);
    await shot('thememanager', full);
  });
  await step('classpack', async () => {
    await open('upload');
    await js(`document.getElementById('class-pack-heading').scrollIntoView({ block: 'center' }); return true;`);
    await sleep(500);
    await shot('classpack', full);
  });

  // ── The toolbar, one tool at a time ──────────────────────────────────────
  // Each shot has the tool armed and an example of what it makes on page one. The points say
  // where the deck's pointer clicks the tool, then the mark (src/data/guidePoints.ts).
  let figureDoc = null;
  let inkArrowFocus = [0.6, 0.35];
  const figure = async () => {
    if (figureDoc) return figureDoc;
    figureDoc = await api('/documents', 'POST', { title: 'How a Reader Marks a Book', text: 'Figure', format: 'PDF', filename: 'figure.pdf' });
    await fetch(`${base}/api/documents/${figureDoc.id}/original?filename=figure.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await figurePdf() });
    return figureDoc;
  };
  /** A phrase's box on page one, in page fractions, read from the page's own text layer. */
  const phraseBox = (phrase) =>
    js(`
      const page = document.querySelector('[data-page-number="1"]');
      const box = page.getBoundingClientRect();
      const phrase = ${JSON.stringify(phrase)};
      const w = document.createTreeWalker(page.querySelector('.marginalia-text-layer'), NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const i = n.data.indexOf(phrase);
        if (i < 0) continue;
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + phrase.length);
        const b = r.getBoundingClientRect();
        return { x: (b.left - box.left) / box.width, y: (b.top - box.top) / box.height, w: b.width / box.width, h: b.height / box.height };
      }
      throw new Error('phrase not on page one: ' + phrase);
    `);
  const L = (k) => 0.122 + k * 0.0286; // lines of the first paragraph
  const P = (k) => 0.289 + k * 0.0286; // and of the second
  const mark = (id, kind, extra) => ({ id, page: 1, kind, color: '#4f8f7a', themeIds: ['1'], themeId: '1', author: 'Reader', createdAt: now, ...extra });
  const line = (k, w = 0.8, top = L) => ({ x: 0.093, y: top(k), w, h: 0.026 });
  const wave = (y) => Array.from({ length: 24 }, (_, i) => ({ x: 0.1 + i * 0.033, y: y + Math.sin(i / 2) * 0.012 }));
  const TOOLS = [
    { id: 'tool-select', label: 'Select', marks: [mark('t', 'rect', { color: '#3f6fb5', weight: 0.004, box: { x: 0.08, y: 0.275, w: 0.84, h: 0.155 } })], focus: [0.08, 0.35], click: [0.0805, 0.35] },
    { id: 'tool-highlight', label: 'Highlight', marks: [mark('t', 'highlight', { rects: [line(0), line(1, 0.5)], quote: 'Reading slowly' })], focus: [0.4, L(0) + 0.013] },
    { id: 'tool-underline', label: 'Underline', marks: [mark('t', 'underline', { color: '#6d6ad8', themeIds: ['2'], themeId: '2', rects: [line(0), line(1, 0.5)], quote: 'Reading slowly' })], focus: [0.4, L(1) + 0.02] },
    { id: 'tool-strikeout', label: 'Strikeout', marks: [mark('t', 'strikeout', { color: '#d97a2b', themeIds: ['3'], themeId: '3', rects: [line(1, 0.6)], quote: 'the margin' })], focus: [0.4, L(1) + 0.013] },
    // A chart has no words to select: the area highlight sits on the figure and its caption, with
    // the note it prompted beside it.
    {
      id: 'tool-area',
      label: 'Area highlight',
      doc: figure,
      marks: [
        mark('t', 'highlight', { area: true, color: '#d97a2b', themeIds: ['3'], themeId: '3', rects: [{ x: 0.08, y: 0.212, w: 0.84, h: 0.39 }] }),
        mark('n', 'note', { color: '#d97a2b', themeIds: ['3'], themeId: '3', noteStyle: 'translucent', text: 'Figure 1: the dip at chapter 4. Why there?', box: { x: 0.52, y: 0.618, w: 0.4, h: 0.085 } })
      ],
      focus: [0.5, 0.4]
    },
    { id: 'tool-pen', label: 'Pen', marks: [mark('t', 'ink', { color: '#d97a2b', weight: 0.004, points: wave(0.47) })], focus: [0.45, 0.47] },
    {
      // The freehand arrow curves round the text to the phrase it means, head on; a plain pen stroke
      // and a straight arrow beside it, each labelled, show the difference.
      id: 'tool-inkarrow',
      label: 'Freehand arrow',
      marks: async () => {
        // The paragraph's last words, so the head lands on blank page, not on the next line.
        const h = await phraseBox('before naming it');
        const end = { x: h.x + h.w * 0.55, y: h.y + h.h + 0.014 };
        const a = { x: 0.9, y: 0.62 };
        const c = { x: 0.62, y: 0.66 };
        const curve = Array.from({ length: 28 }, (_, i) => {
          const k = i / 27;
          return { x: (1 - k) ** 2 * a.x + 2 * (1 - k) * k * c.x + k * k * end.x, y: (1 - k) ** 2 * a.y + 2 * (1 - k) * k * c.y + k * k * end.y };
        });
        inkArrowFocus = [end.x, end.y + 0.03];
        const label = (id, color, text, box) => mark(id, 'text', { color, themeIds: [], themeId: null, text, fontSize: 0.03, font: 'hand', box });
        return [
          mark('hl', 'highlight', { color: '#d97a2b', themeIds: ['3'], themeId: '3', rects: [{ x: h.x - 0.004, y: h.y - 0.003, w: h.w + 0.008, h: h.h + 0.006 }], quote: 'before naming it' }),
          mark('fa', 'ink', { color: '#b5527a', weight: 0.005, arrowHead: true, points: curve }),
          label('fl', '#b5527a', 'Freehand arrow', { x: 0.66, y: 0.645, w: 0.32, h: 0.05 }),
          mark('pn', 'ink', { color: '#3f6fb5', weight: 0.005, points: Array.from({ length: 16 }, (_, i) => ({ x: 0.1 + i * 0.014, y: 0.47 + Math.sin(i / 1.6) * 0.008 })) }),
          label('pl', '#3f6fb5', 'Pen', { x: 0.1, y: 0.49, w: 0.2, h: 0.05 }),
          mark('sa', 'arrow', { color: '#4f8f7a', weight: 0.005, from: { x: 0.14, y: 0.66 }, to: { x: 0.38, y: 0.565 } }),
          label('sl', '#4f8f7a', 'Arrow', { x: 0.1, y: 0.67, w: 0.2, h: 0.05 })
        ];
      },
      focus: () => inkArrowFocus
    },
    // A finished box, and one being dragged out round the second paragraph.
    { id: 'tool-rect', label: 'Rectangle', marks: [mark('t', 'rect', { color: '#3f6fb5', weight: 0.004, box: { x: 0.08, y: 0.11, w: 0.84, h: 0.125 } })], drag: [[0.08, 0.275], [0.4, 0.33], [0.7, 0.4], [0.92, 0.43]], focus: [0.5, 0.3] },
    { id: 'tool-ellipse', label: 'Ellipse', marks: [mark('t', 'ellipse', { color: '#b5527a', weight: 0.004, box: { x: 0.3, y: 0.112, w: 0.34, h: 0.046 } })], focus: [0.47, 0.135] },
    { id: 'tool-arrow', label: 'Arrow', marks: [mark('t', 'arrow', { color: '#b5527a', weight: 0.004, from: { x: 0.82, y: 0.52 }, to: { x: 0.62, y: 0.36 } })], focus: [0.62, 0.36] },
    { id: 'tool-line', label: 'Line', marks: [mark('t', 'line', { color: '#3f6fb5', weight: 0.004, from: { x: 0.09, y: 0.448 }, to: { x: 0.9, y: 0.448 } })], focus: [0.5, 0.448] },
    { id: 'tool-bracket', label: 'Bracket', marks: [mark('t', 'bracket', { color: '#b5527a', weight: 0.004, bracketSide: 'left', box: { x: 0.05, y: 0.28, w: 0.025, h: 0.15 } })], focus: [0.06, 0.355] },
    {
      // All three styles, each in its theme's colour, with the style options open.
      id: 'tool-note',
      label: 'Note',
      marks: [
        mark('n1', 'note', { noteStyle: 'outline', text: 'Reading as keeping company.', box: { x: 0.07, y: 0.465, w: 0.27, h: 0.13 } }),
        mark('n2', 'note', { color: '#6d6ad8', themeIds: ['2'], themeId: '2', noteStyle: 'solid', text: 'Why a letter, not a talk?', box: { x: 0.365, y: 0.465, w: 0.27, h: 0.13 } }),
        mark('n3', 'note', { color: '#d97a2b', themeIds: ['3'], themeId: '3', noteStyle: 'translucent', text: 'The margin as a room.', box: { x: 0.66, y: 0.465, w: 0.27, h: 0.13 } })
      ],
      // A fourth note being written: two lines (Shift+Enter), its Save button in view.
      write: { at: [0.5, 0.3], text: 'Answer it,\nline by line.' },
      focus: 'editor'
    },
    {
      // A handwritten box already on the page, and one being typed (its frame shows while it is).
      id: 'tool-text',
      label: 'Text box',
      marks: [mark('t', 'text', { color: '#b5527a', themeIds: [], themeId: null, text: 'Compare with page 4!', fontSize: 0.034, font: 'hand', box: { x: 0.56, y: 0.47, w: 0.38, h: 0.07 } })],
      font: 'Hand',
      draw: { from: [0.08, 0.47], to: [0.52, 0.56], text: 'Read this twice, then once more.' },
      focus: [0.3, 0.515]
    },
    { id: 'tool-erase', label: 'Erase', marks: [mark('t', 'ink', { color: '#d97a2b', weight: 0.004, points: wave(0.47) })], focus: [0.43, 0.475] },
    {
      id: 'blackout',
      label: 'Black it out',
      marks: [
        { id: 'b1', page: 1, kind: 'rect', color: '#000000', themeIds: [], filled: true, blackout: true, weight: 0, box: { x: 0.091, y: L(1) - 0.002, w: 0.55, h: 0.03 }, author: 'Reader', createdAt: now },
        { id: 'b2', page: 1, kind: 'rect', color: '#000000', themeIds: [], filled: true, blackout: true, weight: 0, box: { x: 0.091, y: P(1) - 0.002, w: 0.8, h: 0.058 }, author: 'Reader', createdAt: now },
        { id: 'b3', page: 1, kind: 'ink', color: '#000000', themeIds: [], blackout: true, weight: 0.02, points: [{ x: 0.12, y: 0.48 }, { x: 0.3, y: 0.475 }, { x: 0.5, y: 0.485 }, { x: 0.68, y: 0.478 }], author: 'Reader', createdAt: now }
      ],
      focus: [0.4, L(1) + 0.012],
      options: true
    },
    { id: 'tool-undo', label: 'Undo', marks: [mark('t', 'highlight', { rects: [line(0)], quote: 'Reading slowly' })], focus: 'tool', noTool: true },
    { id: 'tool-more', label: 'More:', marks: [], focus: 'menu', noTool: true }
  ];
  for (const t of TOOLS) {
    await step(t.id, async () => {
      const doc = t.doc ? await t.doc() : pdf;
      let marks = t.marks;
      if (typeof marks === 'function') {
        // Marks placed against the page's real text: open it bare, measure, then lay them down.
        await api(`/documents/${doc.id}/annotations`, 'PUT', { annotations: [] });
        await open('workspace', { ...doc, format: 'PDF' });
        await sleep(1500);
        marks = await marks();
      }
      await api(`/documents/${doc.id}/annotations`, 'PUT', { annotations: marks });
      await open('workspace', { ...doc, format: 'PDF' });
      await sleep(1500);
      await js(`await __view('1 page'); window.scrollTo(0, 0); document.querySelector('[data-page-number="1"]').scrollIntoView({ block: 'start' }); return true;`);
      // Two steps out, so the whole top half of page one (and every example) is in the picture.
      await js(`document.querySelector('[aria-label^="More:"]').click(); await new Promise((r) => setTimeout(r, 300)); for (let i = 0; i < 2; i++) { document.querySelector('button[aria-label="Zoom out"]').click(); await new Promise((r) => setTimeout(r, 400)); } document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.querySelector('[data-page-number="1"]').scrollIntoView({ block: 'start' }); return true;`);
      await sleep(1200);
      const tool = await js(`return __pt(__tool(${JSON.stringify(t.label)}));`);
      await js(`__tool(${JSON.stringify(t.label)}).click(); return true;`);
      await sleep(500);
      if (t.font) {
        await js(`document.querySelector('button[aria-label="${t.font} typeface"]').click(); return true;`);
        await js(`document.querySelector('button[aria-label="Large text"]')?.click(); return true;`);
        await sleep(300);
      }
      if (t.keepOptions) {
        // The tool's options stay open: they are part of the picture.
      } else if (t.options) {
        await js(`if (![...document.querySelectorAll('button[role="radio"]')].some((b) => b.textContent.trim() === 'Words')) __click('button[aria-label="Black it out options"]'); return true;`);
      } else if (t.focus !== 'menu') {
        // Close the tool's options, which open over the page, the way a click elsewhere does.
        await js(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true;`);
      }
      await sleep(500);
      if (t.draw) {
        // Drawn and typed with the real mouse and keyboard, as a reader would.
        const a = await js(`return __pagePt(${t.draw.from[0]}, ${t.draw.from[1]});`);
        const b = await js(`return __pagePt(${t.draw.to[0]}, ${t.draw.to[1]});`);
        const px = (pt) => [Math.round((pt.x / 100) * WIDTH), Math.round((pt.y / 100) * HEIGHT)];
        const [x1, y1] = px(a);
        const [x2, y2] = px(b);
        win.webContents.sendInputEvent({ type: 'mouseMove', x: x1, y: y1 });
        win.webContents.sendInputEvent({ type: 'mouseDown', x: x1, y: y1, button: 'left', clickCount: 1 });
        for (let i = 1; i <= 12; i++) {
          win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x1 + ((x2 - x1) * i) / 12), y: Math.round(y1 + ((y2 - y1) * i) / 12), button: 'left' });
          await sleep(16);
        }
        win.webContents.sendInputEvent({ type: 'mouseUp', x: x2, y: y2, button: 'left', clickCount: 1 });
        await sleep(600);
        for (const ch of t.draw.text) {
          win.webContents.sendInputEvent({ type: 'char', keyCode: ch });
          await sleep(25);
        }
        await sleep(500);
        // Saved, so the words stand on the page in the box, which stays selected (its frame shows).
        await js(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase() === 'save').click(); return true;`);
        await sleep(700);
      }
      const toPx = (pt) => [Math.round((pt.x / 100) * WIDTH), Math.round((pt.y / 100) * HEIGHT)];
      let release = null;
      if (t.drag) {
        // Pressed and dragged, not let go: the picture shows the drag in progress.
        const pts = [];
        for (const [fx, fy] of t.drag) pts.push(toPx(await js(`return __pagePt(${fx}, ${fy});`)));
        win.webContents.focus();
        win.webContents.sendInputEvent({ type: 'mouseMove', x: pts[0][0], y: pts[0][1] });
        win.webContents.sendInputEvent({ type: 'mouseDown', x: pts[0][0], y: pts[0][1], button: 'left', clickCount: 1 });
        for (let i = 1; i < pts.length; i++) {
          for (let k = 1; k <= 6; k++) {
            const x = Math.round(pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / 6);
            const y = Math.round(pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / 6);
            win.webContents.sendInputEvent({ type: 'mouseMove', x, y, button: 'left', modifiers: ['leftButtonDown'] });
            await sleep(16);
          }
        }
        const last = pts[pts.length - 1];
        release = () => win.webContents.sendInputEvent({ type: 'mouseUp', x: last[0], y: last[1], button: 'left', clickCount: 1 });
        await sleep(300);
      }
      if (t.write) {
        // Placed with a real click, then written: the editor stays open with Save in view.
        const [x, y] = toPx(await js(`return __pagePt(${t.write.at[0]}, ${t.write.at[1]});`));
        win.webContents.focus();
        for (const type of ['mouseMove', 'mouseDown', 'mouseUp']) win.webContents.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
        await sleep(700);
        await typeText(t.write.text);
        await sleep(400);
      }
      if (t.click) {
        const at = await js(`return __pagePt(${t.click[0]}, ${t.click[1]});`);
        const x = Math.round((at.x / 100) * WIDTH);
        const y = Math.round((at.y / 100) * HEIGHT);
        for (const type of ['mouseMove', 'mouseDown', 'mouseUp']) win.webContents.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
        await sleep(700);
      }
      const focus =
        t.focus === 'tool'
          ? tool
          : t.focus === 'editor'
            ? await js(`return __pt(document.querySelector('textarea'));`)
            : t.focus === 'menu'
            ? await js(`return __pt(document.querySelector('[role="radiogroup"][aria-label="Pages in view"]').parentElement);`)
            : await js(`return __pagePt(${(typeof t.focus === 'function' ? t.focus() : t.focus)[0]}, ${(typeof t.focus === 'function' ? t.focus() : t.focus)[1]});`);
      points[t.id] = t.noTool ? { focus } : { tool, focus };
      await shot(t.id, full);
      if (release) release();
      await sleep(200);
    });
  }
  // Reader toolbar: add a note, and the marks pill that shows or hides the margin notes.
  await step('tool-addnote', async () => {
    await open('reader', essay);
    const tool = await js(`return __pt(document.querySelector('button[aria-label="Add a note to the current paragraph"]'));`);
    await js(`__click('button[aria-label="Add a note to the current paragraph"]'); return true;`);
    await sleep(900);
    await typeText('A letter, not a lecture:\nanswer it line by line.');
    await sleep(400);
    const focus = await js(`const el = document.activeElement && document.activeElement !== document.body ? document.activeElement : document.querySelector('textarea'); return __pt(el);`);
    points['tool-addnote'] = { tool, focus };
    await shot('tool-addnote', full);
  });
  await step('tool-collapse', async () => {
    await open('reader', essay);
    const tool = await js(`return __pt(document.querySelector('button[aria-label="Collapse to marks"]'));`);
    await js(`__click('button[aria-label="Collapse to marks"]'); return true;`);
    await sleep(900);
    await js(`window.scrollTo(0, 0); return true;`);
    await sleep(300);
    const focus = await js(`return __pt(document.querySelector('.collapse-fold-btn'));`);
    points['tool-collapse'] = { tool, focus };
    await shot('tool-collapse', full);
  });
  await step('tool-notes', async () => {
    await open('reader', night);
    await js(`document.getElementById('reader-para-2').scrollIntoView({ block: 'center' }); return true;`);
    await sleep(700);
    const tool = await js(`return __pt([...document.querySelectorAll('button[title]')].find((b) => /margin notes|Back to reading/.test(b.title)));`);
    const focus = await js(`const el = [...document.querySelectorAll('*')].reverse().find((e) => e.children.length === 0 && e.textContent.trim() === 'Rereading'); return __pt(el.parentElement);`);
    points['tool-notes'] = { tool, focus };
    await shot('tool-notes', full);
  });
  const pointsFile = path.join(ROOT, 'src', 'data', 'guidePoints.ts');
  if (ONLY) {
    // Only some pictures were remade: keep every other card's points as they were.
    const old = fs.readFileSync(pointsFile, 'utf8');
    const kept = JSON.parse(old.slice(old.indexOf('= ') + 2).replace(/;\s*$/, ''));
    for (const [id, v] of Object.entries(kept)) if (!ONLY.has(id)) points[id] = v;
  }
  fs.writeFileSync(
    pointsFile,
    `/**\n * Made by scripts/capture-guide.cjs with the pictures: where each toolbar card's pointer clicks the\n * tool, then the mark it made, in percent of the picture. Do not edit by hand; re-run\n * \`npm run guide:capture\`.\n */\n\nexport const GUIDE_POINTS: Record<string, { tool?: { x: number; y: number }; focus: { x: number; y: number } }> = ${JSON.stringify(points, null, 2)};\n`
  );

  console.log(`[guide] made ${made.length} pictures in ${path.relative(ROOT, OUT)}`);
  win.destroy();
  fs.rmSync(store, { recursive: true, force: true });
  app.exit(0);
}

app.disableHardwareAcceleration();
// The scanned sample is drawn in a window of its own; closing it must not quit the capture.
app.on('window-all-closed', () => {});
app.whenReady().then(main).catch((err) => {
  console.error('[guide] failed:', err);
  app.exit(1);
});
