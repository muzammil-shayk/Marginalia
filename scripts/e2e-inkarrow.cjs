/**
 * End-to-end checks of the Freehand arrow in the PDF workspace, in the real app (Electron + the
 * built server), on a throwaway library in the temp folder — never the reader's own.
 *
 *   npm run test:e2e        (builds first)
 *
 * 1. Drawing with it (real mouse input) saves an ordinary ink mark flagged `arrowHead`, drawn with
 *    a solid head; the plain Pen still draws a stroke with no head.
 * 2. Undo takes the arrow back; redo returns it with its head.
 * 3. The exported PDF carries the head: a filled triangle at the stroke's end, pointing the way the
 *    stroke was heading (not along the little hook the last sample makes).
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
const PAGE = [420, 595];

async function samplePdf() {
  const { PDFDocument, StandardFonts } = require(path.join(ROOT, 'node_modules', 'pdf-lib'));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  doc.addPage(PAGE).drawText('An arrow, drawn by hand', { x: 40, y: 520, size: 14, font });
  return Buffer.from(await doc.save());
}

/** Every stream in a PDF, inflated where it can be, as latin1 text. */
function pdfStreams(bytes) {
  const raw = bytes.toString('latin1');
  const out = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    try {
      out.push(zlib.inflateSync(bytes.subarray(start, end)).toString('latin1'));
    } catch {
      out.push(bytes.subarray(start, end).toString('latin1'));
    }
  }
  return out.join('\n');
}

/** The stroke the test draws, in page fractions: a curve heading right and down, then a hook up as the pen lifts. */
const N = 30;
const curve = Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1);
  return { x: 0.2 + 0.5 * t, y: 0.3 + 0.3 * t * t };
});
const HOOK = { x: curve[N - 1].x + 0.002, y: curve[N - 1].y - 0.004 }; // a few px up-right, against the heading

async function main() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-e2e-inkarrow-'));
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
  const pdf = await api('/documents', 'POST', { title: 'Arrow', text: 'An arrow', format: 'PDF', filename: 'arrow.pdf' });
  await fetch(`${base}/api/documents/${pdf.id}/original?filename=arrow.pdf`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: await samplePdf() });

  const win = new BrowserWindow({ width: 1600, height: 1000, show: false, webPreferences: { offscreen: true } });
  const wc = win.webContents;
  let saved = null;
  wc.session.on('will-download', (_e, item) => {
    const file = path.join(downloads, `${Date.now()}-${item.getFilename()}`);
    item.setSavePath(file);
    item.once('done', () => (saved = file));
  });
  const js = (code) => wc.executeJavaScript(`(async () => { ${code} })()`);
  const marks = async () => (await api(`/documents/${pdf.id}/annotations`)).annotations || [];
  const waitFor = async (pred, ms = 6000) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(150)) {
      const v = await pred();
      if (v) return v;
    }
    return null;
  };

  const session = { currentScreen: 'workspace', analysisDoc: { title: pdf.title, text: '', format: 'PDF', docId: pdf.id }, uploadedLibrary: [], documentNotes: {}, documentFormats: {} };
  await win.loadURL(base);
  await js(`sessionStorage.setItem('marginalia_session', ${JSON.stringify(JSON.stringify(session))}); return true;`);
  await win.loadURL(base);
  const ok = await js(`
    for (const t0 = performance.now(); performance.now() - t0 < 20000; await new Promise((r) => setTimeout(r, 100)))
      if (document.querySelector('button[aria-label^="Freehand arrow"]') && document.querySelector('[data-page-number="1"] .marginalia-text-layer span')) return true;
    return false;
  `);
  if (!ok) throw new Error('the workspace never showed the Freehand arrow tool and page 1');

  const arm = (label) =>
    js(`
      const b = [...document.querySelectorAll('button[aria-label]')].find((e) => e.getAttribute('aria-label').startsWith(${JSON.stringify(label)}) && !e.getAttribute('aria-label').includes('options') && e.checkVisibility());
      if (!b) return 'missing';
      b.click();
      await new Promise((r) => setTimeout(r, 200));
      return b.getAttribute('aria-pressed');
    `);
  /** Draws through page-fraction points on page 1 with real mouse input. */
  const draw = async (points) => {
    const box = await js(`const r = document.querySelector('[data-page-number="1"]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };`);
    const at = (p) => ({ x: Math.round(box.x + p.x * box.w), y: Math.round(box.y + p.y * box.h) });
    wc.focus();
    const first = at(points[0]);
    wc.sendInputEvent({ type: 'mouseMove', ...first });
    wc.sendInputEvent({ type: 'mouseDown', ...first, button: 'left', clickCount: 1 });
    for (const p of points.slice(1)) {
      wc.sendInputEvent({ type: 'mouseMove', ...at(p), button: 'left', modifiers: ['leftButtonDown'] });
      await sleep(16);
    }
    wc.sendInputEvent({ type: 'mouseUp', ...at(points[points.length - 1]), button: 'left', clickCount: 1 });
    await sleep(300);
  };
  const key = async (keyCode, modifiers) => {
    wc.focus();
    wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    await sleep(300);
  };

  // 1. Freehand arrow, then the plain pen.
  const pressed = await arm('Freehand arrow');
  await draw([...curve, HOOK]);
  const arrow = await waitFor(async () => (await marks()).find((m) => m.kind === 'ink' && m.arrowHead));
  check('Freehand arrow arms and saves an ink mark with arrowHead', pressed === 'true' && Boolean(arrow) && arrow.points.length > 10, `pressed=${pressed} ${arrow ? arrow.points.length + ' points' : 'no mark'}`);
  const drawn = arrow
    ? await js(`
        const heads = [...document.querySelectorAll('[data-page-number="1"] g[data-arrow-head] polygon')];
        const r = heads[0]?.getBoundingClientRect();
        return { heads: heads.length, size: r ? Math.round(Math.max(r.width, r.height)) : 0 };
      `)
    : {};
  // A head several px across (4 stroke widths), not the few-px SVG marker the straight arrow gets.
  check('On the page: the stroke ends in one solid head of a readable size', drawn.heads === 1 && drawn.size >= 8, JSON.stringify(drawn));

  await key('Escape');
  const penPressed = await arm('Pen');
  await draw(curve.map((p) => ({ x: p.x, y: 0.12 + (p.y - 0.3) * 0.3 })));
  const pen = await waitFor(async () => (await marks()).find((m) => m.kind === 'ink' && !m.arrowHead));
  const penHead = await js(`return document.querySelectorAll('[data-page-number="1"] g[data-arrow-head]').length !== 1;`);
  check('The plain Pen still draws a stroke with no head', Boolean(pen) && !penHead, JSON.stringify((await marks()).map((m) => [m.kind, m.arrowHead, m.points?.length])) + ' pen tool ' + penPressed);

  // 2. Undo and redo (Ctrl works on every platform; see workspaceKeys).
  await key('Escape');
  await key('z', ['control']);
  await key('z', ['control']);
  const undone = await waitFor(async () => ((await marks()).some((m) => m.arrowHead) ? null : true));
  await key('z', ['control', 'shift']);
  const redone = await waitFor(async () => (await marks()).find((m) => m.arrowHead));
  check('Undo takes the arrow back; redo returns it with its head', Boolean(undone) && Boolean(redone) && redone.points.length === arrow?.points.length);
  await key('z', ['control', 'shift']);

  // 3. Export: a filled triangle whose tip sits at the stroke's end, pointing along the curve.
  await key('Escape');
  saved = null;
  const how = await js(`
    const open = document.querySelector('button[aria-label="Export"]');
    if (open) { open.click(); await new Promise((r) => setTimeout(r, 300)); const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save PDF'); if (!b) return 'missing Save PDF'; b.click(); return 'menu'; }
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Export PDF'));
    if (!b) return 'missing export';
    b.click();
    return 'button';
  `);
  for (let i = 0; i < 60 && !saved; i++) await sleep(250);
  const streams = saved ? pdfStreams(fs.readFileSync(saved)) : '';
  const mark = (await marks()).find((m) => m.arrowHead);
  let detail = `${how} ${saved ? path.basename(saved) : 'no file'}`;
  let headOk = false;
  if (mark && streams) {
    const end = mark.points[mark.points.length - 1];
    const [ex, ey] = [end.x * PAGE[0], (1 - end.y) * PAGE[1]];
    // The way the curve was heading at its end (its tangent), in PDF space (y up).
    const tan = [0.5 * PAGE[0], -0.6 * PAGE[1]];
    const tl = Math.hypot(...tan);
    // drawSvgPath writes a triangle as `x -y m x -y l x -y l h`.
    const tri = /(-?[\d.]+) (-?[\d.]+) m\s+(-?[\d.]+) (-?[\d.]+) l\s+(-?[\d.]+) (-?[\d.]+) l\s+h/g;
    let m;
    const near = [];
    while ((m = tri.exec(streams))) {
      const [tx, ty, lx, ly, rx, ry] = m.slice(1).map(Number).map((v, i) => (i % 2 ? -v : v));
      if (Math.hypot(tx - ex, ty - ey) > 8) continue;
      const back = [(lx + rx) / 2, (ly + ry) / 2];
      const dir = [tx - back[0], ty - back[1]];
      const cos = (dir[0] * tan[0] + dir[1] * tan[1]) / (Math.hypot(...dir) * tl);
      near.push(cos.toFixed(3));
      if (cos > Math.cos((15 * Math.PI) / 180)) headOk = true;
    }
    detail += ` heads near the end: [${near.join(', ')}] (cos to the curve's heading)`;
  }
  check('Exported PDF: a filled arrowhead at the end of the stroke, along the curve, not the hook', headOk, detail);

  // 4. The straight arrow draws the same kind of head (a pixel-sized polygon, not an SVG marker).
  await key('Escape');
  await arm('Arrow');
  await draw([{ x: 0.55, y: 0.25 }, { x: 0.7, y: 0.25 }, { x: 0.85, y: 0.25 }]);
  const straight = await waitFor(async () => (await marks()).find((m) => m.kind === 'arrow'));
  const heads = straight
    ? await js(`
        // Each head's length, tip to the middle of its back edge, in px (independent of its angle).
        return [...document.querySelectorAll('[data-page-number="1"] g[data-arrow-head] polygon')].map((p) => {
          const box = p.ownerSVGElement.getBoundingClientRect();
          const [t, l, r] = p.getAttribute('points').split(' ').map((q) => q.split(',').map(Number)).map(([x, y]) => [(x / 100) * box.width, (y / 100) * box.height]);
          return Math.round(Math.hypot(t[0] - (l[0] + r[0]) / 2, t[1] - (l[1] + r[1]) / 2));
        });
      `)
    : [];
  const markers = await js(`return document.querySelectorAll('[data-page-number="1"] marker').length;`);
  check('The straight arrow has the same solid head as the freehand one, and no SVG marker', Boolean(straight) && heads.length === 2 && Math.abs(heads[0] - heads[1]) <= 1 && heads[0] >= 8 && markers === 0, JSON.stringify({ heads, markers }));

  win.destroy();
  server.stopServer?.();
  for (const dir of [store, downloads]) fs.rmSync(dir, { recursive: true, force: true });
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
