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
  SaveDocumentParams,
  StoredDocument,
  UpdateDocumentParams,
  buildMeta,
  computeThemeCounts,
  computeThemeIds,
  countTerminology,
  countWords,
  isValidId,
  safeExtension,
  summarizeAnalysis
} from './types';

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
      const match = entries.find((name) => name.startsWith(`${id}.`) || name === id);
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
   */
  private async write(doc: StoredDocument): Promise<void> {
    const target = this.docPath(doc.id);
    const temporary = `${target}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(doc), 'utf-8');
    await fs.rename(temporary, target);
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
    const source = filename || doc.filename;
    await fs.writeFile(path.join(this.originalsDir, `${id}${safeExtension(source)}`), original);
    await this.write({ ...doc, filename: source, originalBytes: original.length });
    return true;
  }

  /**
   * Reads one document, filling in fields that records written by older versions of the app
   * predate. Without this backfill an existing library would come back with `annotations`
   * undefined and crash the viewer the first time it tried to draw them.
   */
  async getDocument(id: string): Promise<StoredDocument | null> {
    if (!isValidId(id)) return null;
    try {
      const raw = JSON.parse(await fs.readFile(this.docPath(id), 'utf-8')) as Partial<StoredDocument>;
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
        annotationsBackup: raw.annotationsBackup ?? null
      };
    } catch {
      return null;
    }
  }

  async getOriginal(id: string): Promise<{ buffer: Buffer; filename: string } | null> {
    if (!isValidId(id)) return null;
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
    const entries = await fs.readdir(this.docsDir);
    const metas: DocumentMeta[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const doc = await this.getDocument(entry.replace(/\.json$/, ''));
      if (!doc) continue;
      const { text, annotations, analysis, annotationsBackup, ...rest } = doc;
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
    const updated: StoredDocument = {
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
    await this.write(updated);

    const { text, annotations: _a, analysis, annotationsBackup: _b, ...rest } = updated;
    return { ...rest, analysis: summarizeAnalysis(analysis) };
  }

  /**
   * Removes a document from disk permanently — both its record and its original file. There is
   * no trash and no tombstone: the library's delete button is meant to actually erase the file
   * from the user's machine, so this unlinks rather than marking anything hidden.
   */
  async deleteDocument(id: string): Promise<boolean> {
    if (!isValidId(id)) return false;
    let deleted = false;
    try {
      await fs.unlink(this.docPath(id));
      deleted = true;
    } catch {
      /* already gone */
    }
    const original = await this.findOriginalPath(id);
    if (original) {
      try {
        await fs.unlink(original);
        deleted = true;
      } catch {
        /* already gone */
      }
    }
    return deleted;
  }

  async sweepExpiredDocuments(): Promise<number> {
    if (!existsSync(this.docsDir)) return 0;
    const now = Date.now();
    let removed = 0;

    const docs = await this.listDocuments();
    const liveIds = new Set<string>();
    for (const meta of docs) {
      // A null `expiresAt` means retention is off for this document and it is kept until the
      // user deletes it themselves.
      if (meta.expiresAt && new Date(meta.expiresAt).getTime() <= now) {
        await this.deleteDocument(meta.id);
        removed++;
      } else {
        liveIds.add(meta.id);
      }
    }

    // Remove originals whose metadata file is already gone, so a delete interrupted halfway
    // through can't leave the originals directory growing invisibly.
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

  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    await fs.mkdir(this.location, { recursive: true });
    await fs.writeFile(this.settingsPath, JSON.stringify(settings), 'utf-8');
  }
}
