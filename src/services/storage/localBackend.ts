/**
 * Local filesystem document backend — the store the app uses for uploaded documents.
 *
 * Everything lives on the machine the app is running on; nothing is uploaded anywhere. In the
 * packaged desktop build the Electron main process points MARGINALIA_STORE_DIR at the OS's
 * per-user application-data directory, so the library follows the user account rather than
 * whatever directory the app happened to be launched from.
 *
 * Layout:
 *   {STORE_ROOT}/documents/{id}.json   metadata + extracted text + annotations
 *   {STORE_ROOT}/originals/{id}{ext}   the raw uploaded file
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  DocumentBackend,
  DocumentMeta,
  PdfPageEditInput,
  PdfPageEditOutput,
  SaveDocumentParams,
  StoredDocument,
  UpdateDocumentParams,
  buildMeta,
  computeThemeCounts,
  computeThemeIds,
  countTerminology,
  countWords,
  isGeminiKey,
  isValidId,
  safeExtension,
  summarizeAnalysis
} from './types';

/** Writes a file and fsyncs it before returning, so a later rename never exposes unflushed bytes. */
async function writeDurable(target: string, data: string | Uint8Array): Promise<void> {
  const handle = await fs.open(target, 'w');
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** tmp + fsync + rename: the target is always either the old file or the new one, never a fragment. */
async function writeFileAtomic(target: string, data: string | Uint8Array): Promise<void> {
  const temporary = `${target}.tmp`;
  try {
    await writeDurable(temporary, data);
    await fs.rename(temporary, target);
  } catch (err) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw err;
  }
}

const errorCode = (err: unknown) => (err as NodeJS.ErrnoException | null)?.code;

/** Parses a record, treating anything but a JSON object as corrupt. */
function parseRecord(raw: string): Partial<StoredDocument> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('record is not an object');
  return parsed;
}

/** Page-edit leftovers and temp files that sit beside an original but are never the original. */
const AUXILIARY_ORIGINAL = /\.(prev|next|tmp)$/;

/** Lock key for settings.json; ids are 32 hex chars, so this can never collide with one. */
const SETTINGS_LOCK = 'settings';

export class LocalDocumentBackend implements DocumentBackend {
  readonly name: string;
  readonly location: string;
  private docsDir: string;
  private originalsDir: string;

  private settingsPath: string;

  constructor(storeRoot?: string) {
    const root = storeRoot ? path.resolve(storeRoot) : path.join(process.cwd(), '.marginalia-store');
    this.location = root;
    this.docsDir = path.join(root, 'documents');
    this.originalsDir = path.join(root, 'originals');
    this.settingsPath = path.join(root, 'settings.json');
    this.name = `local disk (${root})`;
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(this.docsDir, { recursive: true });
    await fs.mkdir(this.originalsDir, { recursive: true });
  }

  private docPath(id: string): string {
    return path.join(this.docsDir, `${id}.json`);
  }

  private async findOriginalPath(id: string): Promise<string | null> {
    try {
      const entries = await fs.readdir(this.originalsDir);
      const match = entries.find(
        (name) => (name.startsWith(`${id}.`) || name === id) && !AUXILIARY_ORIGINAL.test(name)
      );
      return match ? path.join(this.originalsDir, match) : null;
    } catch {
      return null;
    }
  }

  /**
   * Serialises everything that touches one document's record.
   *
   * Every writer here is a read-modify-write of the WHOLE record: read the document, change one
   * field, write it all back. Two of those interleaved lose the other's change entirely — and the
   * workspace fires two of them on the same 700ms debounce, one for annotations and one for the
   * reading position. Scroll a page while a mark is pending and the reading-state write, holding
   * a snapshot taken before the mark existed, puts the old annotation list back. No shrink is
   * recorded either, because that write never mentions annotations, so the backup net does not
   * see it and nothing is logged. It is a silent way to lose work.
   *
   * A promise chain per id is the whole fix: the second write waits for the first to finish, so
   * it reads what the first wrote. Keyed per document, so two books never wait on each other.
   */
  private locks = new Map<string, Promise<unknown>>();

  private withLock<T>(id: string, work: () => Promise<T>): Promise<T> {
    const queued = (this.locks.get(id) ?? Promise.resolve()).then(work, work);
    const settled = queued.catch(() => undefined);
    this.locks.set(id, settled);
    // Dropped once nothing is queued behind it, so the map does not grow with every document
    // ever opened.
    void settled.then(() => {
      if (this.locks.get(id) === settled) this.locks.delete(id);
    });
    return queued;
  }

  /**
   * Writes a document record atomically.
   *
   * `fs.writeFile` truncates before it writes, so a crash, a full disk or a power cut mid-write
   * leaves a half-written file — which `getDocument` cannot tell from a missing one, since it
   * catches everything and returns null. The library then reports the document as gone. Writing
   * beside it and renaming into place makes the swap atomic: the record is either the old one or
   * the new one, never a fragment of both.
   *
   * The record being replaced is kept as `{id}.json.bak` first, so damage from outside the app
   * (a bad sync, a disk error) costs at most the last change rather than the whole document.
   */
  private async write(doc: StoredDocument): Promise<void> {
    const target = this.docPath(doc.id);
    try {
      await fs.copyFile(target, `${target}.bak`);
    } catch (err) {
      if (errorCode(err) !== 'ENOENT') throw err;
    }
    await writeFileAtomic(target, JSON.stringify(doc));
  }

  async saveDocument(params: SaveDocumentParams): Promise<DocumentMeta> {
    await this.ensureDirs();
    const meta = buildMeta(crypto.randomBytes(16).toString('hex'), params);
    await this.write({
      ...meta,
      text: params.text,
      annotations: [],
      readingState: null,
      analysis: null,
      annotationsBackup: null
    });
    return meta;
  }

  attachOriginal(id: string, original: Buffer, filename?: string): Promise<boolean> {
    return this.withLock(id, () => this.attachOriginalLocked(id, original, filename));
  }

  private async attachOriginalLocked(
    id: string,
    original: Buffer,
    filename?: string
  ): Promise<boolean> {
    if (!isValidId(id)) return false;
    const doc = await this.getDocument(id);
    if (!doc) return false;

    await this.ensureDirs();
    // A page edit interrupted earlier must not later swap its PDF over this new file.
    await this.recoverPageEdit(id);
    const source = filename || doc.filename;
    await writeFileAtomic(path.join(this.originalsDir, `${id}${safeExtension(source)}`), original);
    await this.write({ ...doc, filename: source, originalBytes: original.length });
    return true;
  }

  editPdfPages<T>(
    id: string,
    edit: (input: PdfPageEditInput) => Promise<PdfPageEditOutput<T>>
  ): Promise<T | null> {
    if (!isValidId(id)) return Promise.resolve(null);
    return this.withLock(id, () => this.editPdfPagesLocked(id, edit));
  }

  /**
   * The order is what keeps the PDF and its marks a matching pair through a crash:
   *
   *   1. the old PDF is kept as `{id}.prev` (one step of undo),
   *   2. the edited PDF is written and fsynced as `{id}.next`,
   *   3. the record is committed with the renumbered marks and `pendingOriginal` — the commit point,
   *   4. `{id}.next` is renamed over the original, last,
   *   5. the flag is cleared.
   *
   * A crash before 3 leaves the old pair (the stray `.next` is discarded); a crash after it leaves
   * the new marks with a flag that tells `recoverPageEdit` to finish step 4.
   */
  private async editPdfPagesLocked<T>(
    id: string,
    edit: (input: PdfPageEditInput) => Promise<PdfPageEditOutput<T>>
  ): Promise<T | null> {
    await this.recoverPageEdit(id);
    const doc = await this.getDocument(id);
    const originalPath = await this.findOriginalPath(id);
    if (!doc || !originalPath) return null;

    const current = await fs.readFile(originalPath);
    const { pdf, annotations, result } = await edit({
      pdf: current,
      filename: doc.filename,
      annotations: doc.annotations
    });

    const next = path.join(this.originalsDir, `${id}.next`);
    await writeFileAtomic(path.join(this.originalsDir, `${id}.prev`), current);
    await writeDurable(next, pdf);
    const committed: StoredDocument = {
      ...this.applyUpdate(doc, { annotations }),
      originalBytes: pdf.length,
      pendingOriginal: true
    };
    await this.write(committed);
    await fs.rename(next, originalPath);
    const { pendingOriginal: _pending, ...settled } = committed;
    await this.write(settled);
    return result;
  }

  /**
   * Finishes or undoes a page edit a crash interrupted. Must run inside the document's lock.
   * Flag set: the marks are already renumbered, so the waiting PDF goes into place. No flag: the
   * record was never committed, so the waiting PDF is thrown away.
   */
  private async recoverPageEdit(id: string): Promise<void> {
    const next = path.join(this.originalsDir, `${id}.next`);
    const hasNext = existsSync(next);
    const doc = await this.getDocument(id);
    if (!doc?.pendingOriginal) {
      if (hasNext) {
        await fs.rm(next, { force: true });
        console.warn(`[Marginalia] discarded an unfinished page edit on ${id}; its marks were never changed`);
      }
      return;
    }
    if (hasNext) {
      const target =
        (await this.findOriginalPath(id)) ?? path.join(this.originalsDir, `${id}${safeExtension(doc.filename)}`);
      await fs.rename(next, target);
      console.warn(`[Marginalia] finished an interrupted page edit on ${id}`);
    }
    const { pendingOriginal: _pending, ...settled } = doc;
    await this.write(settled);
  }

  /**
   * Reads one document, filling in fields that records written by older versions of the app
   * predate. Without this backfill an existing library would come back with `annotations`
   * undefined and crash the viewer the first time it tried to draw them.
   */
  async getDocument(id: string): Promise<StoredDocument | null> {
    if (!isValidId(id)) return null;
    const raw = await this.readRecord(id);
    if (!raw) return null;
    {
      const annotations = Array.isArray(raw.annotations) ? raw.annotations : [];
      return {
        id,
        title: raw.title || 'Untitled Document',
        format: raw.format || 'TXT',
        filename: raw.filename || `${raw.title || 'document'}.txt`,
        wordCount: typeof raw.wordCount === 'number' ? raw.wordCount : countWords(raw.text || ''),
        originalBytes: raw.originalBytes || 0,
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
        expiresAt: raw.expiresAt ?? null,
        annotationCount: annotations.length,
        // Records written before theme tagging existed have no field; an absent one is simply
        // "nothing tagged yet" rather than an error. Recomputed rather than trusted from disk in
        // case an older record's cached value has drifted from its own annotations.
        themeIds: computeThemeIds(annotations),
        themeCounts: computeThemeCounts(annotations),
        terminologyCount: countTerminology(annotations),
        text: raw.text || '',
        annotations,
        readingState: raw.readingState ?? null,
        // Absent on every record written before analyses were saved, which is most of them.
        analysis: raw.analysis ?? null,
        annotationsBackup: raw.annotationsBackup ?? null,
        ...(raw.pendingOriginal === true && { pendingOriginal: true as const })
      };
    }
  }

  /**
   * Reads `{id}.json`, falling back to `{id}.json.bak`.
   *
   * A record that does not parse used to make the document silently vanish. Now it is logged and
   * moved aside to `{id}.json.corrupt-<time>` (never deleted or overwritten), and the backup answers instead. A read
   * error that is not corruption (permissions, I/O) is logged and left alone.
   */
  private async readRecord(id: string): Promise<Partial<StoredDocument> | null> {
    const target = this.docPath(id);
    try {
      return parseRecord(await fs.readFile(target, 'utf-8'));
    } catch (err) {
      if (err instanceof SyntaxError) {
        const quarantine = `${target}.corrupt-${Date.now()}`;
        console.error(`[Marginalia] record ${id} is corrupt; moving it to ${path.basename(quarantine)}`, err);
        await fs.rename(target, quarantine).catch(() => undefined);
      } else if (errorCode(err) !== 'ENOENT') {
        console.error(`[Marginalia] record ${id} could not be read`, err);
        return null;
      }
    }
    try {
      const backup = parseRecord(await fs.readFile(`${target}.bak`, 'utf-8'));
      console.warn(`[Marginalia] record ${id} served from its backup ${id}.json.bak`);
      return backup;
    } catch (err) {
      if (errorCode(err) !== 'ENOENT') console.error(`[Marginalia] backup of record ${id} is unusable`, err);
      return null;
    }
  }

  getOriginal(id: string): Promise<{ buffer: Buffer; filename: string } | null> {
    if (!isValidId(id)) return Promise.resolve(null);
    return this.withLock(id, async () => {
      await this.recoverPageEdit(id);
      return this.readOriginal(id);
    });
  }

  private async readOriginal(id: string): Promise<{ buffer: Buffer; filename: string } | null> {
    const filePath = await this.findOriginalPath(id);
    if (!filePath) return null;
    try {
      const doc = await this.getDocument(id);
      return { buffer: await fs.readFile(filePath), filename: doc?.filename || path.basename(filePath) };
    } catch {
      return null;
    }
  }

  async listDocuments(): Promise<DocumentMeta[]> {
    await this.ensureDirs();
    // A record whose .json is gone or quarantined but whose .bak survives is still listed.
    const ids = new Set<string>();
    for (const entry of await fs.readdir(this.docsDir)) {
      const match = /^(.+)\.json(\.bak)?$/.exec(entry);
      if (match) ids.add(match[1]);
    }
    const metas: DocumentMeta[] = [];
    for (const id of ids) {
      const doc = await this.getDocument(id);
      if (!doc) continue;
      const { text, annotations, analysis, annotationsBackup, pendingOriginal, ...rest } = doc;
      metas.push({ ...rest, analysis: summarizeAnalysis(analysis) });
    }
    return metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  updateDocument(id: string, params: UpdateDocumentParams): Promise<DocumentMeta | null> {
    return this.withLock(id, () => this.updateDocumentLocked(id, params));
  }

  private async updateDocumentLocked(
    id: string,
    params: UpdateDocumentParams
  ): Promise<DocumentMeta | null> {
    const doc = await this.getDocument(id);
    if (!doc) return null;
    const updated = this.applyUpdate(doc, params);
    await this.write(updated);

    const { text, annotations: _a, analysis, annotationsBackup: _b, pendingOriginal: _p, ...rest } = updated;
    return { ...rest, analysis: summarizeAnalysis(analysis) };
  }

  /** The record after `params` is applied, including the shrink backup. Pure; writes nothing. */
  private applyUpdate(doc: StoredDocument, params: UpdateDocumentParams): StoredDocument {
    const annotations = params.restoreAnnotationsBackup
      ? doc.annotationsBackup?.annotations ?? doc.annotations
      : params.annotations ?? doc.annotations;

    /**
     * Keep the set we are about to replace, whenever the replacement is smaller.
     *
     * Deleting a mark shrinks it legitimately, so this is not an error — but a stale overwrite
     * looks exactly the same from here, and only one of the two is recoverable. Holding the
     * previous set costs one copy and makes both recoverable. Never overwritten by a growing
     * write, so the backup always describes the last time marks went missing.
     */
    const shrinks = params.annotations !== undefined && annotations.length < doc.annotations.length;
    // A held backup is only replaced by a bigger one. Otherwise a reader who loses thirty marks
    // to a bad write and then deletes one of the two survivors — before noticing anything is
    // wrong — would trade the recoverable thirty for an unrecoverable two.
    const worthKeeping =
      shrinks && doc.annotations.length >= (doc.annotationsBackup?.wasCount ?? 0);
    const annotationsBackup = worthKeeping
      ? {
          annotations: doc.annotations,
          savedAt: new Date().toISOString(),
          wasCount: doc.annotations.length
        }
      : doc.annotationsBackup;
    // A reading-position-only update (scale/page/view mode, saved every few seconds while
    // scrolling) must not bump `updatedAt` — that field drives the library's "recent activity"
    // sort, and merely reading a book is not the activity it means to track.
    const changesActivity =
      params.title !== undefined ||
      params.annotations !== undefined ||
      params.restoreAnnotationsBackup === true;
    return {
      ...doc,
      title: params.title?.trim() ? params.title.trim() : doc.title,
      annotations,
      annotationCount: annotations.length,
      themeIds: computeThemeIds(annotations),
      themeCounts: computeThemeCounts(annotations),
      terminologyCount: countTerminology(annotations),
      readingState: params.readingState ?? doc.readingState,
      analysis: params.analysis ?? doc.analysis,
      annotationsBackup,
      updatedAt: changesActivity ? new Date().toISOString() : doc.updatedAt
    };
  }

  /**
   * Removes a document from disk permanently — both its record and its original file. There is
   * no trash and no tombstone: the library's delete button is meant to actually erase the file
   * from the user's machine, so this unlinks rather than marking anything hidden.
   */
  async deleteDocument(id: string): Promise<boolean> {
    if (!isValidId(id)) return false;
    let deleted = false;
    const unlink = async (file: string) => {
      try {
        await fs.unlink(file);
        deleted = true;
      } catch {
        /* already gone */
      }
    };
    const record = this.docPath(id);
    for (const file of [record, `${record}.bak`]) await unlink(file);
    // Every quarantined copy (`.corrupt`, `.corrupt-<time>`).
    const corrupt = (await fs.readdir(this.docsDir).catch(() => [] as string[])).filter((n) => n.startsWith(`${id}.json.corrupt`));
    for (const name of corrupt) await unlink(path.join(this.docsDir, name));
    const original = await this.findOriginalPath(id);
    if (original) await unlink(original);
    for (const suffix of ['prev', 'next']) await unlink(path.join(this.originalsDir, `${id}.${suffix}`));
    return deleted;
  }

  async sweepExpiredDocuments(): Promise<number> {
    if (!existsSync(this.docsDir)) return 0;
    const now = Date.now();
    let removed = 0;

    const docs = await this.listDocuments();
    for (const meta of docs) {
      // A null `expiresAt` means retention is off for this document and it is kept until the
      // user deletes it themselves.
      if (meta.expiresAt && new Date(meta.expiresAt).getTime() <= now) {
        await this.deleteDocument(meta.id);
        removed++;
      }
    }

    // Remove originals whose record is entirely gone, so a delete interrupted halfway through
    // can't leave the originals directory growing invisibly. ANY file for the id in documents/
    // (.json, .json.bak, .json.corrupt) keeps its original: a record that failed to parse is not
    // a deleted document, and its original may be the only copy left.
    const liveIds = new Set((await fs.readdir(this.docsDir)).map((name) => name.split('.')[0]));
    try {
      for (const name of await fs.readdir(this.originalsDir)) {
        if (!liveIds.has(name.split('.')[0])) {
          await fs.unlink(path.join(this.originalsDir, name)).catch(() => {});
        }
      }
    } catch {
      /* originals dir may not exist yet */
    }

    return removed;
  }

  async getSettings(): Promise<Record<string, unknown> | null> {
    try {
      const raw = await fs.readFile(this.settingsPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Merges `patch` into the stored settings under the settings lock (the `/gemini-config` writer). */
  saveSettings(patch: Record<string, unknown>): Promise<void> {
    return this.withLock(SETTINGS_LOCK, async () => {
      await this.writeSettings({ ...(await this.readSettingsForMerge()), ...patch });
    });
  }

  /**
   * The client's settings PUT. It used to replace the whole file, and the client's copy is a
   * snapshot from launch — so a Gemini key saved since then through `/gemini-config` was wiped
   * by the next theme change. Merging into what is stored, and never taking `gemini*` from here,
   * leaves the key to the one route that is meant to change it.
   */
  saveClientSettings(incoming: Record<string, unknown>): Promise<void> {
    return this.withLock(SETTINGS_LOCK, async () => {
      const next = await this.readSettingsForMerge();
      for (const [key, value] of Object.entries(incoming)) {
        if (!isGeminiKey(key)) next[key] = value;
      }
      await this.writeSettings(next);
    });
  }

  /** `{}` when there is no file; a corrupt file is copied to `settings.json.bad-<time>` first. */
  private async readSettingsForMerge(): Promise<Record<string, unknown>> {
    let raw: string;
    try {
      raw = await fs.readFile(this.settingsPath, 'utf-8');
    } catch (err) {
      if (errorCode(err) === 'ENOENT') return {};
      throw err; // unreadable is not empty: writing from {} would drop the stored key
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      /* handled below */
    }
    // Timestamped, so a second corruption never overwrites the first copy.
    const backup = `${this.settingsPath}.bad-${Date.now()}`;
    await fs.copyFile(this.settingsPath, backup);
    console.error(`[Marginalia] settings.json was corrupt; kept a copy as ${path.basename(backup)}`);
    return {};
  }

  private async writeSettings(settings: Record<string, unknown>): Promise<void> {
    await fs.mkdir(this.location, { recursive: true });
    await writeFileAtomic(this.settingsPath, JSON.stringify(settings));
  }
}
