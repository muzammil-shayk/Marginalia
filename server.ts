import "dotenv/config";
import express from "express";
import path from "path";
import { PDFDocument } from "pdf-lib";
import {
  saveDocument,
  attachOriginal,
  getDocument,
  getOriginal,
  listDocuments,
  updateDocument,
  deleteDocument,
  startDocumentSweeper,
  setStoreDirectory,
  getBackend,
  getSettings,
  saveSettings,
  RETENTION_DAYS
} from "./src/services/documentStore";
import analyzerRouter from "./src/services/analyzer";

/**
 * Re-exported for the desktop shell, which owns the folder picker and calls this to re-point the
 * store after the user chooses a new location. Without the re-export it is not on the bundled
 * module's surface and the change-folder action fails at runtime.
 */
export { setStoreDirectory };

const app = express();

/**
 * The desktop build passes PORT=0 so the OS assigns a free port — a fixed one would refuse to
 * start whenever another copy of the app (or a stray dev server) already held 3001.
 */
const PORT = process.env.PORT !== undefined ? Number(process.env.PORT) : 3001;

/**
 * Rejects API requests that did not come from the app itself.
 *
 * The server listens only on 127.0.0.1, which keeps it off the network, but "local" is not the
 * same as "private": any page open in the user's browser can issue requests to localhost, and a
 * DNS-rebinding attack can make a remote site appear to be one. Neither is hypothetical for an
 * app whose API can list, read and permanently DELETE the user's documents.
 *
 * Two cheap checks close that off without touching the app's own traffic:
 *
 *   - `Origin`: same-origin requests from the app either omit it or send this server's own
 *     origin. Any other value is a cross-site caller and is refused.
 *   - `Host`: rebinding works by resolving an attacker-controlled hostname to 127.0.0.1, so the
 *     request arrives carrying that hostname. Requiring a loopback Host defeats it.
 *
 * What this does NOT defend against is another program already running on the same machine,
 * which can simply speak to the port directly. Guarding that needs a per-launch secret shared
 * with the client, and is worth doing if the threat model ever includes untrusted local software.
 */
function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return name === "localhost" || name === "127.0.0.1" || name === "::1";
}

app.use("/api", (req, res, next) => {
  if (!isLoopbackHost(req.headers.host)) {
    res.status(403).json({ error: "Forbidden." });
    return;
  }

  const origin = req.headers.origin;
  if (origin) {
    let originHost: string | undefined;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = undefined;
    }
    if (!isLoopbackHost(originHost)) {
      res.status(403).json({ error: "Forbidden." });
      return;
    }
  }

  next();
});

/**
 * One JSON parser, sized for the largest body any route takes.
 *
 * Per-route `express.json()` limits are dead code behind a global one: this middleware runs
 * first, sets `req._body`, and every later parser no-ops. So the 50mb on document creation, the
 * 200mb on HTML import and the 25mb on annotations were all silently capped at 10mb, and
 * importing a large book failed with an unexplained 413. The server listens on loopback only and
 * refuses cross-site callers, so the ceiling is a practical one rather than a security boundary.
 */
app.use(express.json({ limit: "200mb" }));

// Health check endpoint
/** Gemini-backed thematic analysis of a stored PDF. See `src/services/analyzer.ts`. */
app.use("/api", analyzerRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Client log forwarding endpoint
app.post("/api/client-log", (req, res) => {
  try {
    const { type, messages = [] } = req.body || {};
    const prefix = `[Browser ${String(type || 'log').toUpperCase()}]`;
    const logList = Array.isArray(messages) ? messages : [messages];
    if (type === 'error') {
      console.error(prefix, ...logList);
    } else if (type === 'warn') {
      console.warn(prefix, ...logList);
    } else {
      console.log(prefix, ...logList);
    }
  } catch (e) {
    // Ignore logging errors
  }
  res.sendStatus(200);
});

// ── Document Store ──────────────────────────────────────────────────────────
// Uploaded documents are held on this machine's own disk rather than in the browser, so a
// document isn't capped by the ~5MB sessionStorage quota and its original file survives being
// parsed. A sweeper deletes anything past the retention window (see documentStore.ts).

/**
 * Attaches the original uploaded file to a document already created by POST /api/documents.
 *
 * Upload is deliberately two requests rather than one. A single request would have to carry
 * both the extracted text and the raw file bytes, and there is no good way to do that here:
 * putting the text in the query string caps it at Node's ~16KB max header size (a ~3,000-word
 * document — far WORSE than the browser quota this store exists to escape), and base64-ing the
 * file into the JSON inflates it by a third. So the text goes up as JSON, the file goes up as
 * raw bytes, and each travels in the shape that suits it.
 */
app.put(
  "/api/documents/:id/original",
  express.raw({ type: "application/octet-stream", limit: "50mb" }),
  async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: "Original file bytes are required." });
        return;
      }
      const filename = typeof req.query.filename === "string" ? req.query.filename : undefined;
      const attached = await attachOriginal(req.params.id, req.body, filename);
      if (!attached) {
        res.status(404).json({ error: "Document not found." });
        return;
      }
      res.json({ attached: true });
    } catch (error) {
      console.error("Attaching original failed:", error);
      res.status(500).json({ error: "Failed to store the original file." });
    }
  }
);

/**
 * Creates a document from its extracted text. Used for pasted text and as the first step of a
 * file upload, whose original bytes then follow via PUT /api/documents/:id/original.
 */
app.post("/api/documents", express.json({ limit: "50mb" }), async (req, res) => {
  try {
    const { title, text, format, filename } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Document text is required." });
      return;
    }
    const meta = await saveDocument({
      title: title || "Untitled Document",
      text,
      format: format || "TXT",
      filename
    });
    res.json({ ...meta, retentionDays: RETENTION_DAYS });
  } catch (error: any) {
    console.error("Document save failed:", error);
    res.status(500).json({ error: "Failed to store document." });
  }
});

/**
 * Creates a document from an HTML page, converting it to a PDF on the way in.
 *
 * This is what makes an imported `.htm` book annotatable rather than read-only. The annotating
 * workspace positions every mark as a fraction of a page box, which reflowable HTML simply does
 * not have; printing the page once, here, gives the document a fixed pagination that every
 * annotation can then be anchored to and that survives resizing, zooming and reopening. From
 * this point on the stored original is an ordinary PDF and nothing downstream needs to know it
 * began life as HTML — the format is recorded as HTML only so the library can say what it was.
 *
 * Conversion needs a browser engine, which only the desktop build supplies (see
 * `setHtmlToPdfRenderer` and `electron/main.cjs`). Running as a bare dev server there is none,
 * so the import is refused with an explanation rather than silently storing an unopenable file.
 */
app.post("/api/documents/from-html", express.json({ limit: "200mb" }), async (req, res) => {
  try {
    const { title, text, html, filename } = req.body || {};
    if (!html || typeof html !== "string" || !html.trim()) {
      res.status(400).json({ error: "The HTML document is required." });
      return;
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "No readable text was extracted from that HTML file." });
      return;
    }
    if (!htmlToPdfRenderer) {
      res.status(501).json({
        error:
          "Importing HTML needs the desktop app, which supplies the page renderer. Open Marginalia as the desktop app and try again."
      });
      return;
    }

    const pdfBuffer = await htmlToPdfRenderer({
      html,
      displayHeaderFooter: false,
      headerTemplate: "",
      footerTemplate: "",
      // Narrow, because the imported page constrains its own reading column: these only need to
      // keep text off the paper's edge, and every millimetre they take is one the column cannot
      // use for type.
      marginsMm: { top: 15, right: 14, bottom: 15, left: 14 }
    });

    const documentTitle = typeof title === "string" && title.trim() ? title.trim() : "Untitled Document";
    const baseName = (typeof filename === "string" && filename ? filename : documentTitle).replace(
      /\.[^/.]+$/,
      ""
    );

    const meta = await saveDocument({
      title: documentTitle,
      text,
      format: "HTML",
      filename: `${baseName}.pdf`
    });

    // The original is required, not best-effort: the workspace renders the stored PDF by id, so
    // a document whose bytes failed to write would open to an empty viewer. Rather than leave
    // that behind, the half-made record is removed and the failure reported.
    const attached = await attachOriginal(meta.id, pdfBuffer, `${baseName}.pdf`);
    if (!attached) {
      await deleteDocument(meta.id).catch(() => undefined);
      res.status(500).json({ error: "The converted document could not be saved to this device." });
      return;
    }

    res.json({ ...meta, format: "HTML", originalBytes: pdfBuffer.length, retentionDays: RETENTION_DAYS });
  } catch (error) {
    console.error("HTML import failed:", error);
    res.status(500).json({ error: "That HTML file could not be converted into a readable document." });
  }
});

app.get("/api/documents", async (_req, res) => {
  try {
    res.json({ documents: await listDocuments(), retentionDays: RETENTION_DAYS });
  } catch (error) {
    console.error("Document list failed:", error);
    res.status(500).json({ error: "Failed to list documents." });
  }
});

/**
 * Full-text search across every stored document. Search has to run here rather than in the
 * browser now that document bodies live on disk: the client only holds ids and metadata, so a
 * purely local search could only ever match documents already opened this session.
 */
app.get("/api/documents/search", async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query) {
    res.json({ results: [] });
    return;
  }

  try {
    const metas = await listDocuments();
    const needle = query.toLowerCase();
    const results: Array<{ id: string; title: string; format: string; snippet: string; matches: number }> = [];

    for (const meta of metas) {
      const doc = await getDocument(meta.id);
      if (!doc) continue;
      const haystack = doc.text.toLowerCase();
      const titleHit = meta.title.toLowerCase().includes(needle);
      const firstIdx = haystack.indexOf(needle);
      if (!titleHit && firstIdx === -1) continue;

      let matches = 0;
      let cursor = 0;
      while ((cursor = haystack.indexOf(needle, cursor)) !== -1) {
        matches++;
        cursor += needle.length;
      }

      // A window of surrounding text so the reader can see the term in context, not just
      // that some match exists somewhere in the document.
      const snippetStart = firstIdx === -1 ? 0 : Math.max(0, firstIdx - 60);
      const snippet = doc.text.slice(snippetStart, snippetStart + 200).replace(/\s+/g, " ").trim();

      results.push({ id: meta.id, title: meta.title, format: meta.format, snippet, matches });
    }

    results.sort((a, b) => b.matches - a.matches);
    res.json({ results });
  } catch (error) {
    console.error("Document search failed:", error);
    res.status(500).json({ error: "Search failed." });
  }
});

app.get("/api/documents/:id", async (req, res) => {
  const doc = await getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: "Document not found. It may have passed its retention window." });
    return;
  }
  res.json(doc);
});

/** Content types for the formats the workspace can render in place rather than download. */
const INLINE_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".epub": "application/epub+zip",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

/**
 * Hands back the original uploaded file, byte-for-byte as it was stored.
 *
 * `?disposition=inline` serves it with its real content type instead of forcing a download,
 * which is what the PDF workspace fetches: PDF.js needs the actual bytes of the source file,
 * not the text scraped out of it, to render the real pages.
 */
app.get("/api/documents/:id/original", async (req, res) => {
  const original = await getOriginal(req.params.id);
  if (!original) {
    res.status(404).json({ error: "Original file not found for this document." });
    return;
  }
  const ext = path.extname(original.filename).toLowerCase();
  const safeName = original.filename.replace(/"/g, "");

  if (req.query.disposition === "inline") {
    res.setHeader("Content-Type", INLINE_CONTENT_TYPES[ext] || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  } else {
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  }
  res.send(original.buffer);
});

/** Renames a stored document. Used by the library panel's edit action. */
app.patch("/api/documents/:id", async (req, res) => {
  const { title } = req.body || {};
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "A non-empty title is required." });
    return;
  }
  const meta = await updateDocument(req.params.id, { title: title.slice(0, 300) });
  if (!meta) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  res.json(meta);
});

app.get("/api/documents/:id/annotations", async (req, res) => {
  const doc = await getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  res.json({ annotations: doc.annotations });
});

/**
 * Replaces a document's annotations wholesale. The client owns the full set and sends it after
 * each edit, so a whole-array PUT keeps the two in sync without needing per-annotation
 * add/update/delete routes and the ordering problems they bring.
 */
app.put("/api/documents/:id/annotations", express.json({ limit: "25mb" }), async (req, res) => {
  const { annotations } = req.body || {};
  if (!Array.isArray(annotations)) {
    res.status(400).json({ error: "An annotations array is required." });
    return;
  }
  /**
   * A write that removes marks is worth saying out loud.
   *
   * Deleting one is ordinary; losing thirty to a stale overwrite is not, and the two are
   * indistinguishable at this layer. The store keeps the previous set (see `annotationsBackup`),
   * so this line is how anyone finds out it happened and when.
   */
  const before = await getDocument(req.params.id);
  const had = before?.annotations.length ?? 0;
  if (annotations.length < had) {
    console.warn(
      `[Marginalia] annotations SHRANK ${had} -> ${annotations.length} on ${req.params.id} — previous set kept, restore with POST /api/documents/${req.params.id}/annotations/restore`
    );
  }
  const meta = await updateDocument(req.params.id, { annotations });
  if (!meta) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  res.json(meta);
});

/**
 * Where the reader left off in this document — zoom, page and single/spread view. Stored here
 * rather than in the browser's localStorage because the desktop build's embedded server binds to
 * a fresh random port every launch (see this file's PORT=0 comment), and a different port is a
 * different origin to the browser — so localStorage would reset on every restart and update.
 */
/**
 * Puts back the annotation set from before the last write that removed marks.
 *
 * The escape hatch for the failure this store cannot otherwise survive: a document's marks are
 * hours of reading, there is no history, and a bad overwrite is silent. Kept deliberately blunt —
 * one slot, one step back.
 */
app.post("/api/documents/:id/annotations/restore", async (req, res) => {
  const doc = await getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  if (!doc.annotationsBackup) {
    res.status(404).json({ error: "No previous annotation set is stored for this document." });
    return;
  }
  const restoring = doc.annotationsBackup.annotations.length;
  const meta = await updateDocument(req.params.id, { restoreAnnotationsBackup: true });
  console.log(`[Marginalia] restored ${restoring} annotations on ${req.params.id}`);
  res.json({ restored: restoring, meta });
});

app.get("/api/documents/:id/reading-state", async (req, res) => {
  const doc = await getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  res.json({ readingState: doc.readingState });
});

app.put("/api/documents/:id/reading-state", async (req, res) => {
  const { readingState } = req.body || {};
  if (
    !readingState ||
    typeof readingState.scale !== "number" ||
    typeof readingState.page !== "number" ||
    (readingState.viewMode !== "single" && readingState.viewMode !== "spread")
  ) {
    res.status(400).json({ error: "A valid readingState object is required." });
    return;
  }
  const meta = await updateDocument(req.params.id, { readingState });
  if (!meta) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  res.json({ saved: true });
});

/**
 * Inserts a blank page into the document's own stored PDF file — a REAL page written into the
 * original, not a virtual overlay the app only pretends is there. That is what lets it render
 * through the ordinary page pipeline, be annotated as any other page can, and survive being
 * closed and reopened or exported, all with no separate code path.
 *
 * `placement` is relative to `anchorPage` (the page the reader had open) for 'before'/'after', or
 * ignores it for 'both-ends', which inserts one blank page at the very start of the document and
 * appends another at the very end in the same request. `height` picks the new page's height in
 * points; its width always matches the page it's inserted next to, so it never reads as a
 * foreign size dropped into the document.
 *
 * Every existing annotation's `page` number is shifted to match wherever the new page landed —
 * the whole reason this recomputes rather than trusting the client to know the new numbering.
 */
app.post("/api/documents/:id/pages", express.json(), async (req, res) => {
  const { placement, anchorPage, height } = req.body || {};
  if (placement !== "before" && placement !== "after" && placement !== "both-ends") {
    res.status(400).json({ error: "placement must be 'before', 'after', or 'both-ends'." });
    return;
  }
  if (height !== "full" && height !== "header" && height !== "notes") {
    res.status(400).json({ error: "height must be 'full', 'header', or 'notes'." });
    return;
  }
  if (placement !== "both-ends" && (typeof anchorPage !== "number" || anchorPage < 1)) {
    res.status(400).json({ error: "A valid anchorPage is required for 'before' and 'after'." });
    return;
  }

  const [original, doc] = await Promise.all([getOriginal(req.params.id), getDocument(req.params.id)]);
  if (!original || !doc) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  if (path.extname(original.filename).toLowerCase() !== ".pdf") {
    res.status(400).json({ error: "Only PDF documents support inserted pages." });
    return;
  }

  try {
    const pdfDoc = await PDFDocument.load(original.buffer, { ignoreEncryption: true });
    const pageCountBefore = pdfDoc.getPageCount();
    if (pageCountBefore === 0) {
      res.status(400).json({ error: "This PDF has no pages." });
      return;
    }

    const referenceIndex = Math.min(Math.max((anchorPage || 1) - 1, 0), pageCountBefore - 1);
    const { width, height: fullHeight } = pdfDoc.getPage(referenceIndex).getSize();
    const insertHeight = height === "full" ? fullHeight : height === "header" ? 108 : 252; // 1.5in / 3.5in

    let insertedPages: number[];
    if (placement === "both-ends") {
      pdfDoc.insertPage(0, [width, insertHeight]);
      pdfDoc.addPage([width, insertHeight]);
      insertedPages = [1, pdfDoc.getPageCount()];
    } else {
      const index0 = placement === "before" ? referenceIndex : referenceIndex + 1;
      pdfDoc.insertPage(index0, [width, insertHeight]);
      insertedPages = [index0 + 1];
    }

    const newBytes = await pdfDoc.save();
    await attachOriginal(req.params.id, Buffer.from(newBytes), original.filename);

    // Only the page inserted at the very start ever shifts an EXISTING annotation — one appended
    // at the end is by definition after everything already there. For 'before'/'after', that's
    // wherever the single new page landed, in both cases.
    const shiftFrom = placement === "both-ends" ? 1 : insertedPages[0];
    // Re-read rather than reuse the `doc` from the top of this handler. Saving a large PDF takes
    // seconds, and a mark made while it ran has already been written by the client's own save —
    // shifting the snapshot taken before that would put the older list back and lose it.
    const current = await getDocument(req.params.id);
    const annotations = (current?.annotations ?? doc.annotations).map((a) =>
      typeof a.page === "number" && a.page >= shiftFrom ? { ...a, page: a.page + 1 } : a
    );
    await updateDocument(req.params.id, { annotations });

    res.json({ insertedPages, pageCount: pdfDoc.getPageCount() });
  } catch (error) {
    console.error("Page insertion failed:", error);
    res.status(500).json({ error: "Could not insert a page into this PDF." });
  }
});

/**
 * Removes one page — inserted or original — from the document's own stored PDF file. Any
 * annotation ON that page is discarded with it; everything after it shifts down by one to close
 * the gap, the mirror image of what inserting a page does to the numbering.
 *
 * Refuses to remove the last remaining page: a PDF with zero pages isn't a smaller document, it's
 * a broken one, and the right way to get rid of a whole document is deleting it, not emptying it.
 */
app.delete("/api/documents/:id/pages/:pageNumber", async (req, res) => {
  const pageNumber = Number(req.params.pageNumber);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    res.status(400).json({ error: "pageNumber must be a positive integer." });
    return;
  }

  const [original, doc] = await Promise.all([getOriginal(req.params.id), getDocument(req.params.id)]);
  if (!original || !doc) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  if (path.extname(original.filename).toLowerCase() !== ".pdf") {
    res.status(400).json({ error: "Only PDF documents support removing pages." });
    return;
  }

  try {
    const pdfDoc = await PDFDocument.load(original.buffer, { ignoreEncryption: true });
    const pageCountBefore = pdfDoc.getPageCount();
    if (pageNumber > pageCountBefore) {
      res.status(400).json({ error: "That page doesn't exist." });
      return;
    }
    if (pageCountBefore <= 1) {
      res.status(400).json({ error: "Can't remove the only page left. Delete the document instead." });
      return;
    }

    pdfDoc.removePage(pageNumber - 1);
    const newBytes = await pdfDoc.save();
    await attachOriginal(req.params.id, Buffer.from(newBytes), original.filename);

    // Re-read for the same reason as page insertion: a mark made during the PDF save is already
    // on disk, and renumbering a stale snapshot would erase it.
    const current = await getDocument(req.params.id);
    const annotations = (current?.annotations ?? doc.annotations)
      .filter((a) => typeof a.page !== "number" || a.page !== pageNumber)
      .map((a) => (typeof a.page === "number" && a.page > pageNumber ? { ...a, page: a.page - 1 } : a));
    await updateDocument(req.params.id, { annotations });

    res.json({ pageCount: pdfDoc.getPageCount() });
  } catch (error) {
    console.error("Page removal failed:", error);
    res.status(500).json({ error: "Could not remove that page." });
  }
});

/**
 * Deletes a document from this machine's disk permanently — record, original file and
 * annotations. Backs the library panel's delete button, which is the only way documents leave
 * the store now that retention is opt-in.
 */
app.delete("/api/documents/:id", async (req, res) => {
  const deleted = await deleteDocument(req.params.id);
  res.json({ deleted });
});

/** Where documents are being written, so the library panel can show the user the real path. */
app.get("/api/storage", (_req, res) => {
  res.json({
    backend: getBackend().name,
    location: getBackend().location,
    retentionDays: RETENTION_DAYS
  });
});

/**
 * The reader's preferences — name, theme colours, palettes, typography, dark mode. Stored beside
 * the document library (see LocalDocumentBackend.getSettings) rather than left to the browser's
 * localStorage, because the desktop build's embedded server binds to a fresh random port every
 * launch: a different port is a different origin, so localStorage would reset on every restart
 * and every auto-update. This file lives in the OS per-user application-data directory instead,
 * which — like the library itself — survives both.
 */
app.get("/api/settings", async (_req, res) => {
  const settings = await getSettings();
  res.json({ settings });
});

app.put("/api/settings", async (req, res) => {
  const settings = req.body?.settings;
  if (!settings || typeof settings !== "object") {
    res.status(400).json({ error: "settings object required" });
    return;
  }
  await saveSettings(settings);
  res.json({ saved: true });
});

/**
 * How generated HTML becomes a PDF.
 *
 * Kept behind a seam because the two ways this app runs have different browsers available. Run as
 * a plain server it falls back to Puppeteer's headless Chrome; run inside the packaged desktop
 * app, the Electron main process registers a renderer backed by Electron's own bundled Chromium
 * (see `electron/main.cjs`). The desktop path is the one that matters here — it keeps Puppeteer's
 * several-hundred-megabyte Chrome download out of the installer while producing the same output,
 * since Electron's printToPDF accepts the same header/footer templates.
 */
export interface HtmlToPdfOptions {
  html: string;
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  marginsMm: { top: number; right: number; bottom: number; left: number };
  /** Paper size, defaulting to A4. */
  pageSize?: "A4" | "A5" | "Letter";
}

export type HtmlToPdfRenderer = (options: HtmlToPdfOptions) => Promise<Buffer>;

let htmlToPdfRenderer: HtmlToPdfRenderer | null = null;

/** Lets the Electron main process substitute its own Chromium. */
export function setHtmlToPdfRenderer(renderer: HtmlToPdfRenderer): void {
  htmlToPdfRenderer = renderer;
}

// Start Vite / Static handler
/**
 * Boots the server and resolves with the port it actually bound to.
 *
 * Two things about this shape matter for the desktop build. It returns the port rather than
 * assuming one, because Electron starts the server on PORT=0 and needs to know where to point
 * the window. And it is exported rather than invoked at import time, so the Electron main
 * process can await a ready server before creating that window instead of racing it.
 *
 * `staticRoot` lets the packaged app pass the location of its bundled `dist` directory;
 * outside the package it falls back to `dist` under the working directory as before.
 */
export async function startServer(options: { staticRoot?: string } = {}): Promise<number> {
  if (process.env.NODE_ENV !== "production") {
    // Imported here rather than at the top of the file so the production bundle — including
    // the one inside the packaged desktop app — never has to resolve Vite at all.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = options.staticRoot || path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const sweeper = startDocumentSweeper();

  return new Promise<number>((resolve, reject) => {
    const server = app.listen(PORT, "127.0.0.1", () => {
      const address = server.address();
      const boundPort = typeof address === "object" && address ? address.port : PORT;
      console.log(`Marginalia server running on http://127.0.0.1:${boundPort}`);
      console.log(`[Marginalia] Document storage: ${getBackend().name}`);
      console.log(
        sweeper
          ? `[Marginalia] Retention: documents swept after ${RETENTION_DAYS} days.`
          : `[Marginalia] Retention: off — documents are kept until deleted from the library.`
      );
      resolve(boundPort);
    });
    server.on("error", reject);
  });
}

// Running the server directly (`npm run dev` / `npm start`) starts it immediately. When the
// Electron main process imports this module instead, it calls startServer() itself so it can
// set the store directory and await the port first.
if (!process.env.MARGINALIA_EMBEDDED) {
  startServer().catch((err) => {
    console.error("[Marginalia] Failed to start server:", err);
    process.exit(1);
  });
}
