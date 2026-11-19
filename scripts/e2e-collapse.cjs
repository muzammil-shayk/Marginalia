/**
 * End-to-end checks of Collapse to marks, in the real app (Electron + the built server), on a
 * throwaway library in the temp folder — never the reader's own.
 *
 *   npm run test:e2e        (builds first, then runs this with the other suites)
 *
 * PDF (pdf/workspace/PdfCollapsed.tsx):
 * 1. Going in from page 9 lands on page 9's strips, even though page 2's strips above it only
 *    learn their size a moment later.
 * 2. Clicking a mark in the second strip of a page puts its properties beside that strip, not
 *    where the mark would be on the page's first strip.
 * 3. "Open page" on page 9 shows the whole document with page 9 at the top.
 * Text reader (reader/useReaderCollapse.ts):
 * 4. Collapsed to Find hits, then Find closed: the reader falls back to all marks instead of
 *    folding every paragraph away.
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

const W = 420;
const H = 595;
async function samplePdf(pages) {
  const { PDFDocument, StandardFonts } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([W, H]);
    for (let y = H - 50; y > 40; y -= 24) page.drawText(`Page ${i}, line at ${y}: the lone and level sands stretch far away`, { x: 30, y, size: 11, font });
  }
  return Buffer.from(await doc.save());
}

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-collapse-'));
  Object.assign(process.env, { MARGINALIA_STORE_DIR: store, MARGINALIA_EMBEDDED: '1', NODE_ENV: 'production', PORT: '0' });
  const server = require(path.join(ROOT, 'dist', 'server.cjs'));
  const port = await server.startServer({ staticRoot: path.join(ROOT, 'dist') });
  const base = `http://127.0.0.1:${port}`;
  const api = async (p, method = 'GET', body) => {
    const res = await fetch(`${base}/api${p}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return res.json();
  };
  const putMarks = (id, annotations) =>
    fetch(`${base}/api/documents/${id}/annotations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ annotations }) });
  const version = /CURRENT_APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'src', 'data', 'changelog.ts'), 'utf8'))[1];
  await api('/settings', 'PUT', { settings: { name: 'Reader', lastSeenVersion: version, activeThemes: [{ id: 'love', name: 'Love', color: '#b5527a' }] } });

  // Page 2: a tall box near the top and a highlight near the bottom (two strips); page 9: one highlight.
  const pdf = await api('/documents', 'POST', { title: 'Sands', text: 'Page 1', format: 'PDF', filename: 'sands.pdf' });
  await fetch(`${base}/api/documents/${pdf.id}/original?filename=sands.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await samplePdf(12) });
  const mark = (id, page, extra) => ({ id, page, color: '#b5527a', themeIds: ['love'], themeId: 'love', createdAt: new Date().toISOString(), ...extra });
  await putMarks(pdf.id, [
    mark('box2', 2, { kind: 'rect', box: { x: 0.1, y: 0.1, w: 0.8, h: 0.4 } }),
    mark('low2', 2, { kind: 'highlight', rects: [{ x: 0.07, y: 0.86, w: 0.6, h: 0.025 }], quote: 'low on page two' }),
    mark('top9', 9, { kind: 'highlight', rects: [{ x: 0.07, y: 0.08, w: 0.6, h: 0.025 }], quote: 'top of page nine' })
  ]);

  const paras = Array.from({ length: 10 }, (_, i) => (i === 5 || i === 7 ? `Paragraph ${i} carries a lantern through the dark.` : `Paragraph ${i} says nothing much at all.`));
  const txt = await api('/documents', 'POST', { title: 'Lantern', text: paras.join('\n\n'), format: 'TXT' });
  await putMarks(txt.id, [{ id: 'm1', kind: 'highlight', anchor: { paragraphIndex: 1, start: 0, end: 9 }, quote: 'Paragraph', color: '#b5527a', themeId: 'love', themeIds: ['love'], createdAt: new Date().toISOString() }]);

  const win = new BrowserWindow({ width: Number(process.env.E2E_WIDTH) || 1280, height: 800, show: false, webPreferences: { offscreen: true } });
  const js = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
  const waitFor = (selector, ms = 20000) =>
    js(`
      for (const t0 = performance.now(); performance.now() - t0 < ${ms}; await new Promise((r) => setTimeout(r, 100)))
        if (document.querySelector(${JSON.stringify(selector)})) return true;
      return false;
    `);
  const open = async (screen, doc, format, ready) => {
    const session = { currentScreen: screen, analysisDoc: { title: doc.title, text: '', format, docId: doc.id }, uploadedLibrary: [], documentNotes: {}, documentFormats: {} };
    await win.loadURL(base);
    await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(session))}); return true;`);
    await win.loadURL(base);
    if (!(await waitFor(ready))) throw new Error(`${screen} never showed ${ready}`);
  };
  const pressC = () => js(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true })); return true;`);
  /** Where a page section (or a page) sits below the top of the PDF scroller, in px. */
  const offsetOf = (selector) =>
    js(`
      const root = document.querySelector('[data-annotation-surface]');
      const el = root?.querySelector(${JSON.stringify(selector)});
      if (!root || !el) return 'missing ' + ${JSON.stringify(selector)};
      return Math.round(el.getBoundingClientRect().top - root.getBoundingClientRect().top);
    `);

  // ── PDF ──
  await open('workspace', pdf, 'PDF', '[data-page-number="1"][data-painted]');
  await js(`document.querySelector('[data-page-number="9"]').scrollIntoView({ block: 'start' }); return true;`);
  await sleep(1200);

  // 1. In from page 9.
  await pressC();
  await sleep(1500);
  const landed = await offsetOf('[data-collapse-page="9"]');
  // Page 9 is the last strip, so the scroller may bottom out before it reaches the top.
  const scroller = await js(`const r = document.querySelector('[data-annotation-surface]'); return { atEnd: r.scrollHeight - r.clientHeight - r.scrollTop < 2, h: r.clientHeight };`);
  check(
    'PDF: going in from page 9 lands on page 9’s strips',
    typeof landed === 'number' && (Math.abs(landed - 12) <= 24 || (scroller.atEnd && landed >= 0 && landed < scroller.h - 150)),
    JSON.stringify({ landed, ...scroller })
  );

  // 2. A mark in the second strip of page 2.
  await js(`document.querySelectorAll('[data-collapse-page="2"] .pdf-band')[1]?.scrollIntoView({ block: 'center' }); return true;`);
  await sleep(800);
  const props = await js(`
    const strips = [...document.querySelectorAll('[data-collapse-page="2"] .pdf-band')];
    if (strips.length !== 2) return { error: 'strips ' + strips.length };
    const strip = strips[1];
    const page = strip.querySelector('[data-page-number="2"]');
    if (!page) return { error: 'missing page in strip' };
    const box = page.getBoundingClientRect();
    const x = box.left + 0.2 * box.width, y = box.top + 0.8725 * box.height;
    page.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    await new Promise((r) => setTimeout(r, 600));
    const bar = [...document.querySelectorAll('[role="toolbar"]')].find((t) => / mark properties$/.test(t.getAttribute('aria-label') || ''));
    if (!bar) return { error: 'missing properties toolbar' };
    const t = bar.getBoundingClientRect(), s = strip.getBoundingClientRect();
    // Distance from the toolbar to the strip holding the mark (0 when they touch or overlap).
    return { gap: Math.round(Math.max(0, t.top - s.bottom, s.top - t.bottom)), bar: Math.round(t.top), strip: [Math.round(s.top), Math.round(s.bottom)] };
  `);
  check('PDF: a mark in a page’s second strip gets its properties beside that strip', props && !props.error && props.gap <= 80, JSON.stringify(props));
  await js(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
  await sleep(400);

  // 2b. A drag from the first strip into the second marks only the words in sight, never the
  //     part of the page folded away between them.
  const before = (await api(`/documents/${pdf.id}/annotations`)).annotations.length;
  const dragged = await js(`
    const strips = [...document.querySelectorAll('[data-collapse-page="2"] .pdf-band')];
    const inSight = (strip) => {
      const s = strip.getBoundingClientRect();
      return [...strip.querySelectorAll('.marginalia-text-layer span')].filter((n) => {
        const r = n.getBoundingClientRect();
        return n.textContent.trim() && r.top >= s.top && r.bottom <= s.bottom;
      });
    };
    const a = inSight(strips[0]).at(-1), b = inSight(strips[1])[0];
    if (!a || !b) return 'missing spans ' + Boolean(a) + Boolean(b);
    const r = document.createRange();
    r.setStart(a.firstChild, 0);
    r.setEnd(b.firstChild, b.firstChild.data.length);
    getSelection().removeAllRanges(); getSelection().addRange(r);
    document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse', bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    const menu = document.querySelector('[aria-label="Mark the selection"]');
    const hl = menu && [...menu.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').startsWith('Highlight'));
    if (!hl) return 'missing highlight button';
    hl.click();
    return true;
  `);
  await sleep(1500);
  const made = (await api(`/documents/${pdf.id}/annotations`)).annotations.slice(before);
  // Strips on page 2: the box (0.1–0.5) and the low highlight (0.86–0.885), each with about a line of context.
  const inStrips = (r) => (r.y >= 0.07 && r.y + r.h <= 0.53) || (r.y >= 0.83 && r.y + r.h <= 0.91);
  const rects = made.flatMap((m) => m.rects ?? []);
  check(
    'PDF: a drag across two strips marks only the words in sight',
    dragged === true && made.length > 0 && made.every((m) => m.page === 2) && rects.length > 0 && rects.every(inStrips),
    JSON.stringify({ dragged, marks: made.length, rects: rects.map((r) => [+r.y.toFixed(3), +(r.y + r.h).toFixed(3)]) })
  );

  // 3. Open page 9.
  await js(`
    const b = document.querySelector('[data-collapse-page="9"] .collapse-fold-read');
    b.scrollIntoView({ block: 'center' }); b.click(); return true;
  `);
  await sleep(2500);
  const opened = await js(`return { collapsed: Boolean(document.querySelector('[data-collapse-page]')), pages: document.querySelectorAll('[data-page-number]').length };`);
  const at9 = await offsetOf('[data-page-number="9"]');
  check('PDF: “Open page” on page 9 shows the whole document at page 9', !opened.collapsed && opened.pages === 12 && typeof at9 === 'number' && Math.abs(at9 - 20) <= 40, JSON.stringify({ ...opened, at9 }));

  // ── Text reader ──
  await open('reader', txt, 'TXT', '#reader-para-text-0');
  await sleep(800);
  const summary = () => js(`return document.querySelector('[aria-label="Collapsed to marks"] [aria-live]')?.textContent?.trim() ?? 'missing summary';`);
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true })); return true;`);
  await sleep(400);
  await js(`
    const input = document.querySelector('input[aria-label="Find in document"]');
    if (!input) throw new Error('missing find input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'lantern');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await sleep(600);
  await pressC();
  await sleep(600);
  await js(`
    const chip = [...document.querySelectorAll('[aria-label="Collapse to"] button')].find((b) => b.textContent.includes('Find'));
    if (!chip) throw new Error('missing Find chip');
    chip.click(); return true;
  `);
  await sleep(500);
  const onFind = await summary();
  await js(`document.querySelector('button[aria-label="Close find"]').click(); return true;`);
  await sleep(600);
  const afterClose = await summary();
  const allOn = await js(`return [...document.querySelectorAll('[aria-label="Collapse to"] button')].find((b) => b.textContent.startsWith('All marks'))?.getAttribute('aria-pressed') ?? 'missing';`);
  check('Reader: collapsed to Find hits shows the two hits', /^Showing 2 of 10/.test(onFind), onFind);
  check('Reader: closing Find falls back to all marks, not an empty page', /^Showing 1 of 10/.test(afterClose) && allOn === 'true', JSON.stringify({ afterClose, allOn }));

  win.destroy();
  fs.rmSync(store, { recursive: true, force: true });
  const failed = results.filter((ok) => !ok).length;
  console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nAll ${results.length} checks passed`);
  app.exit(failed ? 1 : 0);
}

app.whenReady().then(() =>
  main().catch((err) => {
    console.error(err);
    app.exit(1);
  })
);
