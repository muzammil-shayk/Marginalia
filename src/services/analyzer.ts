/**
 * Thematic analysis of a document in the library, run through Gemini.
 *
 * This is the one place in Marginalia that sends anything off the machine, and it only happens
 * when the reader presses the button. What gets sent depends on what the document is: a PDF goes
 * up whole, because that is the only way a scanned book — pages that are images with no
 * extractable text — can be read at all, while a document that was already parsed to text on
 * upload sends that text and skips the upload entirely. Either way the run is disposable: any
 * uploaded copy is deleted in `finally`, whether the analysis succeeded or not.
 */

import { Router } from 'express';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import {
  GoogleGenAI,
  Type,
  createPartFromUri,
  createUserContent,
  type PartUnion
} from '@google/genai';
import { getDocument, getOriginal, getSettings, saveSettings, updateDocument } from './documentStore';
import type { ThemeItem, ThematicAnalysisResult } from '../types';

const router = Router();

/**
 * Overridable so a newer Flash model can be adopted by editing `.env` rather than this file —
 * Google ships them faster than an app like this gets released, and retires them just as fast:
 * `gemini-2.5-flash` is already refused for keys created after its retirement. The default is the
 * moving `-latest` alias for exactly that reason. Pin a specific one in `.env` if you want to.
 * See what a key can actually reach with:
 *   curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
 */
const DEFAULT_MODEL = 'gemini-flash-latest';

/**
 * Created on first use, not at import time. The server must start and serve the library whether
 * or not a key is configured — analysis is the only feature that needs one, and a missing key
 * should fail that one request with an explanation rather than take the whole app down.
 */
/** Thrown when no key has been provided, so `describeError` can say something useful about it. */
const NO_KEY = 'MARGINALIA_NO_API_KEY';

/**
 * Where the API key comes from.
 *
 * The app's own settings first, then `GEMINI_API_KEY` in the environment. Settings has to come
 * first because a packaged build has no `.env` to read and no way for the reader to add one — the
 * files are inside an asar archive. Without this, thematic analysis could not work in any shipped
 * copy of the app, which is exactly what happened to 2.0.0.
 *
 * The key is read fresh rather than captured at startup, so pasting one into Settings takes
 * effect on the next press of the button instead of after a restart.
 */
export async function geminiCredentials(): Promise<{ apiKey: string | null; model: string }> {
  const stored = (await getSettings()) ?? {};
  const fromSettings = typeof stored.geminiApiKey === 'string' ? stored.geminiApiKey.trim() : '';
  const storedModel = typeof stored.geminiModel === 'string' ? stored.geminiModel.trim() : '';
  return {
    apiKey: fromSettings || process.env.GEMINI_API_KEY?.trim() || null,
    model: storedModel || process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
  };
}

/** Rebuilt only when the key changes, so a paste in Settings is picked up without a restart. */
let client: GoogleGenAI | null = null;
let clientKey: string | null = null;

async function getClient(): Promise<GoogleGenAI> {
  const { apiKey } = await geminiCredentials();
  if (!apiKey) throw new Error(NO_KEY);
  if (!client || clientKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

/**
 * The response shape, declared to the model rather than hoped for. `prominence` is an enum, not a
 * described string: it maps onto a TypeScript union the panel switches on, so a fourth value
 * invented by the model has to be rejected here instead of leaking into the UI as an unstyled tag.
 */
const PROMINENCE_VALUES: ThemeItem['prominence'][] = ['Primary', 'Secondary', 'Recurring Motif'];

const thematicAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    bookTitle: { type: Type.STRING },
    executiveSummary: {
      type: Type.STRING,
      description: 'A concise 150-250 word analytical abstract of the work.'
    },
    themes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          themeName: { type: Type.STRING },
          description: { type: Type.STRING },
          prominence: { type: Type.STRING, enum: ['Primary', 'Secondary', 'Recurring Motif'] },
          evidence: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Specific passages, narrative events or concrete instances from the text.'
          }
        },
        required: ['themeName', 'description', 'prominence', 'evidence']
      }
    },
    narrativeArc: {
      type: Type.STRING,
      description: 'How the themes develop and interact across the structure of the work.'
    }
  },
  required: ['bookTitle', 'executiveSummary', 'themes', 'narrativeArc']
};

const PROMPT = `Perform a rigorous literary analysis of this document.
- Identify its major recurring conflicts, conceptual anchors and underlying motifs.
- Support every theme with concrete context or events drawn from the text itself.
- Judge each theme's prominence honestly: most works have only one or two primary themes.
Return only the requested structured payload.`;

/** How long to wait for Gemini to finish ingesting the PDF before giving up. A long book takes
 *  well over a minute; an upload wedged in PROCESSING forever should not hold the socket open. */
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * What the reader is told when a run fails, and whether pressing the button again is worth it.
 *
 * Gemini reports failures as a JSON blob inside an exception message — a status name, a numeric
 * code, and a paragraph written for whoever wired up the API rather than for someone who just
 * wanted to know about a book. Every one of those needs a different response from the reader:
 * waiting, fixing a key, or nothing at all. Showing them the raw blob asks them to work out which.
 *
 * `retryable` is the useful half. A quota ceiling or an overloaded model clears on its own, so the
 * dialog offers Retry; a revoked key or a retired model will fail identically forever, so it does
 * not, and the message says what to actually change instead.
 */
export interface AnalysisFailure {
  message: string;
  retryable: boolean;
  /** Mirrored to the HTTP response so the client is not parsing prose to decide what happened. */
  status: number;
}

function describeError(error: unknown): AnalysisFailure {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw === NO_KEY) {
    return {
      status: 400,
      retryable: false,
      message:
        'No Gemini API key is set. Open Settings and paste one into AI Analysis — you can create a free key at aistudio.google.com/apikey. Nothing is sent anywhere until you do.'
    };
  }
  const code = Number(/"code":\s*(\d{3})/.exec(raw)?.[1] ?? 0);
  const has = (needle: string) => raw.toUpperCase().includes(needle);

  if (code === 429 || has('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      retryable: true,
      message:
        'This API key has hit its rate limit. Free-tier keys allow only a few requests a minute, and Google Search grounding has its own much smaller daily allowance — so a web lookup can run out while analysing your own documents still works. Wait a minute and try again, or check your limits at ai.dev/rate-limit.'
    };
  }
  if (code === 503 || has('UNAVAILABLE') || has('OVERLOADED')) {
    return {
      status: 503,
      retryable: true,
      message:
        'Gemini is overloaded right now and turned the request away. Nothing is wrong with your document or your key — this clears on its own, usually within a minute.'
    };
  }
  if (code === 504 || has('DEADLINE_EXCEEDED')) {
    return {
      status: 504,
      retryable: true,
      message: 'Gemini took too long to answer. Long or heavily scanned books time out more often.'
    };
  }
  if (code === 500 || has('INTERNAL')) {
    return {
      status: 502,
      retryable: true,
      message: 'Gemini failed on its own end. Trying again usually works.'
    };
  }
  if (code === 401 || code === 403 || has('UNAUTHENTICATED') || has('PERMISSION_DENIED')) {
    return {
      status: 401,
      retryable: false,
      message:
        'Gemini rejected the API key. It may be expired, revoked, or missing. Create a new one at aistudio.google.com/apikey and set GEMINI_API_KEY in your .env file, then restart Marginalia.'
    };
  }
  if (code === 404 || has('NOT_FOUND')) {
    return {
      status: 404,
      retryable: false,
      message:
        'Gemini does not offer this model to your key — Google retires models fairly often. Choose a different one in Settings under AI Analysis.'
    };
  }
  if (code === 400 || has('INVALID_ARGUMENT')) {
    return {
      status: 400,
      retryable: false,
      message:
        'Gemini refused the request as malformed. If this is a PDF, it may be encrypted or past the 1,000-page limit.'
    };
  }
  if (has('FETCH FAILED') || has('ENOTFOUND') || has('ECONNREFUSED') || has('ETIMEDOUT')) {
    return {
      status: 502,
      retryable: true,
      message:
        'Could not reach Gemini. Check that this machine is online — everything else in Marginalia works offline, but this one feature cannot.'
    };
  }
  // Never the raw blob: it is a JSON dump written for whoever wired up the API. Logged in full
  // by the caller, summarised here.
  console.error('[Marginalia] unclassified Gemini failure:', raw);
  return {
    status: 500,
    retryable: true,
    message: 'Gemini failed in a way this app does not recognise. The details are in the terminal.'
  };
}

/**
 * Turns whatever the model sent back into a result, or throws.
 *
 * Lenient about the wrapping, strict about the contents. The wrapping needs slack because the
 * web-grounded route cannot use `responseSchema` — the Search tool and a response schema are not
 * accepted together — so there the JSON is asked for in the prompt and can arrive fenced in
 * ```json. The contents get none, because this object is rendered straight into the panel: a
 * `themes` field that came back as a string rather than an array would otherwise reach React as
 * a crash rather than an error message.
 */
function parseAnalysis(raw: string | undefined, fallbackTitle: string): ThematicAnalysisResult {
  if (!raw?.trim()) throw new Error('Gemini returned an empty analysis.');
  const json = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  let data: ThematicAnalysisResult;
  try {
    data = JSON.parse(json) as ThematicAnalysisResult;
  } catch {
    throw new Error('Gemini returned something that was not valid JSON.');
  }

  if (!Array.isArray(data?.themes) || typeof data?.executiveSummary !== 'string') {
    throw new Error('Gemini returned an analysis in an unexpected shape.');
  }
  data.themes = data.themes.filter((theme) => theme && typeof theme.themeName === 'string');
  for (const theme of data.themes) {
    if (!Array.isArray(theme.evidence)) theme.evidence = [];
    if (!PROMINENCE_VALUES.includes(theme.prominence)) theme.prominence = 'Recurring Motif';
  }
  // The model names the work itself; fall back to the title we already know when it names nothing,
  // so the panel is never headed by an empty string.
  if (!data.bookTitle) data.bookTitle = fallbackTitle;
  if (typeof data.narrativeArc !== 'string') data.narrativeArc = '';
  return data;
}

/**
 * Analyses one stored document. POST rather than GET because it is neither cheap nor cacheable:
 * each call reads the whole book again and spends real tokens.
 */
router.post('/documents/:id/analysis', async (req, res) => {
  const doc = await getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({
      success: false,
      retryable: false,
      message: 'That document is no longer in your library.'
    });
    return;
  }

  const original = await getOriginal(req.params.id);
  const pdf =
    original && path.extname(original.filename).toLowerCase() === '.pdf' ? original : null;
  if (!pdf && !doc.text.trim()) {
    res.status(400).json({
      success: false,
      retryable: false,
      message: 'There is nothing to analyse: this document has neither a PDF nor any extracted text.'
    });
    return;
  }

  let uploadedName: string | null = null;
  try {
    const ai = await getClient();
    const { model } = await geminiCredentials();
    // Logged on every outbound call, and nowhere else, so "did this app talk to Google?" is a
    // question the terminal answers rather than one anybody has to take on trust. The key itself
    // is never logged.
    console.log(`[Marginalia] Sending "${doc.title}" to Gemini (${model}) — reader requested.`);
    let documentPart: PartUnion;

    if (pdf) {
      // Straight from the buffer — the file is already on this machine's disk, so writing a second
      // temporary copy just to hand the SDK a path would be a copy to clean up for nothing.
      const uploaded = await ai.files.upload({
        file: new Blob([new Uint8Array(pdf.buffer)], { type: 'application/pdf' }),
        config: { mimeType: 'application/pdf', displayName: pdf.filename }
      });
      uploadedName = uploaded.name ?? null;
      if (!uploadedName) throw new Error('Gemini accepted the upload but returned no file handle.');

      // A PDF is not usable until Gemini has finished parsing its pages, which for a scanned book
      // means running OCR over every one of them.
      const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
      let file = await ai.files.get({ name: uploadedName });
      while (file.state === 'PROCESSING') {
        if (Date.now() > deadline) {
          throw new Error('Gemini is still processing this document after five minutes. Try again.');
        }
        await sleep(POLL_INTERVAL_MS);
        file = await ai.files.get({ name: uploadedName });
      }
      if (file.state === 'FAILED' || !file.uri) {
        throw new Error('Gemini could not read this PDF. It may be corrupt or password-protected.');
      }
      documentPart = createPartFromUri(file.uri, file.mimeType ?? 'application/pdf');
    } else {
      documentPart = `Title: ${doc.title}\n\n${doc.text}`;
    }

    const response = await ai.models.generateContent({
      model,
      contents: createUserContent([documentPart, PROMPT]),
      config: {
        responseMimeType: 'application/json',
        responseSchema: thematicAnalysisSchema,
        temperature: 0.2
      }
    });

    const data = parseAnalysis(response.text, doc.title);
    // Kept with the document so the same book is never paid for twice, and so the library can
    // list what it found without re-running anything.
    await updateDocument(req.params.id, {
      analysis: { ...data, analysedAt: new Date().toISOString(), model }
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Thematic analysis failed:', error);
    const failure = describeError(error);
    res.status(failure.status).json({ success: false, ...failure });
  } finally {
    // The reader's book does not stay in someone else's cloud a moment longer than the analysis
    // needs it, so this runs on the failure path too.
    if (uploadedName) {
      try {
        await (await getClient()).files.delete({ name: uploadedName });
      } catch (cleanupError) {
        console.warn('Could not delete the uploaded copy from Gemini:', cleanupError);
      }
    }
  }
});

/**
 * Whether a key is configured, and which model will be used — never the key itself.
 *
 * Settings needs to show whether analysis is ready without the key ever travelling back to the
 * renderer, where it would end up in memory the app has no reason to hold it in.
 */
router.get('/gemini-config', async (_req, res) => {
  const { apiKey, model } = await geminiCredentials();
  const stored = (await getSettings()) ?? {};
  res.json({
    configured: Boolean(apiKey),
    // Worth distinguishing: a key from the environment cannot be changed from inside the app.
    source: typeof stored.geminiApiKey === 'string' && stored.geminiApiKey.trim() ? 'settings' : apiKey ? 'environment' : null,
    model
  });
});

/** Sets or clears the stored key and model. An empty key removes it. */
router.put('/gemini-config', async (req, res) => {
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : undefined;
  const model = typeof req.body?.model === 'string' ? req.body.model.trim() : undefined;
  const stored = (await getSettings()) ?? {};
  const next = { ...stored };
  if (apiKey !== undefined) next.geminiApiKey = apiKey;
  if (model !== undefined) next.geminiModel = model;
  await saveSettings(next);
  const after = await geminiCredentials();
  console.log(`[Marginalia] Gemini key ${apiKey ? 'set' : 'cleared'} from Settings.`);
  res.json({ configured: Boolean(after.apiKey), model: after.model });
});

/**
 * The analysis already stored for a document, if it has one.
 *
 * Lets the panel open showing what was found last time instead of an empty button, which is the
 * whole point of storing it: an analysis is slow and costs tokens, so seeing it again should cost
 * neither.
 */
router.get('/documents/:id/analysis', async (req, res) => {
  const doc = await getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ success: false, message: 'That document is no longer in your library.' });
    return;
  }
  if (!doc.analysis) {
    res.json({ success: true, data: null });
    return;
  }
  const { analysedAt, model, ...data } = doc.analysis;
  res.json({ success: true, data, analysedAt, model });
});

/**
 * A PDF's own idea of what it is: the title and author written into its metadata.
 *
 * Better than anything guessable from the filename, which is all the store keeps — "kulliyat
 * iqbal urdu" on disk is "Kulliyat-e-Iqbal" by "Muhammad Iqbal" inside the file. Used to fill in
 * the web lookup form, so a reader switching to it is not retyping a book they are looking at.
 */
router.get('/documents/:id/book-metadata', async (req, res) => {
  const original = await getOriginal(req.params.id);
  if (!original || path.extname(original.filename).toLowerCase() !== '.pdf') {
    res.json({ title: '', author: '' });
    return;
  }
  try {
    const pdf = await PDFDocument.load(original.buffer, { updateMetadata: false });
    const title = pdf.getTitle()?.trim() ?? '';
    res.json({
      // A PDF produced by exporting something else carries the source file's name as its title
      // — "marginalia-export-1788180998881.html". That is worse than the filename guess, so any
      // "title" that is really a filename is dropped rather than offered.
      title: /\.[a-z0-9]{2,4}$/i.test(title) ? '' : title,
      author: pdf.getAuthor()?.trim() ?? ''
    });
  } catch {
    // A PDF too damaged to parse still analyses fine — Gemini reads the raw file — so a failure
    // here is not worth an error. The form simply falls back to the filename guess.
    res.json({ title: '', author: '' });
  }
});

/**
 * Analyses a book the reader does not have a copy of, by name.
 *
 * The model reads the open web through Google Search grounding rather than the book itself, so
 * this is second-hand: it synthesises what critics and study guides say. That is genuinely useful
 * for deciding whether to read something, and genuinely different from analysing the text in
 * front of you — the panel says which one produced a given result rather than letting them blur.
 *
 * No `responseSchema` here, deliberately: the Search tool and a response schema are not accepted
 * on the same request, so the shape is asked for in the prompt and enforced by `parseAnalysis`
 * on the way back instead.
 */
router.post('/analyze-from-web', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const author = typeof req.body?.author === 'string' ? req.body.author.trim() : '';
  const edition = typeof req.body?.edition === 'string' ? req.body.edition.trim() : '';
  if (!title) {
    res.status(400).json({ success: false, retryable: false, message: 'Enter a book title first.' });
    return;
  }

  try {
    const ai = await getClient();
    const { model } = await geminiCredentials();
    console.log(`[Marginalia] Searching the web for "${title}" via Gemini (${model}) — reader requested.`);
    // The edition matters for exactly the books someone is most likely to look up this way:
    // a translated classic reads differently in each translator's hands, and an abridged or
    // revised edition can lose a theme outright.
    const work = [
      `"${title}"`,
      author && `by ${author}`,
      edition && `(${edition} edition)`
    ]
      .filter(Boolean)
      .join(' ');
    const response = await ai.models.generateContent({
      model,
      contents: `You are a literary researcher. Use Google Search to find reliable summaries,
encyclopaedia entries, study guides and scholarly analyses of ${work}, then write a thematic
analysis of it.

- Confirm you have the right work before analysing; if the search results describe a different
  book with a similar name, analyse the one actually named above.
- If an edition is named, prefer sources about that edition — translation, abridgement and
  revision can change which themes are even present.
- Support every theme with concrete plot events, characters or passages named in your sources.
- Judge prominence honestly: most works have only one or two primary themes.

Reply with JSON and nothing else — no prose around it, no code fence — in exactly this shape:
{
  "bookTitle": string,
  "executiveSummary": string (150-250 words),
  "themes": [{
    "themeName": string,
    "description": string,
    "prominence": "Primary" | "Secondary" | "Recurring Motif",
    "evidence": string[]
  }],
  "narrativeArc": string
}`,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3
      }
    });

    res.json({ success: true, data: parseAnalysis(response.text, title) });
  } catch (error) {
    console.error('Web-grounded analysis failed:', error);
    const failure = describeError(error);
    res.status(failure.status).json({ success: false, ...failure });
  }
});

export default router;
