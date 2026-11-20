/**
 * End-to-end checks of focus mode's floating tools and the note editors' keys, in the real app
 * (Electron + the built server), on a throwaway library in the temp folder — never the reader's own.
 *
 *   npm run test:e2e        (builds first)
 *
 * 1. PDF, focus mode: the palette is out of sight until the pointer reaches its edge; a tool
 *    picked there draws, and is still the toolbar's tool after leaving focus mode.
 * 2. T shows it and Escape puts it away; dragging its grip to the other side is saved in settings.
 * 3. PDF sticky note: Shift+Enter starts a new line, Enter saves.
 * 4. Text document, focus mode: the palette offers the reader's tools, and its note button opens
 *    the note editor, where Shift+Enter is a new line and Enter saves.
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

async function samplePdf() {
  const { PDFDocument, StandardFonts } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  doc.addPage([420, 595]).drawText('Reading slowly is a way of keeping company', { x: 40, y: 520, size: 14, font });
  return Buffer.from(await doc.save());
}

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-focus-'));
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
  const pdf = await api('/documents', 'POST', { title: 'Company', text: 'Reading', format: 'PDF', filename: 'company.pdf' });
  await fetch(`${base}/api/documents/${pdf.id}/original?filename=company.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await samplePdf() });
  const txt = await api('/documents', 'POST', { title: 'Letter', text: 'The pencil in the margin answers it.\nLine by line, the way one answers a letter.', format: 'TXT', layout: 'verbatim' });

  const win = new BrowserWindow({ width: 1400, height: 900, show: false, webPreferences: { offscreen: true } });
  const wc = win.webContents;
  const js = (code) => wc.executeJavaScript(`(async () => { ${code} })()`);
  const waitFor = async (pred, ms = 6000) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(150)) {
      const v = await pred();
      if (v) return v;
    }
    return null;
  };
  const open = async (doc, screen, format, ready) => {
    const session = { currentScreen: screen, analysisDoc: { title: doc.title, text: '', format, docId: doc.id }, uploadedLibrary: [], documentNotes: {}, documentFormats: {} };
    await win.loadURL(base);
    await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(session))}); return true;`);
    await win.loadURL(base);
    const ok = await js(`
      for (const t0 = performance.now(); performance.now() - t0 < 20000; await new Promise((r) => setTimeout(r, 100)))
        if (document.querySelector(${JSON.stringify(ready)})) return true;
      return false;
    `);
    if (!ok) throw new Error(`${screen} never showed ${ready}`);
    await sleep(500);
  };
  const key = async (keyCode, modifiers = []) => {
    wc.focus();
    wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    // The character a real key types: letters, and a line break for Enter (the textarea's own default).
    if (keyCode.length === 1 || keyCode === 'Enter') wc.sendInputEvent({ type: 'char', keyCode: keyCode === 'Enter' ? '\r' : keyCode, modifiers });
    wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    await sleep(120);
  };
  const type = async (text) => {
    for (const ch of text) await key(ch);
  };
  const move = async (x, y, buttons) => {
    wc.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y), ...(buttons && { button: 'left', modifiers: ['leftButtonDown'] }) });
    await sleep(30);
  };
  const click = async (x, y) => {
    wc.focus();
    await move(x, y);
    wc.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    await sleep(250);
  };
  const palette = () => js(`const p = document.querySelector('[role="toolbar"][aria-label^="Focus mode tools"]'); if (!p) return null; const r = p.getBoundingClientRect(); return { shown: p.dataset.shown, side: p.dataset.paletteSide, opacity: getComputedStyle(p).opacity, x: r.left, y: r.top, w: r.width, h: r.height, labels: [...p.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label')) };`);
  const centreOf = (selector) => js(`const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
  const marks = async (id) => (await api(`/documents/${id}/annotations`)).annotations || [];

  // 1. PDF in focus mode.
  await open(pdf, 'workspace', 'PDF', '[data-page-number="1"] .marginalia-text-layer span');
  await click(700, 450);
  await key('f');
  const page = await js(`const r = document.querySelector('[data-page-number="1"]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };`);
  await move(page.x + page.w / 2, page.y + 200);
  await sleep(400);
  const hidden = await palette();
  await move(4, 450);
  await sleep(400);
  const called = await palette();
  check('PDF focus mode: the palette is hidden until the pointer reaches its edge', hidden?.shown === 'false' && Number(hidden.opacity) < 0.05 && called?.shown === 'true' && Number(called.opacity) > 0.95, JSON.stringify({ hidden: hidden && hidden.opacity, called: called && called.opacity }));
  const wanted = ['Select', 'Highlight', 'Underline', 'Pen', 'Freehand arrow', 'Arrow', 'Rectangle', 'Ellipse', 'Note', 'Erase', 'Undo', 'Redo'];
  const missing = wanted.filter((w) => !called?.labels.some((l) => l === w || l.startsWith(`${w} (`)));
  check('PDF palette holds the marking and drawing tools, eraser, undo and redo', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : '');

  const arrowBtn = await centreOf('[role="toolbar"][aria-label^="Focus mode tools"] button[aria-label="Freehand arrow"]');
  await click(arrowBtn.x, arrowBtn.y);
  await sleep(300);
  // Arming a tool opens its options under the toolbar's chip; with the toolbar away that menu
  // hung off the top edge of the window.
  const strayMenu = await js(`return [...document.querySelectorAll('.fixed.z-50')].filter((e) => e.getBoundingClientRect().top < 0).length;`);
  check('Picking a tool in the palette opens no options menu off the top of the window', strayMenu === 0, `stray=${strayMenu}`);
  // Away from the edge, then draw.
  const pts = Array.from({ length: 20 }, (_, i) => ({ x: page.x + page.w * (0.2 + i * 0.025), y: page.y + 260 + i * i * 0.6 }));
  wc.focus();
  await move(pts[0].x, pts[0].y);
  wc.sendInputEvent({ type: 'mouseDown', x: Math.round(pts[0].x), y: Math.round(pts[0].y), button: 'left', clickCount: 1 });
  for (const p of pts.slice(1)) await move(p.x, p.y, true);
  wc.sendInputEvent({ type: 'mouseUp', x: Math.round(pts[19].x), y: Math.round(pts[19].y), button: 'left', clickCount: 1 });
  const drawn = await waitFor(async () => (await marks(pdf.id)).find((m) => m.kind === 'ink' && m.arrowHead));
  await sleep(300);
  const away = await palette();
  check('A tool picked in the palette draws; the palette steps back while you work', Boolean(drawn) && away?.shown === 'false', JSON.stringify({ drawn: Boolean(drawn), shown: away?.shown }));
  // (Escape would put the tool down, by design; F alone leaves focus mode.)
  await key('f');
  await sleep(400);
  const kept = await js(`const b = [...document.querySelectorAll('button[aria-label^="Freehand arrow"]')].find((e) => e.checkVisibility() && !e.closest('[role="toolbar"][aria-label^="Focus mode tools"]')); return b ? b.getAttribute('aria-pressed') : 'missing';`);
  const gone = await palette();
  check('Leaving focus mode: the palette is gone and the toolbar still has its tool picked', kept === 'true' && gone === null, `toolbar=${kept} palette=${gone ? 'still there' : 'gone'}`);

  // 2. T and Escape; drag to the other side.
  await key('f');
  await move(page.x + page.w / 2, page.y + 200);
  await key('t');
  await sleep(300);
  const pinned = await palette();
  const focusIn = await js(`return Boolean(document.activeElement?.closest('[role="toolbar"][aria-label^="Focus mode tools"]'));`);
  await key('Escape');
  await sleep(300);
  const unpinned = await palette();
  const stillFocus = await js(`return Boolean(document.querySelector('[aria-label^="Leave focus mode"]'));`);
  check('T shows the palette with focus on a tool; Escape puts it away and stays in focus mode', pinned?.shown === 'true' && focusIn && unpinned?.shown === 'false' && stillFocus, JSON.stringify({ pinned: pinned?.shown, focusIn, unpinned: unpinned?.shown, stillFocus }));

  await move(4, 450);
  await sleep(350);
  const grip = await centreOf('[role="toolbar"][aria-label^="Focus mode tools"] button[aria-label^="Move the tools"]');
  wc.focus();
  await move(grip.x, grip.y);
  wc.sendInputEvent({ type: 'mouseDown', x: Math.round(grip.x), y: Math.round(grip.y), button: 'left', clickCount: 1 });
  for (let i = 1; i <= 12; i++) await move(grip.x + i * 100, grip.y - i * 10, true);
  wc.sendInputEvent({ type: 'mouseUp', x: Math.round(grip.x + 1200), y: Math.round(grip.y - 120), button: 'left', clickCount: 1 });
  await sleep(600);
  const moved = await palette();
  const saved = await waitFor(async () => {
    const s = (await api('/settings')).settings ?? (await api('/settings'));
    return s?.focusPalette?.side === 'right' ? s.focusPalette : null;
  });
  check('Dragged to the right edge: it settles there and the place is saved in settings', moved?.side === 'right' && moved.x + moved.w > 1400 - 40 && Boolean(saved), JSON.stringify({ side: moved?.side, right: moved && Math.round(moved.x + moved.w), saved }));
  await key('f');

  // 3. A sticky note on the PDF: Shift+Enter, then Enter.
  await key('Escape');
  await key('n');
  // Out of focus mode the toolbar is back above the page: measure it again.
  const page2 = await js(`const r = document.querySelector('[data-page-number="1"]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };`);
  await click(page2.x + page2.w * 0.7, Math.max(page2.y, 200) + 120);
  const editorOpen = await waitFor(() => js(`return document.activeElement?.tagName === 'TEXTAREA';`));
  if (!editorOpen) console.log('note editor did not open', await js(`return JSON.stringify({ active: document.activeElement?.tagName, tool: [...document.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.getAttribute('aria-label')), dialogs: document.querySelectorAll('textarea').length });`));
  await type('one');
  await key('Enter', ['shift']);
  await type('two');
  const beforeSave = await js(`return document.activeElement?.value ?? null;`);
  await key('Enter');
  const note = await waitFor(async () => (await marks(pdf.id)).find((m) => m.kind === 'note' && m.text));
  const closed = await js(`return document.activeElement?.tagName !== 'TEXTAREA';`);
  check('PDF note: Shift+Enter is a new line, Enter saves and closes', beforeSave === 'one\ntwo' && note?.text === 'one\ntwo' && closed, JSON.stringify({ beforeSave, saved: note?.text, closed }));

  // 4. Text document in focus mode.
  await open(txt, 'reader', 'TXT', '[data-annotation-surface]');
  await click(700, 450);
  await key('f');
  // Saved on the right edge by the drag above: it comes back there.
  await move(1396, 450);
  await sleep(400);
  const textPalette = await palette();
  const textWanted = ['Highlight', 'Underline', 'Strikeout', 'Terminology', 'Add a note to the current paragraph', 'Undo', 'Redo'];
  const textMissing = textWanted.filter((w) => !textPalette?.labels.some((l) => l === w || l.startsWith(`${w} (`)));
  check('Text document focus mode: the palette offers the reader’s tools', textPalette?.shown === 'true' && textMissing.length === 0, textMissing.length ? `missing ${textMissing.join(', ')}` : textPalette?.side);
  const noteBtn = await centreOf('[role="toolbar"][aria-label^="Focus mode tools"] button[aria-label="Add a note to the current paragraph"]');
  await click(noteBtn.x, noteBtn.y);
  await waitFor(() => js(`return document.activeElement?.getAttribute('aria-label') === 'Note';`));
  await type('a');
  await key('Enter', ['shift']);
  await type('b');
  await key('Enter');
  const textNote = await waitFor(async () => (await marks(txt.id)).find((m) => m.text === 'a\nb'));
  check('Text note from the palette: Shift+Enter is a new line, Enter saves', Boolean(textNote), JSON.stringify((await marks(txt.id)).map((m) => m.text)));

  win.destroy();
  fs.rmSync(store, { recursive: true, force: true });
}

app.disableHardwareAcceleration();
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
