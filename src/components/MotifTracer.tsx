/**
 * Cross-text motif tracing: follow an image or idea (the moon, the beloved's lane, wine) across
 * every document in My Collections, or the ones picked. A motif is a name and the words that
 * stand for it; saved motifs live in the settings. Each passage found opens its document at that
 * place with the motif's words painted (`ReaderJump`). The trace exports as Markdown for an essay.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Loader2, MotifPath, Trash2, X } from './icons';
import type { Motif, ReaderJump, UserSettings } from '../types';
import { listStoredDocuments, traceMotif, type MotifTraceResponse, type StoredDocumentMeta } from '../utils/documentStorage';
import { cleanTerms, traceMarkdown } from '../utils/motifTrace';
import { downloadTextFile } from '../utils/exportAnnotations';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { plural } from '../utils/plural';
import { fileStem } from './marksArchiveFormat';

const EASE = [0.16, 1, 0.3, 1] as const;

/** "moon, crescent; چاند" → terms. Commas, semicolons, Urdu commas or new lines separate them. */
const splitTerms = (s: string) => cleanTerms(s.split(/[,;،\n]+/));

/** The snippet with each traced word picked out. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  const parts = useMemo(() => {
    const words = terms.map((t) => t.toLowerCase());
    const out: { s: string; on: boolean }[] = [];
    const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu');
    for (const piece of text.split(re)) if (piece) out.push({ s: piece, on: words.includes(piece.toLowerCase()) });
    return out;
  }, [text, terms]);
  return (
    <>
      {parts.map((p, i) =>
        p.on ? (
          <mark key={i} className="bg-violet-500/20 dark:bg-violet-400/30 text-inherit rounded-sm px-0.5">
            {p.s}
          </mark>
        ) : (
          <React.Fragment key={i}>{p.s}</React.Fragment>
        )
      )}
    </>
  );
}

export const MotifTracer: React.FC<{
  open: boolean;
  onClose: () => void;
  isDark: boolean;
  settings: UserSettings;
  onUpdateSettings: (update: (prev: UserSettings) => UserSettings) => void;
  onOpen: (meta: StoredDocumentMeta, jump: ReaderJump) => void;
}> = ({ open, onClose, isDark, settings, onUpdateSettings, onOpen }) => {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, open, onClose);
  const [name, setName] = useState('');
  const [termText, setTermText] = useState('');
  const [docs, setDocs] = useState<StoredDocumentMeta[]>([]);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [result, setResult] = useState<MotifTraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const motifs = settings.motifs ?? [];

  useEffect(() => {
    if (!open) return;
    void listStoredDocuments().then(setDocs);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus());
  }, [open]);

  const terms = splitTerms(termText);
  const label = name.trim() || terms.join(', ');

  const run = async (t = terms) => {
    if (!t.length) return;
    setBusy(true);
    setError(null);
    const r = await traceMotif(t, picked ? [...picked] : undefined);
    setBusy(false);
    if ('error' in r) {
      setResult(null);
      setError(r.error);
    } else setResult(r);
  };

  const save = () => {
    if (!terms.length) return;
    const motif: Motif = { id: `mo-${Date.now().toString(36)}`, name: label, terms };
    onUpdateSettings((prev) => {
      const list = prev.motifs ?? [];
      const same = list.find((m) => m.name.toLowerCase() === motif.name.toLowerCase());
      return { ...prev, motifs: same ? list.map((m) => (m === same ? { ...same, terms } : m)) : [...list, motif] };
    });
  };

  const pickMotif = (m: Motif) => {
    setName(m.name);
    setTermText(m.terms.join(', '));
    void run(m.terms);
  };

  const field = `w-full px-3 py-2 rounded-xl border text-[13px] focus:outline-none focus:ring-1 focus:ring-gold ${
    isDark ? 'bg-night-2 border-stone-700 text-paper placeholder:text-paper/50' : 'bg-white border-stone-300 text-stone-900 placeholder:text-muted'
  }`;
  const byId = new Map(docs.map((d) => [d.id, d]));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center px-3 py-6 bg-black/50 backdrop-blur-xs overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="motif-title"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.24, ease: EASE }}
            className={`ink-card w-full max-w-2xl rounded-3xl p-5 shadow-2xl border space-y-4 ${
              isDark ? 'bg-night-3 border-stone-700 text-paper' : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-gold/10 text-gold">
                <MotifPath className="w-4.5 h-4.5" />
              </span>
              <div className="flex-1 min-w-0">
                <h2 id="motif-title" className="title-hand text-[28px] leading-tight">Trace a motif</h2>
                <p className="text-[12.5px] text-muted leading-snug">
                  Follow an image or idea through a poet’s whole collection. Give it the words that carry it; plurals are found too.
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 -mr-1 -mt-1 rounded-full flex items-center justify-center text-muted hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {motifs.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Saved motifs">
                {motifs.map((m) => (
                  <span key={m.id} className={`inline-flex items-center rounded-full border text-[12px] ${isDark ? 'border-stone-700' : 'border-stone-300'}`}>
                    <button type="button" onClick={() => pickMotif(m)} className="pl-3 pr-1.5 py-1 cursor-pointer hover:text-gold" title={m.terms.join(', ')}>
                      {m.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings((prev) => ({ ...prev, motifs: (prev.motifs ?? []).filter((x) => x.id !== m.id) }))}
                      aria-label={`Forget the motif ${m.name}`}
                      className="pr-2 pl-0.5 py-1 text-muted hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <form
              className="grid sm:grid-cols-[10rem_1fr_auto] gap-2 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void run();
              }}
            >
              <label className="text-[12px] text-muted">
                Motif
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="The moon" dir="auto" className={`${field} mt-1`} />
              </label>
              <label className="text-[12px] text-muted">
                Words that carry it
                <input
                  value={termText}
                  onChange={(e) => setTermText(e.target.value)}
                  placeholder="moon, crescent, چاند, ماہ"
                  dir="auto"
                  className={`${field} mt-1`}
                  data-autofocus
                />
              </label>
              <div className="flex gap-1.5">
                <button type="submit" disabled={!terms.length || busy} className="px-4 py-2 rounded-full caps text-[12px] bg-accent hover:bg-accent-hover text-on-accent cursor-pointer disabled:opacity-40">
                  Trace
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!terms.length}
                  title="Keep this motif to trace again"
                  className={`px-3 py-2 rounded-full caps text-[12px] border cursor-pointer disabled:opacity-40 ${isDark ? 'border-stone-700' : 'border-stone-300'}`}
                >
                  Save
                </button>
              </div>
            </form>

            <details className="text-[12.5px]">
              <summary className="cursor-pointer text-muted">
                {picked ? `In ${plural(picked.size, 'chosen document')}` : 'In every document in My Collections'}
              </summary>
              <div className="mt-2 flex items-center gap-3 text-[12px]">
                <button type="button" className="underline cursor-pointer" onClick={() => setPicked(null)}>All</button>
                <button type="button" className="underline cursor-pointer" onClick={() => setPicked(new Set())}>None</button>
              </div>
              <ul className="mt-1.5 max-h-40 overflow-y-auto grid sm:grid-cols-2 gap-x-4 gap-y-1">
                {docs.map((d) => (
                  <li key={d.id}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!picked || picked.has(d.id)}
                        onChange={(e) => {
                          const next = new Set(picked ?? docs.map((x) => x.id));
                          if (e.target.checked) next.add(d.id);
                          else next.delete(d.id);
                          setPicked(next.size === docs.length ? null : next);
                        }}
                        className="accent-[var(--color-accent)]"
                      />
                      <span dir="auto" className="truncate">{d.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>

            <div aria-live="polite" className="min-h-6">
              {busy && (
                <p className="flex items-center gap-2 text-[12.5px] text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" /> Reading your collections…
                </p>
              )}
              {error && <p className="text-[12.5px] text-red-700 dark:text-red-400">{error}</p>}
              {result && !busy && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px]">
                      {result.total === 0
                        ? 'Not found in any document.'
                        : `${plural(result.total, 'passage')} in ${plural(result.results.length, 'document')}${result.truncated ? ' (the first 300 per document)' : ''}.`}
                    </p>
                    {result.total > 0 && (
                      <button
                        type="button"
                        onClick={() => downloadTextFile(traceMarkdown(label, terms, result.results), `${fileStem(label)} motif trace.md`, 'text/markdown')}
                        className="flex items-center gap-1.5 rounded-full caps caps-sm px-3 py-1.5 border border-stone-300 dark:border-stone-600 hover:border-gold hover:bg-gold/10 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Save .md
                      </button>
                    )}
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
                    {result.results.map((r) => (
                      <section key={r.id}>
                        <h3 dir="auto" className="title-hand text-[21px] leading-tight">
                          {r.title} <span className="font-sans text-[11px] text-muted">· {plural(r.hits.length, 'passage')}</span>
                        </h3>
                        <ul className="mt-1 space-y-1">
                          {r.hits.map((h, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                disabled={!byId.has(r.id)}
                                onClick={() => {
                                  const meta = byId.get(r.id);
                                  if (!meta) return;
                                  onClose();
                                  onOpen(meta, { paragraphIndex: h.paragraphIndex, terms, label });
                                }}
                                className={`w-full text-left flex gap-3 px-3 py-2 rounded-xl text-[12.5px] leading-snug cursor-pointer transition-colors ${
                                  isDark ? 'hover:bg-night-2' : 'hover:bg-stone-100'
                                }`}
                              >
                                <span className="shrink-0 w-14 text-[11px] text-muted pt-0.5">
                                  {r.location === 'page' ? `p. ${h.paragraphIndex + 1}` : `¶ ${h.paragraphIndex + 1}`}
                                </span>
                                <span dir="auto" className="flex-1">
                                  <Marked text={h.snippet} terms={[h.match]} />
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
