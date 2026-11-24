/**
 * Makes the step frames for "Getting the most from Marginalia" (src/data/guide.ts), from the real
 * app, so the guide shows exactly what a reader sees.
 *
 *   npm run guide:capture        (builds first; writes src/assets/guide/steps/<id>/<n>.jpg and
 *                                 src/data/guideSteps.generated.ts; `--only a,b` for some cards)
 *
 * It starts the built server on a throwaway library in the temp folder (never the reader's own),
 * fills it with sample documents and marks, opens the app in an offscreen window at 1280×800 and
 * walks it screen by screen. Run it again after changing anything the guide shows.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const G = require('./guide-steps.cjs');

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

/**
 * A two-page scan for the step card: page one dense (read on its own while it is in view, which
 * takes a while), page two a few lines, so a drag on page two is the reader's own read.
 */
async function ocrScanPdf() {
  const W = 1240;
  const H = 1754;
  const w = new BrowserWindow({ show: false });
  await w.loadURL('data:text/html,<html><body></body></html>');
  const paras = ESSAY.split('\n\n');
  const lines = (text) => text.match(/.{1,52}(\s|$)/g).map((l) => l.trim());
  const draw = (title, text, size, gap) =>
    w.webContents.executeJavaScript(`(() => {
      const c = document.createElement('canvas'); c.width = ${W}; c.height = ${H};
      const g = c.getContext('2d'); g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#222'; g.font = 'bold 44px Georgia, serif'; g.fillText(${JSON.stringify(title)}, 110, 190);
      g.font = '${size}px Georgia, serif';
      ${JSON.stringify(lines(text))}.forEach((l, i) => g.fillText(l, 110, 290 + i * ${gap}));
      return c.toDataURL('image/png');
    })()`);
  const pngs = [await draw('On Marginalia, page 1', paras.slice(0, 5).join(' '), 30, 44), await draw('On Marginalia, page 2', paras[5], 34, 54)];
  w.destroy();
  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.create();
  for (const png of pngs) {
    const image = await doc.embedPng(Buffer.from(png.split(',')[1], 'base64'));
    doc.addPage([420, 595]).drawImage(image, { x: 0, y: 0, width: 420, height: 595 });
  }
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
  window.__tool = (label) => {
    const b = [...document.querySelectorAll('button[aria-label]')].find((e) => e.getAttribute('aria-label').startsWith(label) && !e.getAttribute('aria-label').includes('options'));
    if (!b) throw new Error('no tool ' + label);
    return b;
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
  // Step targets (scripts/guide-steps.cjs): __measure takes an element, a text range or a box with
  // its element, and keeps that element so __hits can check the pointer's real landing spot.
  window.__measure = (t) => {
    const real = t instanceof Element || t instanceof Range;
    window.__target = t instanceof Element ? t : t instanceof Range ? t.startContainer.parentElement : t.el;
    const r = real ? t.getBoundingClientRect() : t;
    if (!r.width || !r.height) throw new Error('step target has no size');
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };
  window.__hits = (x, y) => {
    const at = document.elementFromPoint(x, y);
    const t = window.__target;
    const scope = t.closest('[data-page-number], [id^="reader-para-text-"]');
    return !!at && (t.contains(at) || (!!scope && scope.contains(at)));
  };
  // A 4px slice just inside the first character of a phrase ('start') or its last ('end').
  window.__edge = (phrase, edge, scopeSel) => {
    const w = document.createTreeWalker(document.querySelector(scopeSel), NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const i = n.data.indexOf(phrase);
      if (i < 0) continue;
      const k = edge === 'start' ? i : i + phrase.length - 1;
      const r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + 1);
      const b = r.getBoundingClientRect();
      return { left: edge === 'start' ? b.left + 1 : b.right - 5, top: b.top, width: 4, height: b.height, el: n.parentElement };
    }
    throw new Error('phrase not found: ' + phrase);
  };
  // A 4px spot dx, dy px off a phrase's first ('start') or last ('end') character on page one.
  window.__near = (phrase, edge, dx, dy) => {
    const b = window.__edge(phrase, edge, '[data-page-number="1"] .marginalia-text-layer');
    return { left: b.left + dx, top: b.top + b.height / 2 + dy - 2, width: 4, height: 4, el: document.querySelector('[data-page-number="1"]') };
  };
  // A button by its exact words.
  window.__btn = (words) => {
    const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === words);
    if (!b) throw new Error('no button ' + words);
    return b;
  };
  // A 4px spot on PDF page n (default one), in page fractions; a page shown off stage is skipped.
  window.__spot = (fx, fy, n = 1) => {
    const el = document.querySelector('[data-page-number="' + n + '"]:not([data-offstage])');
    const r = el.getBoundingClientRect();
    return { left: r.left + fx * r.width - 2, top: r.top + fy * r.height - 2, width: 4, height: 4, el };
  };
  // An element scrolled into view first (a target below the fold).
  window.__see = (el) => { el.scrollIntoView({ block: 'center', behavior: 'instant' }); return el; };
  // The field typing lands in.
  window.__focused = () => {
    const el = document.activeElement;
    if (!el || el === document.body) throw new Error('nothing has focus to type into');
    return el;
  };
  // The innermost element whose text has these words (outside text fields).
  window.__leaf = (words, scopeSel = 'body') => {
    const el = [...document.querySelector(scopeSel).querySelectorAll('*')].reverse().find((e) => !/^(TEXTAREA|INPUT|SCRIPT|STYLE)$/.test(e.tagName) && e.textContent.includes(words) && e.getBoundingClientRect().width > 0);
    if (!el) throw new Error('no element with ' + words);
    return el;
  };
  // A 4px spot against the window's left edge, where focus mode's tools wait.
  window.__leftEdge = () => {
    const y = Math.round(innerHeight / 2);
    return { left: 4, top: y - 2, width: 4, height: 4, el: document.elementFromPoint(6, y) };
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
  const ocrScan = await api('/documents', 'POST', { title: 'An Essay on Paper', text: 'Scanned', format: 'PDF', filename: 'essay-on-paper.pdf' });
  await fetch(`${base}/api/documents/${ocrScan.id}/original?filename=essay-on-paper.pdf`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: await ocrScanPdf()
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
  // Exports and class packs are saved into the throwaway library, never the reader's folders.
  let lastDownload = null;
  win.webContents.session.on('will-download', (_e, item) => {
    fs.mkdirSync(path.join(store, 'downloads'), { recursive: true });
    lastDownload = path.join(store, 'downloads', item.getFilename());
    item.setSavePath(lastDownload);
  });
  const js = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
  const helpers = () => win.webContents.executeJavaScript(PAGE_HELPERS);

  /** Opens a screen (and a document) the way a reload of the app would restore it. */
  const open = async (screen, doc, settle = 2200) => {
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
    await sleep(settle);
    await helpers();
  };

  // `--only a,b` (or GUIDE_ONLY=...) remakes just those cards (and merges their steps); unset = all.
  const ONLY = G.parseOnly(process.argv, process.env);
  const full = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
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
  /** One page in view, two zoom steps out, so the whole top half of page one is in the picture. */
  const pageOneView = async () => {
    await js(`await __view('1 page'); window.scrollTo(0, 0); document.querySelector('[data-page-number="1"]').scrollIntoView({ block: 'start' }); return true;`);
    await js(`document.querySelector('[aria-label^="More:"]').click(); await new Promise((r) => setTimeout(r, 300)); for (let i = 0; i < 2; i++) { document.querySelector('button[aria-label="Zoom out"]').click(); await new Promise((r) => setTimeout(r, 400)); } document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.querySelector('[data-page-number="1"]').scrollIntoView({ block: 'start' }); return true;`);
    await sleep(1200);
  };

  // A figure PDF (made once, on first use) and marks for page one.
  let figureDoc = null;
  const figure = async () => {
    if (figureDoc) return figureDoc;
    figureDoc = await api('/documents', 'POST', { title: 'How a Reader Marks a Book', text: 'Figure', format: 'PDF', filename: 'figure.pdf' });
    await fetch(`${base}/api/documents/${figureDoc.id}/original?filename=figure.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await figurePdf() });
    return figureDoc;
  };
  const mark = (id, kind, extra) => ({ id, page: 1, kind, color: '#4f8f7a', themeIds: ['1'], themeId: '1', author: 'Reader', createdAt: now, ...extra });
  const wave = (y) => Array.from({ length: 24 }, (_, i) => ({ x: 0.1 + i * 0.033, y: y + Math.sin(i / 2) * 0.012 }));
  // Each card: `setup` opens the screen; `steps` are real mouse and keyboard actions. `target` is
  // page code giving an element, a text range or an __edge/__spot box; the pointer goes to its
  // measured centre (checked to land on it), the action runs, and the frame taken after it is
  // steps/<card>/<n>.jpg. Step 0 is a hover onto the first target, so its frame is the screen
  // before anything is done. `after` = page code run before the frame; `via` = a drag's waypoints.
  // A key or typing step with no target keeps the pointer where the last step left it.
  const MOD = process.platform === 'darwin' ? 'meta' : 'control';
  const TL = `'[data-page-number="1"] .marginalia-text-layer'`;
  const edge = (phrase, side) => `__edge(${JSON.stringify(phrase)}, '${side}', ${TL})`;
  const near = (phrase, side, dx, dy) => `__near(${JSON.stringify(phrase)}, '${side}', ${dx}, ${dy})`;
  const spot = (fx, fy) => `__spot(${fx}, ${fy})`;
  const tool = (label) => `__tool(${JSON.stringify(label)})`;
  const opt = (sel) => `__q('[data-chip-menu] ${sel}')`;
  /** A PDF on page one (the essay, or the figure), with these marks on it and nothing else. */
  const onPdf = (marks = [], docFn) => async () => {
    const doc = docFn ? await docFn() : pdf;
    await api(`/documents/${doc.id}/annotations`, 'PUT', { annotations: marks });
    await open('workspace', { ...doc, format: 'PDF' });
    await sleep(1500);
    await pageOneView();
  };
  /** Hover onto the tool, then pick it up (its options open with it). */
  const pick = (label) => [
    { action: 'hover', target: tool(label) },
    { action: 'click', target: tool(label) }
  ];
  const squiggle = Array.from({ length: 9 }, (_, i) => [0.1 + i * 0.05, 0.37 + (i % 2 ? 0.012 : -0.008)]);
  // Put down the finished mark (Escape), so its property strip does not cover the page in the last frame.
  const letGo = true;
  /** The library's settings as seeded, with some changed: each card starts from a known state. */
  const settingsWith = (over = {}) => api('/settings', 'PUT', { settings: { ...settings, readerSpread: false, ...over } });
  const reader = (doc, marks, over) => async () => {
    await settingsWith(over);
    if (marks) await api(`/documents/${doc.id}/annotations`, 'PUT', { annotations: marks });
    await open('reader', doc);
  };
  const home = (screen = 'home', scrollSel) => async () => {
    await settingsWith();
    await open(screen);
    if (scrollSel) {
      await js(`document.querySelector(${JSON.stringify(scrollSel)}).scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy(0, -16); return true;`);
      await sleep(600);
    }
  };
  /** A phrase's first or last character in reader paragraph p. */
  const redge = (p, phrase, side) => `__edge(${JSON.stringify(phrase)}, '${side}', '#reader-para-text-${p}')`;
  const menu = (sel, text) => `__q('[aria-label="Mark the selection"] ${sel}'${text ? `, ${JSON.stringify(text)}` : ''})`;
  const wait = (ms) => `await new Promise((r) => setTimeout(r, ${ms}))`;
  const until = (cond, ms = 30000) =>
    `for (const t0 = performance.now(); !(${cond}); await new Promise((r) => setTimeout(r, 150))) if (performance.now() - t0 > ${ms}) throw new Error('waited too long for ' + ${JSON.stringify(cond)})`;
  const pdfOpen = (marks, after) => async () => {
    await settingsWith();
    await api(`/documents/${pdf.id}/annotations`, 'PUT', { annotations: marks });
    await open('workspace', { ...pdf, format: 'PDF' });
    await sleep(1500);
    if (after) await after();
  };
  const without = (list, ...ids) => list.filter((m) => !ids.includes(m.id));
  const nightUnlinked = () => nightMarks().map(({ links, ...m }) => m);

  function featureCards() {
    return {
      shelf: {
        setup: home(),
        steps: [
          { action: 'hover', target: `__q('.shelf-spine[aria-label^="Night Songs"]')` },
          { action: 'click', target: `__q('.shelf-spine[aria-label^="Night Songs"]')`, after: wait(1600) },
          { action: 'click', target: `__q('.shelf-primary')`, after: wait(2200) }
        ]
      },
      reader: {
        setup: reader(essay, essayMarks()),
        steps: [...pick('Highlight'), { action: 'drag', target: redge(0, 'keeping company', 'start'), to: redge(0, 'with a book', 'end'), letGo }]
      },
      spread: {
        setup: reader(essay, essayMarks()),
        steps: [
          { action: 'hover', target: `__q('button[aria-label="Two-page spread"]')` },
          { action: 'click', target: `__q('button[aria-label="Two-page spread"]')`, after: wait(1200) },
          { action: 'click', target: `__q('button[aria-label="Next pages (Right arrow)"]')`, after: wait(900) },
          { action: 'key', keys: '→', after: wait(900) }
        ]
      },
      poetry: {
        setup: reader(shore, null, { poetry: { [night.id]: settings.poetry[night.id] } }),
        steps: [
          { action: 'hover', target: `__q('button[aria-label="Poetry view"]')` },
          { action: 'click', target: `__q('button[aria-label="Poetry view"]')` },
          { action: 'click', target: `__q('[aria-labelledby="poetry-panel-title"] label', 'Read this as a poem').querySelector('input')` },
          { action: 'click', target: `__q('[aria-labelledby="poetry-panel-title"] button[role="radio"]', 'Lines')` },
          { action: 'click', target: `__q('[aria-labelledby="poetry-panel-title"] button[aria-label="Close"]')` }
        ]
      },
      pdfgrid: {
        // Page 3 is drawn once at reading size first: offscreen, a page opened from the grid is
        // only shown from the page-image cache (a normal window draws it at once).
        setup: pdfOpen(pdfMarks(), async () => {
          await js(`document.querySelector('[data-page-number="3"]').scrollIntoView({ block: 'start', behavior: 'instant' }); ${until(`document.querySelector('[data-page-number="3"][data-painted]')`)}; ${wait(800)}; document.querySelector('[data-page-number="1"]').scrollIntoView({ block: 'start', behavior: 'instant' }); return true;`);
          await sleep(800);
        }),
        steps: [
          { action: 'hover', target: `__q('[aria-label^="More:"]')` },
          { action: 'click', target: `__q('[aria-label^="More:"]')` },
          { action: 'click', target: `__q('[data-more-menu] button[role="radio"]', '4 pages')`, after: wait(2500) },
          { action: 'click', target: `__q('button[aria-label="Open page 3 at reading size"]')`, after: wait(2500) }
        ]
      },
      focus: {
        setup: pdfOpen([], async () => {
          await js(`await __view('2 pages, as a book'); return true;`);
          await sleep(2000);
          await js(`if (document.querySelector('[data-more-menu]')) document.querySelector('[aria-label^="More:"]').click(); return true;`);
          await sleep(400);
        }),
        steps: [
          { action: 'hover', target: `__q('button[aria-label^="Focus mode"]')` },
          { action: 'click', target: `__q('button[aria-label^="Focus mode"]')` },
          { action: 'hover', target: `__leftEdge()` },
          { action: 'click', target: `__q('[role="toolbar"][aria-label^="Focus mode tools"] button[aria-label^="Highlight"]')` },
          { action: 'drag', target: edge('Reading slowly', 'start'), to: edge('company', 'end'), letGo },
          { action: 'key', keys: 'Esc', after: wait(600) }
        ]
      },
      popover: {
        setup: reader(essay, essayMarks()),
        steps: [
          { action: 'hover', target: redge(0, 'a way of answering', 'start') },
          { action: 'drag', target: redge(0, 'a way of answering', 'start'), to: redge(0, 'line by line', 'end') },
          { action: 'click', target: menu('button[aria-label^="Theme: Questions"]') },
          { action: 'click', target: menu('button[aria-label^="Highlight"]'), letGo }
        ]
      },
      overlap: {
        setup: async () => {
          await reader(essay, essayMarks())();
          await js(`document.getElementById('reader-para-3').scrollIntoView({ block: 'center', behavior: 'instant' }); return true;`);
          await sleep(600);
        },
        steps: [
          { action: 'hover', target: redge(3, 'the moon over water', 'start') },
          { action: 'drag', target: redge(3, 'the moon over water', 'start'), to: redge(3, 'the moon over water', 'end') },
          { action: 'click', target: menu('button[aria-label^="Theme: Memory"]') },
          { action: 'click', target: menu('button[aria-label^="Highlight"]'), letGo },
          { action: 'hover', target: `__q('#reader-para-text-3 mark')` }
        ]
      },
      terminology: {
        setup: reader(essay, without(essayMarks(), 'e2')),
        steps: [
          { action: 'hover', target: redge(2, 'commonplace books', 'start') },
          { action: 'drag', target: redge(2, 'commonplace books', 'start'), to: redge(2, 'commonplace books', 'end') },
          { action: 'click', target: menu('button[aria-label="Mark as a terminology term"]'), letGo },
          {
            action: 'click',
            target: `__q('#desktop-sidebar-nav button', 'My Collections')`,
            after: `${wait(1200)}; document.querySelector('[aria-label="My Margins Tracker views"]').closest('section').scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy(0, -16)`
          },
          { action: 'click', target: `__q('#studio-tab-terminology')` },
          { action: 'click', target: `__q('button[aria-label="Show marks in On Marginalia"]')` }
        ]
      },
      ocr: {
        setup: async () => {
          await settingsWith();
          // Pages in view are read on their own within a second or two of opening: Cancel on the first
          // read pauses that for this book, so the drag below reads page two and its frame shows it.
          await open('workspace', { ...ocrScan, format: 'PDF' }, 0);
          await js(`${until(`document.querySelector('[data-ocr-page] button')`, 10000)}; __q('[data-ocr-page] button', 'Cancel').click(); return true;`);
          await sleep(800);
          await js(`await __view('2 pages, as a book'); return true;`);
          await js(`if (document.querySelector('[data-more-menu]')) document.querySelector('[aria-label^="More:"]').click(); return true;`);
          await js(`${until(`document.querySelector('[data-page-number="2"]:not([data-offstage])[data-painted]')`)}; return true;`);
          if (await js(`return !!document.querySelector('[data-page-number="2"]:not([data-offstage]) [data-ocr]');`)) throw new Error('ocr: page two was read before the drag');
        },
        steps: [
          ...pick('Highlight'),
          {
            action: 'drag',
            target: `__spot(0.1, 0.158, 2)`,
            to: `__spot(0.62, 0.158, 2)`,
            // A read takes about a second: the frame is taken while it runs.
            settle: 300,
            after: until(`document.querySelector('[data-page-number="2"]:not([data-offstage]) [data-ocr-page]')`, 3000)
          },
          {
            action: 'hover',
            target: `__spot(0.4, 0.2, 2)`,
            after: `${until(`document.querySelector('[data-page-number="2"]:not([data-offstage]) [data-ocr]') && !document.querySelector('[data-page-number="2"]:not([data-offstage]) [data-ocr-page]')`, 60000)}; ${wait(1200)}`
          }
        ]
      },
      pdftools: {
        setup: onPdf(),
        steps: [
          ...pick('Pen'),
          { action: 'drag', target: spot(...squiggle[0]), via: squiggle.slice(1, -1).map((p) => spot(...p)), to: spot(...squiggle[squiggle.length - 1]), letGo },
          { action: 'click', target: tool('Rectangle') },
          { action: 'drag', target: spot(0.075, 0.105), to: spot(0.925, 0.215), letGo }
        ]
      },
      links: {
        setup: reader(night, nightUnlinked()),
        steps: [
          { action: 'hover', target: `__q('mark[data-mark-ids~="n1"]')` },
          { action: 'click', target: `__q('mark[data-mark-ids~="n1"]')` },
          { action: 'click', target: `__q('button[aria-label="Link to another mark"]')` },
          { action: 'click', target: `__q('[aria-label="Linked marks"] button', 'The moon came in')` },
          { action: 'click', target: `__q('[aria-label="Linked marks"] button[title="Go to this mark"]')`, after: wait(900) }
        ]
      },
      margin: {
        setup: async () => {
          await reader(night, without(nightMarks(), 'n5'))();
          await js(`document.getElementById('reader-para-2').scrollIntoView({ block: 'center', behavior: 'instant' }); return true;`);
          await sleep(600);
        },
        steps: [
          { action: 'hover', target: redge(2, 'I read it twice', 'start') },
          { action: 'drag', target: redge(2, 'I read it twice', 'start'), to: redge(2, 'I read it twice', 'end') },
          { action: 'click', target: menu('button[aria-label^="Sticky note"]') },
          { action: 'type', keys: 'Read the way the poem asks: twice.' },
          { action: 'key', keys: 'Enter' },
          { action: 'hover', target: `__leaf('Read the way the poem asks')` }
        ]
      },
      board: {
        setup: reader(night, nightMarks()),
        steps: [
          { action: 'hover', target: `__q('button[title^="Excerpt board"]')` },
          { action: 'click', target: `__q('button[title^="Excerpt board"]')`, after: `${wait(600)}; window.scrollTo(0, 0)` },
          { action: 'click', target: `__q('[aria-label="Excerpts not on the board"] button', 'gives off its light')` },
          // From the excerpt farthest away, so the new link is a long line, not a stub between neighbours.
          { action: 'click', target: `__q('[role="group"][aria-label^="Excerpt: The moon came in"] button[aria-label="Link to another excerpt"]')` },
          { action: 'click', target: `__q('[role="group"][aria-label^="Excerpt: gives off"] p')` },
          { action: 'click', target: `__q('[role="group"][aria-label^="Excerpt: gives off"] button[aria-label="Show in the text"]')`, after: wait(900) }
        ]
      },
      tagging: {
        setup: reader(essay, essayMarks()),
        steps: [
          { action: 'hover', target: `__q('button[data-theme-id="3"]')` },
          { action: 'click', target: `__q('button[data-theme-id="3"]')` },
          { action: 'click', target: tool('Highlight') },
          { action: 'drag', target: redge(0, 'Reading slowly', 'start'), to: redge(0, 'keeping company', 'end') },
          { action: 'click', target: `__q('button[data-theme-id="2"]')` },
          { action: 'drag', target: redge(1, 'Every reader', 'start'), to: redge(1, 'private index', 'end'), letGo }
        ]
      },
      tracker: {
        setup: home('home', '[aria-label="My Margins Tracker views"]'),
        steps: [
          { action: 'hover', target: `__q('#studio-tab-themes')` },
          { action: 'click', target: `__q('#studio-tab-themes')` },
          { action: 'click', target: `__q('button[aria-label="Show marks in Night Songs"]')` },
          { action: 'click', target: `__q('#studio-tab-terminology')` },
          { action: 'click', target: `__q('button[aria-label="Show marks in On Marginalia"]')` }
        ]
      },
      search: {
        setup: home(),
        steps: [
          { action: 'hover', target: `__q('#desktop-sidebar-nav button', 'Search')` },
          { action: 'click', target: `__q('#desktop-sidebar-nav button', 'Search')` },
          { action: 'type', keys: 'moon', after: wait(1200) },
          { action: 'click', target: `__q('[aria-label="Search My Collections"] button', 'The moon is up')`, after: wait(1500) }
        ]
      },
      markspanel: {
        setup: pdfOpen(
          [...pdfMarks(), { id: 'p8', page: 5, kind: 'highlight', color: '#d97a2b', themeId: '3', themeIds: ['3'], author: 'Reader', createdAt: now, rects: [{ x: 0.093, y: 0.122, w: 0.79, h: 0.028 }], quote: 'A note in the margin should sit beside the line' }],
          pageOneView
        ),
        steps: [
          { action: 'hover', target: `__q('button[aria-label="Show marks panel"]')` },
          { action: 'click', target: `__q('button[aria-label="Show marks panel"]')` },
          { action: 'click', target: `__q('[role="group"][aria-label="Show only"] button', 'Highlight')` },
          { action: 'click', target: `__q('button[title="Go to this mark"]', 'A note in the margin')`, after: wait(1200) }
        ]
      },
      motif: {
        setup: home(),
        steps: [
          { action: 'hover', target: `__see(__q('button', 'Trace a motif'))` },
          { action: 'click', target: `__see(__q('button', 'Trace a motif'))` },
          { action: 'type', keys: 'moon, sea' },
          { action: 'click', target: `__q('[aria-labelledby="motif-title"] button[type="submit"]')`, after: until(`document.querySelector('[aria-labelledby="motif-title"] li button')`) },
          { action: 'click', target: `__q('[aria-labelledby="motif-title"] li button', 'moon')`, after: wait(1500) }
        ]
      },
      export: {
        setup: reader(essay, essayMarks()),
        steps: [
          { action: 'hover', target: `__q('#reader-bar-export-btn')` },
          { action: 'click', target: `__q('#reader-bar-export-btn')`, after: wait(500) },
          { action: 'click', target: `[...document.querySelectorAll('main button[aria-pressed]')].find((b) => !b.hasAttribute('data-theme-id') && b.textContent.trim() === 'Key Concepts')` },
          { action: 'click', target: `__q('main button', 'Markdown (.md)')` },
          // The app saves the file with no message of its own: the last frame is the saved file, opened.
          { action: 'hover', opens: () => lastDownload, target: `__q('pre')` }
        ]
      },
      archive: {
        setup: async () => {
          await api(`/documents/${pdf.id}/annotations`, 'PUT', { annotations: pdfMarks() });
          await api(`/documents/${pdf.id}/backups/checkpoint`, 'POST');
          await pdfOpen(pdfMarks().filter((m) => m.id === 'p1'), pageOneView)();
        },
        steps: [
          { action: 'hover', target: `__q('button[aria-label="Export"]')` },
          { action: 'click', target: `__q('button[aria-label="Export"]')` },
          { action: 'click', target: `__btn('Restore marks…')` },
          { action: 'click', target: `__q('[role="radiogroup"][aria-label="Backups"] button')` },
          { action: 'click', target: `__q('[aria-labelledby="restore-marks-title"] button', 'Restore')`, after: wait(1200) }
        ]
      },
      classpack: {
        setup: pdfOpen(pdfMarks(), pageOneView),
        steps: [
          { action: 'hover', target: `__q('button[aria-label="Export"]')` },
          { action: 'click', target: `__q('button[aria-label="Export"]')` },
          { action: 'click', target: `__btn('Save class pack')`, after: wait(1500) },
          { action: 'click', target: `__q('#desktop-sidebar-nav button', 'Add Document')`, after: `${wait(900)}; document.getElementById('class-pack-heading').scrollIntoView({ block: 'center', behavior: 'instant' })` },
          { action: 'click', target: `__btn('Choose file…')`, chooses: { input: 'input[type="file"][accept^=".marginalia-class"]', file: () => lastDownload }, after: `${until(`!document.getElementById('class-pack-heading') && document.querySelector('[data-page-number="1"][data-painted]')`)}; ${wait(1200)}` }
        ]
      },
      // Last: it adds a theme to the library.
      thememanager: {
        setup: home('settings', '#settings-active-themes-section'),
        steps: [
          { action: 'hover', target: `__q('#settings-active-themes-section button', 'New theme')` },
          { action: 'click', target: `__q('#settings-active-themes-section button', 'New theme')` },
          { action: 'type', keys: 'Ethics' },
          { action: 'click', target: `__see([...document.querySelectorAll('[role="radiogroup"][aria-label="New theme colour"] button')][5])` },
          { action: 'click', target: `__see(__btn('Create theme'))`, after: `${wait(500)}; __leaf('Ethics', '#settings-active-themes-section').scrollIntoView({ block: 'center', behavior: 'instant' })` }
        ]
      }
    };
  }

  /**
   * The shortcuts card: one script per SHORTCUTS entry (data/guide.ts), `key-<demo>`. Each presses
   * its key for real, then shows what it did; the last frame is the finished result.
   */
  function keyCards() {
    /** The essay PDF on page one, from the seeded settings, with these marks. */
    const keyPdf = (marks = [], after, docFn) => async () => {
      await settingsWith();
      const doc = docFn ? await docFn() : pdf;
      await api(`/documents/${doc.id}/annotations`, 'PUT', { annotations: marks });
      await open('workspace', { ...doc, format: 'PDF' });
      await sleep(1500);
      await pageOneView();
      if (after) await after();
    };
    const book = async () => {
      await js(`await __view('2 pages, as a book'); return true;`);
      await sleep(2000);
      await js(`if (document.querySelector('[data-more-menu]')) document.querySelector('[aria-label^="More:"]').click(); return true;`);
      await sleep(400);
    };
    const press = (k) => js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true })); return true;`);
    // i = 6 of wave(y): a point the line passes through.
    const onWave = (y) => spot(0.298, y + Math.sin(3) * 0.012);
    const squiggle2 = Array.from({ length: 9 }, (_, i) => [0.14 + i * 0.05, 0.6 + (i % 2 ? 0.014 : -0.01)]);
    const mark1 = { id: 'k1', page: 1, kind: 'highlight', color: '#4f8f7a', themeId: '1', themeIds: ['1'], author: 'Reader', createdAt: now, rects: [{ x: 0.093, y: 0.122, w: 0.79, h: 0.028 }], quote: 'Reading slowly is a way of keeping company' };
    return {
      'key-highlight': {
        setup: keyPdf(),
        steps: [
          { action: 'hover', target: edge('The pencil', 'start') },
          { action: 'key', keys: 'H' },
          { action: 'drag', target: edge('The pencil', 'start'), to: edge('the margin', 'end'), letGo }
        ]
      },
      'key-underline': {
        setup: keyPdf(),
        steps: [
          { action: 'hover', target: edge('the shape', 'start') },
          { action: 'key', keys: 'U' },
          { action: 'drag', target: edge('the shape', 'start'), to: edge('a reading', 'end'), letGo }
        ]
      },
      'key-strike': {
        setup: keyPdf(),
        steps: [
          { action: 'hover', target: edge('the same image', 'start') },
          { action: 'key', keys: 'S' },
          { action: 'drag', target: edge('the same image', 'start'), to: edge('keeps arriving', 'end'), letGo }
        ]
      },
      'key-area': {
        setup: keyPdf([], null, figure),
        steps: [
          { action: 'hover', target: spot(0.14, 0.2) },
          { action: 'key', keys: 'A' },
          { action: 'drag', target: spot(0.14, 0.2), to: spot(0.9, 0.55), letGo }
        ]
      },
      'key-pen': {
        setup: keyPdf(),
        steps: [
          { action: 'hover', target: spot(...squiggle2[0]) },
          { action: 'key', keys: 'P' },
          { action: 'drag', target: spot(...squiggle2[0]), via: squiggle2.slice(1, -1).map((p) => spot(...p)), to: spot(...squiggle2[squiggle2.length - 1]), letGo }
        ]
      },
      'key-note': {
        setup: keyPdf(),
        steps: [
          { action: 'hover', target: spot(0.55, 0.62) },
          { action: 'key', keys: 'N' },
          { action: 'click', target: spot(0.55, 0.62) },
          { action: 'type', keys: 'Compare with page four.' },
          { action: 'key', keys: 'Enter', letGo }
        ]
      },
      'key-noteKeys': {
        // The Note tool is picked up before the first frame: this card is about the keys in the note.
        setup: keyPdf([], () => press('n')),
        steps: [
          { action: 'hover', target: spot(0.3, 0.64) },
          { action: 'click', target: spot(0.3, 0.64) },
          { action: 'type', keys: 'Two readings,' },
          // The caret alone on a new empty line does not show in a frame: the second line is typed in the same step.
          { action: 'key', keys: 'Shift+Enter', thenType: 'one under the other.' },
          { action: 'key', keys: 'Enter', letGo }
        ]
      },
      'key-selectErase': {
        setup: keyPdf([mark('k1', 'ink', { color: '#d97a2b', weight: 0.004, points: wave(0.42) }), mark('k2', 'ink', { color: '#3f6fb5', weight: 0.004, points: wave(0.6) })]),
        steps: [
          { action: 'hover', target: onWave(0.42) },
          { action: 'key', keys: 'V' },
          { action: 'click', target: onWave(0.42) },
          { action: 'key', keys: 'E' },
          { action: 'click', target: onWave(0.6), letGo }
        ]
      },
      'key-theme': {
        setup: keyPdf(),
        steps: [
          { action: 'hover', target: edge('Marking them', 'start') },
          { action: 'key', keys: 'H' },
          { action: 'key', keys: '2' },
          { action: 'drag', target: edge('Marking them', 'start'), to: edge('the pattern', 'end'), letGo },
          { action: 'click', target: edge('how a reader', 'start') },
          { action: 'key', keys: '3' }
        ]
      },
      'key-turn': {
        setup: keyPdf([], book),
        steps: [
          { action: 'hover', target: spot(0.5, 0.5) },
          { action: 'key', keys: '→', after: wait(900) },
          { action: 'key', keys: '→', after: wait(900) },
          { action: 'key', keys: '←', after: wait(900) }
        ]
      },
      'key-find': {
        setup: reader(essay, essayMarks()),
        steps: [
          { action: 'hover', target: redge(1, 'Every reader', 'start') },
          { action: 'key', keys: 'Mod+F' },
          { action: 'type', keys: 'margin' },
          { action: 'key', keys: 'Enter' }
        ]
      },
      'key-focus': {
        setup: keyPdf([], book),
        steps: [
          { action: 'hover', target: spot(0.5, 0.4) },
          { action: 'key', keys: 'F', after: wait(600) }
        ]
      },
      'key-palette': {
        setup: keyPdf([], book),
        steps: [
          { action: 'hover', target: spot(0.5, 0.45) },
          { action: 'key', keys: 'F', after: wait(600) },
          { action: 'key', keys: 'T', after: wait(600) }
        ]
      },
      'key-collapse': {
        setup: keyPdf([...pdfMarks(), { id: 'p8', page: 5, kind: 'highlight', color: '#d97a2b', themeId: '3', themeIds: ['3'], author: 'Reader', createdAt: now, rects: [{ x: 0.093, y: 0.122, w: 0.79, h: 0.028 }], quote: 'A note in the margin should sit beside the line' }]),
        steps: [
          { action: 'hover', target: spot(0.5, 0.3) },
          { action: 'key', keys: 'C', after: wait(1200) }
        ]
      },
      'key-undo': {
        setup: keyPdf(),
        steps: [
          { action: 'hover', target: edge('is a way of', 'start') },
          { action: 'key', keys: 'H' },
          { action: 'drag', target: edge('is a way of', 'start'), to: edge('with a book.', 'end'), letGo },
          { action: 'key', keys: 'Mod+Z' },
          { action: 'key', keys: 'Mod+Shift+Z' }
        ]
      },
      'key-delete': {
        setup: keyPdf([mark1]),
        steps: [
          { action: 'hover', target: spot(0.45, 0.136) },
          { action: 'key', keys: 'V' },
          { action: 'click', target: spot(0.45, 0.136) },
          { action: 'key', keys: 'Delete' }
        ]
      },
      'key-escape': {
        setup: keyPdf(),
        steps: [
          { action: 'hover', target: spot(0.6, 0.66) },
          { action: 'key', keys: 'P' },
          { action: 'key', keys: 'Esc' },
          { action: 'click', target: `__q('[aria-label^="More:"]')` },
          { action: 'key', keys: 'Esc' }
        ]
      }
    };
  }
  const STEP_CARDS = {
    'tool-select': {
      // A box drawn a little low: picked up, recoloured, then dragged up round the paragraph.
      setup: onPdf([mark('t', 'rect', { color: '#3f6fb5', themeIds: [], themeId: null, weight: 0.004, box: { x: 0.08, y: 0.45, w: 0.84, h: 0.14 } })]),
      steps: [
        ...pick('Select'),
        { action: 'click', target: spot(0.0805, 0.52) },
        { action: 'click', target: `__q('button[aria-label="Untagged colour #dc2626"]')` },
        { action: 'drag', target: spot(0.0805, 0.52), to: spot(0.0805, 0.292), letGo }
      ]
    },
    'tool-highlight': {
      setup: onPdf(),
      steps: [...pick('Highlight'), { action: 'drag', target: edge('Reading slowly', 'start'), to: edge('company', 'end'), letGo }]
    },
    'tool-area': {
      setup: onPdf([], figure),
      steps: [...pick('Area highlight'), { action: 'drag', target: spot(0.1, 0.2), to: spot(0.9, 0.62), letGo }]
    },
    'tool-underline': {
      setup: onPdf(),
      steps: [
        ...pick('Underline'),
        { action: 'click', target: opt('button[aria-label^="Theme: Questions"]') },
        { action: 'drag', target: edge('not a tool', 'start'), to: edge('text apart', 'end'), letGo }
      ]
    },
    'tool-strikeout': {
      setup: onPdf(),
      steps: [...pick('Strikeout'), { action: 'drag', target: edge('line by line', 'start'), to: edge('answers a letter', 'end'), letGo }]
    },
    'tool-pen': {
      setup: onPdf(),
      steps: [
        ...pick('Pen'),
        { action: 'click', target: opt('button[aria-label^="Theme: Metaphors"]') },
        { action: 'click', target: opt('button[title="Bold thickness"]') },
        { action: 'click', target: opt('button[aria-label="Dashed line"]') },
        { action: 'drag', target: spot(...squiggle[0]), via: squiggle.slice(1, -1).map((p) => spot(...p)), to: spot(...squiggle[squiggle.length - 1]), letGo }
      ]
    },
    'tool-inkarrow': {
      setup: onPdf(),
      steps: [
        ...pick('Freehand arrow'),
        { action: 'click', target: opt('button[aria-label^="Theme: Memory"]') },
        { action: 'click', target: opt('button[title="Bold thickness"]') },
        { action: 'click', target: opt('button[aria-label="Dotted line"]') },
        { action: 'drag', target: spot(0.86, 0.6), via: [spot(0.78, 0.6), spot(0.66, 0.56), spot(0.56, 0.49), spot(0.5, 0.44)], to: near('naming it', 'start', 8, 14), letGo }
      ]
    },
    blackout: {
      setup: onPdf(),
      steps: [
        ...pick('Black it out'),
        { action: 'click', target: `__q('[data-chip-menu] [role="radiogroup"][aria-label="Black it out"] button', 'Words')` },
        { action: 'drag', target: edge('closed door', 'start'), to: edge('read twice', 'end'), letGo }
      ]
    },
    'tool-rect': {
      setup: onPdf(),
      steps: [
        ...pick('Rectangle'),
        { action: 'click', target: opt('button[aria-label^="Theme: Night"]') },
        { action: 'click', target: opt('button[title="Heavy thickness"]') },
        { action: 'click', target: opt('button[aria-label="Dashed line"]') },
        { action: 'drag', target: spot(0.075, 0.105), to: spot(0.925, 0.215), letGo }
      ]
    },
    'tool-ellipse': {
      setup: onPdf(),
      steps: [
        ...pick('Ellipse'),
        { action: 'click', target: opt('button[aria-label^="Theme: Memory"]') },
        { action: 'drag', target: near('the moon over water', 'start', -10, -12), to: near('the moon over water', 'end', 10, 12), letGo }
      ]
    },
    'tool-arrow': {
      setup: onPdf(),
      steps: [...pick('Arrow'), { action: 'drag', target: spot(0.95, 0.42), to: near('shape a reading', 'end', 8, 6), letGo }]
    },
    'tool-line': {
      setup: onPdf(),
      steps: [...pick('Line'), { action: 'drag', target: spot(0.095, 0.37), to: spot(0.9, 0.37), letGo }]
    },
    'tool-bracket': {
      setup: onPdf(),
      steps: [
        ...pick('Bracket'),
        { action: 'click', target: opt('button[title="Opens to the left — for the right margin"]') },
        { action: 'drag', target: spot(0.93, 0.232), to: spot(0.955, 0.35), letGo }
      ]
    },
    'tool-note': {
      setup: onPdf(),
      steps: [
        ...pick('Note'),
        { action: 'click', target: opt('button[aria-label="Tint"]') },
        { action: 'click', target: spot(0.5, 0.5) },
        { action: 'type', keys: 'Answer it, line by line.' },
        { action: 'key', keys: 'Enter', letGo }
      ]
    },
    'tool-text': {
      setup: async () => {
        await onPdf()();
        // The tool remembers its type size: Large, set before the first frame so the words read in the picture.
        await js(`__tool('Text box').click(); await new Promise((r) => setTimeout(r, 300)); __q('[data-chip-menu] button[aria-label="Large text"]').click(); await new Promise((r) => setTimeout(r, 200)); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return true;`);
        await sleep(400);
      },
      steps: [
        ...pick('Text box'),
        { action: 'click', target: opt('button[aria-label="Hand typeface"]') },
        { action: 'drag', target: spot(0.1, 0.47), to: spot(0.62, 0.56) },
        { action: 'type', keys: 'Read this twice, then once more.' },
        { action: 'click', target: `__btn('Save')`, letGo }
      ]
    },
    'tool-erase': {
      setup: onPdf([mark('t', 'ink', { color: '#d97a2b', weight: 0.004, points: wave(0.47) })]),
      // A point the wave passes through: i = 6 of wave(0.47).
      steps: [...pick('Erase'), { action: 'click', target: spot(0.298, 0.47 + Math.sin(3) * 0.012) }]
    },
    'tool-undo': {
      setup: onPdf(),
      steps: [
        ...pick('Highlight'),
        { action: 'drag', target: edge('Themes are not', 'start'), to: edge('afterwards.', 'end') },
        { action: 'click', target: `__q('button[aria-label^="Undo"]')` },
        { action: 'click', target: `__q('button[aria-label^="Redo"]')` }
      ]
    },
    'tool-more': {
      setup: onPdf(),
      steps: [
        { action: 'hover', target: `__q('[aria-label^="More:"]')` },
        { action: 'click', target: `__q('[aria-label^="More:"]')` },
        { action: 'click', target: `__q('[data-more-menu] button[aria-label="Zoom in"]')` },
        { action: 'click', target: `__q('[data-more-menu] button[role="radio"]', '4 pages')`, after: `await new Promise((r) => setTimeout(r, 2500))` }
      ]
    },
    'tool-addnote': {
      setup: async () => {
        await api(`/documents/${essay.id}/annotations`, 'PUT', { annotations: essayMarks() });
        await open('reader', essay);
      },
      steps: [
        { action: 'hover', target: `__q('button[aria-label="Add a note to the current paragraph"]')` },
        { action: 'click', target: `__q('button[aria-label="Add a note to the current paragraph"]')` },
        { action: 'type', keys: 'A letter, not a lecture.' },
        { action: 'key', keys: 'Enter' }
      ]
    },
    'tool-collapse': {
      setup: async () => {
        await api(`/documents/${essay.id}/annotations`, 'PUT', { annotations: essayMarks() });
        await open('reader', essay);
      },
      steps: [
        { action: 'hover', target: `__q('button[aria-label="Collapse to marks"]')` },
        { action: 'click', target: `__q('button[aria-label="Collapse to marks"]')`, after: `window.scrollTo(0, 0)` },
        { action: 'click', target: `__q('.collapse-fold-btn')` }
      ]
    },
    'tool-notes': {
      setup: async () => {
        await open('reader', night);
        await js(`document.getElementById('reader-para-2').scrollIntoView({ block: 'center' }); return true;`);
        await sleep(700);
      },
      steps: [
        { action: 'hover', target: `[...document.querySelectorAll('button[title]')].find((b) => /margin notes|Back to reading/.test(b.title))` },
        { action: 'click', target: `[...document.querySelectorAll('button[title]')].find((b) => /margin notes|Back to reading/.test(b.title))` },
        { action: 'click', target: `[...document.querySelectorAll('button[title]')].find((b) => /margin notes|Back to reading/.test(b.title))` }
      ]
    },
    find: {
      // Its own marks: a note added by an earlier card must not show here.
      setup: reader(essay, essayMarks()),
      steps: [
        // Not over the Find button: its tooltip names the Mac key in a card captioned for both.
        { action: 'hover', target: `__edge('Reading slowly', 'start', '#reader-para-text-0')` },
        { action: 'key', keys: 'Mod+F' },
        { action: 'type', keys: 'reader' },
        { action: 'click', target: `__q('button[aria-label="Next match"]')` }
      ]
    },
    ...keyCards(),
    ...featureCards()
  };

  /**
   * Picks `file` in the file input `inputSel`, as choosing it in the open-file dialog would (the
   * input gets the file and its change event), without opening a system dialog.
   */
  const chooseFile = async (inputSel, file) => {
    if (!file || !fs.existsSync(file)) throw new Error(`no file to choose: ${file}`);
    const dbg = win.webContents.debugger;
    if (!dbg.isAttached()) dbg.attach('1.3');
    const { root } = await dbg.sendCommand('DOM.getDocument', { depth: 0 });
    const { nodeId } = await dbg.sendCommand('DOM.querySelector', { nodeId: root.nodeId, selector: inputSel });
    if (!nodeId) throw new Error(`no file input ${inputSel}`);
    await dbg.sendCommand('DOM.setFileInputFiles', { files: [file], nodeId });
  };
  /** Shows a saved text file as a plain page in the window, as opening it in a text editor would. */
  const openFile = async (file) => {
    for (let i = 0; i < 20 && !(file && fs.existsSync(file) && fs.statSync(file).size); i++) await sleep(150);
    if (!file || !fs.existsSync(file)) throw new Error(`no saved file to open: ${file}`);
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = `<!doctype html><meta charset="utf-8"><title>${esc(path.basename(file))}</title><body style="margin:0;background:#fff;color:#222;font:14px/1.6 ui-monospace,Menlo,monospace"><div style="padding:14px 28px;border-bottom:1px solid #e5e5e5;color:#777;font:13px system-ui,sans-serif">${esc(path.basename(file))}</div><pre style="margin:0;padding:24px 28px;white-space:pre-wrap">${esc(fs.readFileSync(file, 'utf8'))}</pre>`;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await helpers();
  };
  const send = (type, [x, y], extra = {}) => win.webContents.sendInputEvent({ type, x, y, button: 'left', clickCount: 1, ...extra });
  /** Measures a target, returning its percent point and pixel point; throws unless the pointer lands on it. */
  const aim = async (card, n, target) => {
    const box = await js(`return __measure(${target});`);
    const pt = G.centrePct(box, WIDTH, HEIGHT);
    const px = G.pctToPx(pt, WIDTH, HEIGHT);
    if (!G.inBox(pt, box, WIDTH, HEIGHT) || !(await js(`return __hits(${px[0]}, ${px[1]});`))) {
      throw new Error(`${card} step ${n}: pointer ${JSON.stringify(pt)} misses its target ${target}`);
    }
    return { pt, px };
  };
  const PAGE_KEYS = { Esc: 'Escape', Delete: 'Delete' };
  const stepCards = {};
  const stepFailed = [];
  for (const [id, card] of Object.entries(STEP_CARDS)) {
    if (ONLY && !ONLY.has(id)) continue;
    try {
      await card.setup();
      // Frames go to a side folder, swapped in only when the whole card worked.
      const dir = path.join(OUT, 'steps', id);
      const tmp = `${dir}.new`;
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.mkdirSync(tmp, { recursive: true });
      const steps = [];
      // Where the next step's target was just before the frame it is drawn on was taken.
      let planned = null;
      for (const [n, s] of card.steps.entries()) {
        if (s.opens) await openFile(s.opens());
        win.webContents.focus();
        const held = G.heldPoint(s, steps.length ? steps[steps.length - 1].at : null);
        let a = held ? { pt: held, px: G.pctToPx(held, WIDTH, HEIGHT) } : await aim(id, n, G.stepTarget(s));
        if (planned && G.drifted(planned.at, a.pt)) {
          throw new Error(`${id} step ${n}: target moved from ${JSON.stringify(planned.at)} to ${JSON.stringify(a.pt)} after frame ${n - 1} was taken`);
        }
        let to = null;
        if (s.chooses) {
          // The button opens the system's open-file dialog, which an offscreen window cannot show:
          // the pointer goes to it and the file is picked straight into its input.
          send('mouseMove', a.px);
          await chooseFile(s.chooses.input, s.chooses.file());
        } else if (s.action === 'hover') send('mouseMove', a.px);
        else if (s.action === 'click') for (const type of ['mouseMove', 'mouseDown', 'mouseUp']) send(type, a.px);
        else if (s.action === 'drag') {
          const via = [];
          for (const v of s.via || []) via.push((await aim(id, n, v)).px);
          to = await aim(id, n, s.to);
          if (planned && G.drifted(planned.to, to.pt)) throw new Error(`${id} step ${n}: drag end moved after frame ${n - 1} was taken`);
          send('mouseMove', a.px);
          send('mouseDown', a.px);
          for (const p of G.polyPath([a.px, ...via, to.px], via.length ? 5 : 14)) {
            send('mouseMove', p, { modifiers: ['leftButtonDown'] });
            await sleep(16);
          }
          send('mouseUp', to.px);
        } else if (s.action === 'type') {
          send('mouseMove', a.px);
          await typeText(s.keys);
        }
        else if (PAGE_KEYS[s.keys]) {
          // Dispatched in the page: Escape (and Delete) sent with sendInputEvent never reached it.
          await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '${PAGE_KEYS[s.keys]}', bubbles: true, cancelable: true })); return true;`);
        } else {
          const { keyCode, modifiers } = G.keyChord(s.keys, MOD);
          if (modifiers.includes(MOD)) {
            // A shortcut: down and up only, so no character is typed into whatever opens.
            win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
            win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
          } else await key(keyCode, modifiers);
          // The words after the key, in the same step, so its frame shows what the key did (a new line).
          if (s.thenType) await typeText(s.thenType);
        }
        await sleep(s.settle ?? 900);
        if (s.after) await js(`${s.after}; return true;`);
        if (s.letGo) {
          // Dispatched in the page: an Escape sent with sendInputEvent here never reached it.
          await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return true;`);
          await sleep(500);
        }
        const rec = G.stepRecord(id, n, { action: s.action, at: a.pt, to: to && to.pt, keys: s.keys });
        // Measure the next step's target now (a __see may scroll it into view), so this frame shows
        // the page as the pointer will find it; the next step re-measures and must agree.
        const next = card.steps[n + 1];
        // (A step that opens a file shows a page that is not there yet.)
        const nextTarget = next && !next.opens && !G.heldPoint(next, a.pt) ? G.stepTarget(next) : null;
        planned = nextTarget ? { at: (await aim(id, n + 1, nextTarget)).pt, to: next.to && (await aim(id, n + 1, next.to)).pt } : null;
        if (planned) await sleep(300);
        const img = await win.webContents.capturePage(full);
        fs.writeFileSync(path.join(tmp, path.basename(rec.frame)), img.resize({ width: SAVE_WIDTH, quality: 'best' }).toJPEG(72));
        steps.push(rec);
      }
      fs.rmSync(dir, { recursive: true, force: true });
      fs.renameSync(tmp, dir);
      stepCards[id] = steps;
      console.log(`[guide] ${id}: ${steps.length} steps`);
    } catch (err) {
      stepFailed.push(id);
      fs.rmSync(path.join(OUT, 'steps', `${id}.new`), { recursive: true, force: true });
      console.error(`[guide] ${id} steps failed:`, err && err.message ? err.message : err);
    }
  }
  for (const [x, y] of G.duplicateScripts(stepCards)) {
    stepFailed.push(y);
    console.error(`[guide] ${x} and ${y} send the pointer to exactly the same places`);
  }
  const stepsFile = path.join(ROOT, 'src', 'data', 'guideSteps.generated.ts');
  const oldSteps = fs.existsSync(stepsFile) ? G.readStepsFile(fs.readFileSync(stepsFile, 'utf8')) : {};
  // A card that failed keeps its last good steps; a partial run keeps every card it skipped.
  const replaced = ONLY ? new Set(Object.keys(stepCards)) : new Set(Object.keys(oldSteps).filter((id) => !stepFailed.includes(id)));
  fs.writeFileSync(stepsFile, G.renderStepsFile(G.mergeSteps(oldSteps, stepCards, replaced)));

  console.log(`[guide] made ${Object.keys(stepCards).length} cards in ${path.relative(ROOT, path.join(OUT, 'steps'))}`);
  win.destroy();
  fs.rmSync(store, { recursive: true, force: true });
  app.exit(stepFailed.length ? 1 : 0);
}

app.disableHardwareAcceleration();
// The scanned sample is drawn in a window of its own; closing it must not quit the capture.
app.on('window-all-closed', () => {});
app.whenReady().then(main).catch((err) => {
  console.error('[guide] failed:', err);
  app.exit(1);
});
