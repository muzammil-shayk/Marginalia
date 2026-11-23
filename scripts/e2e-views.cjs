/**
 * End-to-end checks of page turns and views in the PDF workspace, in the real app (Electron + the
 * built server), on a throwaway library in the temp folder — never the reader's own.
 *
 *   npm run test:e2e        (builds first, then runs this after e2e-marking.cjs)
 *
 * 1. Book view: a page turn's overlay is gone within about 600 ms, and the new pages are painted.
 * 2. Six pages in view: clicking a page opens it at reading size, one page in view.
 * 3. Fit page: the whole page fits the window, width and height.
 * 4. A book saved at a big zoom opens fitted to a small window.
 * 5. Text reader spread: a fold turn is gone within about 700 ms; key repeat moves one spread per press.
 * Also in book view: quick turns never skip a pair, a turn asked for during another starts within
 * about 350 ms, a turning leaf is never painted over by the old page's marks, and two quick
 * presses onto a cold pair never start the leaf on unpainted pages.
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

async function samplePdf(pages) {
  const { PDFDocument, StandardFonts } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([420, 595]);
    page.drawText(`Page ${i}: the lone and level sands stretch far away`, { x: 40, y: 520, size: 14, font });
  }
  return Buffer.from(await doc.save());
}

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-views-'));
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
  const pdf = await api('/documents', 'POST', { title: 'Sands', text: 'Page 1', format: 'PDF', filename: 'sands.pdf' });
  await fetch(`${base}/api/documents/${pdf.id}/original?filename=sands.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await samplePdf(8) });
  // Page 3: a highlight on the half nearest the gutter and a sticky note, for the turn's mark check.
  await fetch(`${base}/api/documents/${pdf.id}/annotations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      annotations: [
        { id: 'h3', page: 3, kind: 'highlight', rects: [{ x: 0.5, y: 0.3, w: 0.4, h: 0.05 }], quote: 'sands', color: '#b5527a', themeIds: ['love'], themeId: 'love', createdAt: new Date().toISOString() },
        { id: 'n3', page: 3, kind: 'note', box: { x: 0.55, y: 0.5, w: 0.3, h: 0.15 }, text: 'sticky', noteStyle: 'sticky', color: '#b5527a', themeIds: ['love'], themeId: 'love', createdAt: new Date().toISOString() }
      ]
    })
  });

  // E2E_WIDTH=1024 reproduces Windows CI, where the toolbar folds its views into the More menu.
  const win = new BrowserWindow({ width: Number(process.env.E2E_WIDTH) || 1366, height: 768, show: false, webPreferences: { offscreen: true } });
  const js = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
  /** Polls the page until every selector matches, up to `ms`; true if they all did. */
  const waitFor = (selectors, ms = 20000) =>
    js(`
      const all = ${JSON.stringify(selectors)};
      for (const t0 = performance.now(); performance.now() - t0 < ${ms}; await new Promise((r) => setTimeout(r, 100)))
        if (all.every((s) => document.querySelector(s))) return true;
      return false;
    `);
  // The toolbar's views sit inline, or in the More menu when the window is narrow.
  const TOOLBAR = '[role="radiogroup"][aria-label="Pages in view"], [aria-label^="More:"]';
  const open = async () => {
    const session = { currentScreen: 'workspace', analysisDoc: { title: pdf.title, text: '', format: 'PDF', docId: pdf.id }, uploadedLibrary: [], documentNotes: {}, documentFormats: {} };
    await win.loadURL(base);
    await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(session))}); return true;`);
    await win.loadURL(base);
    // Slow runners (Windows CI) take longer than any fixed wait; a missing toolbar shows up in press().
    await waitFor([TOOLBAR, '[data-page-number][data-painted]']);
  };
  /**
   * Clicks a toolbar button by its label's start; on a narrower window it sits in the More menu.
   * Retries for ~8 s: the toolbar may mount late, and it folds or unfolds as its width settles.
   */
  const press = (label, role = '') =>
    js(`
      const sel = 'button${role ? `[role="${role}"]` : ''}';
      const find = () => [...document.querySelectorAll(sel)].find((x) => (x.getAttribute('aria-label') || '').startsWith(${JSON.stringify(label)}));
      const more = () => document.querySelector('[aria-label^="More:"]');
      let b = find();
      for (const t0 = performance.now(); !b && performance.now() - t0 < 8000; b = find()) {
        // More is a toggle: open it only when it is shut.
        if (more() && more().getAttribute('aria-expanded') !== 'true') more().click();
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!b) throw new Error('no button ' + ${JSON.stringify(label)} + ' ' + JSON.stringify({ buttons: document.querySelectorAll(sel).length, more: Boolean(more()), moreOpen: more()?.getAttribute('aria-expanded') ?? null, innerWidth }));
      b.click();
      await new Promise((r) => setTimeout(r, 150));
      // Closed the way a click elsewhere closes it.
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return true;
    `);
  const view = (label) => press(label, 'radio');

  await open();

  // 1. Book view and a turn.
  await view('2 pages');
  await sleep(2500);
  /** Presses → and times the turn overlay from when it appears to when it is gone. */
  const timeTurn = () =>
    js(`
    const t0 = performance.now();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    let started = 0;
    while (performance.now() - t0 < 6000) {
      await new Promise((r) => setTimeout(r, 20));
      const overlay = document.querySelector('.page-turn');
      if (overlay && !started) started = performance.now();
      if (started && !overlay) break;
    }
    const gone = performance.now();
    const shown = [...document.querySelectorAll('.spread-book [data-page-number]:not([data-offstage])')];
    return { overlayMs: started ? Math.round(gone - started) : -1, pages: shown.map((p) => p.dataset.pageNumber), painted: shown.every((p) => p.dataset.painted) };
  `);
  const turn = await timeTurn();
  check('Book: the turn overlay is gone within about 600 ms', turn.overlayMs >= 0 && turn.overlayMs <= 700, `${turn.overlayMs} ms`);
  check('Book: the turn lands on pages 3–4, already painted', turn.pages.join() === '3,4' && turn.painted, JSON.stringify(turn));

  // The same on a CPU slowed 4× (where the overlay used to stay about 3.5 s).
  await sleep(1500);
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setCPUThrottlingRate', { rate: 4 });
  const slow = await timeTurn();
  await win.webContents.debugger.sendCommand('Emulation.setCPUThrottlingRate', { rate: 1 });
  win.webContents.debugger.detach();
  check('Book, CPU slowed 4×: the overlay is still gone within about a second', slow.overlayMs >= 0 && slow.overlayMs <= 1100 && slow.pages.join() === '5,6', JSON.stringify(slow));
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); return true;`);
  await sleep(1500);

  /** Presses → after each gap (ms); returns the open pair's first page each time it changes, and when each key and overlay came. */
  const turnRun = (gaps) =>
    js(`
    const t0 = performance.now();
    const firsts = [];
    const keys = [];
    const overlays = [];
    const first = () => document.querySelector('.spread-book [data-page-number]:not([data-offstage])')?.dataset.pageNumber;
    const note = () => {
      const f = Number(first());
      if (f && firsts[firsts.length - 1] !== f) firsts.push(f);
      const o = document.querySelector('.page-turn');
      if (o && !o.dataset.seen) {
        o.dataset.seen = '1';
        overlays.push(Math.round(performance.now() - t0));
      }
    };
    const obs = new MutationObserver(note);
    obs.observe(document.querySelector('.spread-book').parentElement, { subtree: true, childList: true, attributes: true });
    note();
    for (const g of ${JSON.stringify(gaps)}) {
      await new Promise((r) => setTimeout(r, g));
      keys.push(Math.round(performance.now() - t0));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 2500));
    obs.disconnect();
    return { firsts, keys, overlays };
  `);
  const backToStart = async () => {
    for (let i = 0; i < 4; i++) {
      await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); return true;`);
      await sleep(1300);
    }
  };

  // 1b. A press while a turn waits for its pages, then another: one pair at a time, never a jump of two.
  await backToStart();
  const quick = await turnRun([0, 590, 60]);
  const steps = quick.firsts.slice(1).map((f, i) => f - quick.firsts[i]);
  check('Book: quick turns move one pair at a time, never skipping one', steps.length >= 2 && steps.every((d) => d === 2), JSON.stringify(quick));

  // 1c. A press during a turn starts the next turn promptly (the next pages are drawn at once).
  await backToStart();
  const during = await turnRun([0, 300]);
  const lag = during.overlays[1] - during.keys[1];
  check('Book: a turn asked for during another starts within about 350 ms', during.overlays.length === 2 && lag <= 350, JSON.stringify({ ...during, lag }));

  // 1d. Turning on from pages 3–4: the leaf is never painted over by page 3's highlight or note.
  await backToStart();
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); return true;`);
  await sleep(2000);
  /** Where the highlight and the note sit on page 3, in window px. */
  const spots = await js(`
    const r = document.querySelector('[data-page-number="3"]').getBoundingClientRect();
    const at = (fx, fy, dx = 0) => ({ x: Math.round(r.left + fx * r.width + dx), y: Math.round(r.top + fy * r.height) });
    // Two in the highlight, two on the note's 5 px coloured left edge.
    return [at(0.6, 0.325), at(0.8, 0.325), at(0.55, 0.55, 2), at(0.55, 0.6, 2)];
  `);
  /** How many of the spots show the mark colour (pink: red well above green). */
  const pinkAt = async () => {
    // An offscreen window can hand back its last painted frame after a compositor-only change
    // (a turn built ahead and just shown): ask for a fresh paint first.
    win.webContents.invalidate();
    await sleep(60);
    const img = await win.webContents.capturePage();
    const { width } = img.getSize();
    const scale = width / (await js('return innerWidth;'));
    const bmp = img.toBitmap();
    return spots.filter(({ x, y }) => {
      const i = (Math.round(y * scale) * width + Math.round(x * scale)) * 4;
      return bmp[i + 2] - bmp[i + 1] > 25;
    }).length;
  };
  const before = await pinkAt();
  // The leaf is held at 80% of its swing (it covers the left page) while the window is captured.
  const held = await js(`
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    for (const t0 = performance.now(); !document.querySelector('.page-turn') && performance.now() - t0 < 2000; ) await new Promise((r) => setTimeout(r, 5));
    const root = document.querySelector('.page-turn');
    if (!root) return false;
    for (const a of document.getAnimations()) if (root.contains(a.effect?.target)) { a.pause(); a.currentTime = 0.8 * a.effect.getTiming().duration; }
    // Two frames, so the window holds the paused leaf before it is captured.
    for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
    return true;
  `);
  const during2 = await pinkAt();
  const stillTurning = await js(`return Boolean(document.querySelector('.page-turn'));`);
  check('Book: page 3’s highlight and note are under the turning leaf, not painted over it', before === 4 && held && stillTurning && during2 === 0, JSON.stringify({ before, held, stillTurning, during: during2 }));
  await sleep(1500);

  // 1e. A cold pair and two presses at once (well under 50 ms apart): the second press (asking again) must still never
  // start the leaf onto pages that have not painted. Pressed the moment a turn lands, before its
  // neighbours draw, on a CPU slowed 4x so they paint slowly.
  await backToStart();
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setCPUThrottlingRate', { rate: 4 });
  const cold = await js(`
    const key = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    key();
    for (const t0 = performance.now(); !document.querySelector('.page-turn') && performance.now() - t0 < 3000; ) await sleep(2);
    for (const t0 = performance.now(); document.querySelector('.page-turn') && performance.now() - t0 < 3000; ) await sleep(2);
    const painted = (n) => Boolean(document.querySelector('[data-page-number="' + n + '"][data-painted]'));
    const coldBefore = !painted(5) || !painted(6);
    // Back to back: the first press has no time to paint its pages before the second arrives.
    key();
    const t1 = performance.now();
    key();
    let atLeaf = null;
    for (const t0 = performance.now(); performance.now() - t0 < 3000; await sleep(2)) {
      const o = document.querySelector('.page-turn');
      if (o) { atLeaf = { p5: painted(5), p6: painted(6), waitedMs: Math.round(performance.now() - t1) }; break; }
    }
    await sleep(1500);
    const shown = [...document.querySelectorAll('.spread-book [data-page-number]:not([data-offstage])')].map((p) => p.dataset.pageNumber);
    return { coldBefore, atLeaf, shown };
  `);
  await win.webContents.debugger.sendCommand('Emulation.setCPUThrottlingRate', { rate: 1 });
  win.webContents.debugger.detach();
  const leafOnPainted = cold.atLeaf && ((cold.atLeaf.p5 && cold.atLeaf.p6) || cold.atLeaf.waitedMs >= 240);
  check('Book: two quick presses onto a cold pair never start the leaf on unpainted pages', Boolean(cold.coldBefore && leafOnPainted && cold.shown.join() === '5,6'), JSON.stringify(cold));
  await sleep(1000);

  // 2. Six pages, then a click opens one at reading size.
  await view('6 pages');
  await sleep(2000);
  const grid = await js(`return document.querySelectorAll('button[aria-label^="Open page "]').length;`);
  check('Six pages: every page in the grid is a button to open it', grid === 8, String(grid));
  await js(`document.querySelector('button[aria-label="Open page 5 at reading size"]').click(); return true;`);
  await sleep(1500);
  const opened = await js(`
    const pageWord = document.querySelector('[data-page-number="5"]');
    const area = document.querySelector('[data-page-number="5"]').closest('.overflow-auto, .overflow-y-auto') || document.scrollingElement;
    const r = document.querySelector('[data-page-number="5"]').getBoundingClientRect();
    const a = area.getBoundingClientRect();
    return { single: !document.querySelector('.spread-book') && !pageWord.closest('.grid'), top: Math.round(r.top - a.top), width: Math.round(r.width), areaWidth: Math.round(a.width) };
  `);
  check('Six pages: clicking page 5 opens it at reading size, at the top of the window', opened.single && Math.abs(opened.top) < 60 && opened.width > opened.areaWidth * 0.8, JSON.stringify(opened));

  // 3. Fit page.
  await press('Fit page');
  await sleep(1200);
  const fit = await js(`
    const p = document.querySelector('[data-page-number="5"]').getBoundingClientRect();
    const a = (document.querySelector('[data-page-number="5"]').closest('.overflow-auto, .overflow-y-auto') || document.scrollingElement).getBoundingClientRect();
    return { pageH: Math.round(p.height), areaH: Math.round(a.height), pageW: Math.round(p.width), areaW: Math.round(a.width) };
  `);
  check('Fit page: the whole page fits the window', fit.pageH <= fit.areaH && fit.pageW <= fit.areaW && fit.pageH > fit.areaH * 0.7, JSON.stringify(fit));

  // 4. A book saved at 300% opens fitted to this window.
  await api(`/documents/${pdf.id}/reading-state`, 'PUT', { readingState: { scale: 3, page: 1, viewMode: 'spread' } });
  await js(`localStorage.clear(); return true;`);
  await open();
  await sleep(1500);
  const book = await js(`
    const b = document.querySelector('.spread-book');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), vw: innerWidth, vh: innerHeight, sidebarRight: Math.round(document.querySelector('#desktop-sidebar-nav')?.getBoundingClientRect().right ?? 0) };
  `);
  check('A book saved at a big zoom opens inside a small window, clear of the sidebar', Boolean(book) && book.left >= book.sidebarRight && book.right <= book.vw && book.bottom <= book.vh, JSON.stringify(book));

  // 5. The text reader's spread: a fold turn is gone within about 700 ms, and a held → (key
  // repeat, a press every 40 ms) moves exactly one spread per press.
  await api('/settings', 'PUT', { settings: { name: 'Reader', lastSeenVersion: version, readerSpread: true, activeThemes: [{ id: 'love', name: 'Love', color: '#b5527a' }] } });
  const paras = Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1}. I met a traveller from an antique land who said: two vast and trunkless legs of stone stand in the desert.`);
  const txt = await api('/documents', 'POST', { title: 'Traveller', text: paras.join('\n\n'), format: 'TXT' });
  const readerSession = { currentScreen: 'reader', analysisDoc: { title: txt.title, text: '', format: 'TXT', docId: txt.id }, uploadedLibrary: [], documentNotes: {}, documentFormats: {} };
  await win.loadURL(base);
  await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(readerSession))}); return true;`);
  await win.loadURL(base);
  await waitFor(['.spread-book > .spread-folio']);
  await sleep(1500);
  const folio = `return document.querySelector('.spread-book > .spread-folio')?.textContent;`;
  const textTurn = await js(`
    const t0 = performance.now();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    let started = 0;
    while (performance.now() - t0 < 3000) {
      await new Promise((r) => setTimeout(r, 10));
      const o = document.querySelector('.page-turn');
      if (o && !started) started = performance.now();
      if (started && !o) break;
    }
    return { overlayMs: started ? Math.round(performance.now() - started) : -1, folio: document.querySelector('.spread-book > .spread-folio')?.textContent };
  `);
  check('Text spread: a fold turn is gone within about 700 ms and lands on pages 3–4', textTurn.overlayMs >= 0 && textTurn.overlayMs <= 700 && textTurn.folio === '3', JSON.stringify(textTurn));
  await sleep(1000);
  const repeat = await js(`
    for (let i = 0; i < 4; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, repeat: i > 0 }));
      await new Promise((r) => setTimeout(r, 40));
    }
    await new Promise((r) => setTimeout(r, 1500));
    ${folio}
  `);
  check('Text spread: key repeat moves one spread per press (four presses: pages 3–4 to 11–12)', repeat === '11', `left folio ${repeat}`);

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
