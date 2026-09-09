/**
 * Runs one thematic analysis and holds its lifecycle.
 *
 * Two sources, one result shape. `analyzeDocument` reads the copy of the book in the library;
 * `analyzeBookFromWeb` reads what the open web says about a book by name, for something the
 * reader does not have. They share state deliberately — only one analysis is on screen at a time,
 * and starting either one replaces whatever the other left there.
 *
 * The last request is remembered so `retry` can repeat it. That is the whole reason failures are
 * worth modelling here rather than as a string: a rate limit or an overloaded model clears by
 * itself, and the reader should be one button from trying again rather than re-choosing a book
 * and retyping a title.
 *
 * The result is NOT cached or persisted: a run costs tokens and a minute of the reader's time, so
 * it is kept for as long as the panel is open and no longer. Persisting it would mean deciding
 * when a stored analysis has gone stale against an edited, re-paginated document, which is a
 * bigger question than the panel needs answered.
 */

import { useCallback, useRef, useState } from 'react';
import { fetchSavedAnalysis } from '../utils/documentStorage';
import { ThematicAnalysisResult } from '../types';

/** Which reading produced the analysis on screen, so the panel can say so rather than implying
 *  a web summary was drawn from the reader's own copy. */
export type AnalysisSource = 'document' | 'web';

export interface AnalysisError {
  message: string;
  /** True when the same request could plausibly succeed later — the dialog then offers Retry. */
  retryable: boolean;
}

export function useThematicAnalysis() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ThematicAnalysisResult | null>(null);
  const [source, setSource] = useState<AnalysisSource | null>(null);
  const [error, setError] = useState<AnalysisError | null>(null);
  /** When the analysis on screen was produced, if it came off disk rather than from this run. */
  const [analysedAt, setAnalysedAt] = useState<string | null>(null);
  /** The last request, kept so `retry` can repeat it verbatim. */
  const lastRun = useRef<(() => Promise<void>) | null>(null);

  const run = useCallback(async (from: AnalysisSource, url: string, init?: RequestInit) => {
    const perform = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(url, { method: 'POST', ...init });
        const result = await response.json().catch(() => null);
        if (response.ok && result?.success) {
          setAnalysis(result.data as ThematicAnalysisResult);
          setSource(from);
          setAnalysedAt(new Date().toISOString());
        } else {
          setError({
            message:
              result?.message ??
              result?.error ??
              `The server answered with ${response.status} and nothing this app could read.`,
            // Absent flag means an unclassified failure: offering Retry costs a button press and
            // is right more often than it is wrong.
            retryable: result?.retryable ?? true
          });
        }
      } catch {
        // Never the analysis itself — this is Marginalia's own server, on this machine.
        setError({
          message: 'Could not reach Marginalia’s local server. Restarting the app should fix it.',
          retryable: true
        });
      } finally {
        setLoading(false);
      }
    };
    lastRun.current = perform;
    await perform();
  }, []);

  /**
   * Shows the analysis already saved for a document, without spending anything.
   *
   * Called when a document is chosen rather than when the button is pressed, so the panel opens
   * on what was found last time. Silent when there is nothing saved — that is the ordinary case
   * for a book nobody has analysed, not a failure worth a dialog.
   */
  const [loadingSaved, setLoadingSaved] = useState(false);
  const loadSavedAnalysis = useCallback(async (docId: string) => {
    setLoadingSaved(true);
    const saved = await fetchSavedAnalysis(docId);
    setLoadingSaved(false);
    if (!saved) return false;
    setAnalysis(saved.data);
    setSource('document');
    setAnalysedAt(saved.analysedAt);
    setError(null);
    return true;
  }, []);

  /** Drops whatever is on screen, so choosing a different book does not show the last one's. */
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setSource(null);
    setAnalysedAt(null);
  }, []);

  const analyzeDocument = useCallback(
    (docId: string) => run('document', `/api/documents/${docId}/analysis`),
    [run]
  );

  const analyzeBookFromWeb = useCallback(
    (title: string, author: string, edition: string) =>
      run('web', '/api/analyze-from-web', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author, edition })
      }),
    [run]
  );

  const retry = useCallback(() => {
    void lastRun.current?.();
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    analyzeDocument,
    analyzeBookFromWeb,
    loadSavedAnalysis,
    clearAnalysis,
    retry,
    dismissError,
    loading,
    loadingSaved,
    analysis,
    analysedAt,
    source,
    error
  };
}
