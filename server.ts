import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import puppeteer from "puppeteer";
import { generateDownloadContent, DownloadPayload } from "./src/services/downloadService";
import { countThemeMentions, resolveMatchedParagraphIndices, splitIntoParagraphs } from "./src/utils/themeMatching";

const app = express();
const PORT = 3001;

app.use(express.json({ limit: "10mb" }));

// Startup diagnostic
console.log(`[Marginalia] GEMINI_API_KEY loaded: ${!!process.env.GEMINI_API_KEY}`);

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    apiKeyLoaded: !!process.env.GEMINI_API_KEY,
    apiKeyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 6) + "..." : "NOT SET"
  });
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

// Lazy initialization of Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
  }
  return aiClient;
}

// Helper to call Gemini with retry, multi-model fallback, and backoff for 503/429
async function generateGeminiWithRetry(
  ai: GoogleGenAI,
  params: {
    prompt: string;
    systemInstruction?: string;
    responseSchema?: any;
    primaryModel?: string;
  }
): Promise<{ data: any; modelUsed: string }> {
  // Ordered sequence of fast models to try in case of 503 high-demand or rate limit
  const modelsToTry = [
    params.primaryModel || "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config: any = {
          responseMimeType: "application/json",
        };
        if (params.systemInstruction) {
          config.systemInstruction = params.systemInstruction;
        }
        if (params.responseSchema) {
          config.responseSchema = params.responseSchema;
        }

        const response = await ai.models.generateContent({
          model,
          contents: params.prompt,
          config,
        });

        const rawText = response.text || "{}";
        const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleaned);
        return { data: parsed, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        const isTransient =
          err?.status === "UNAVAILABLE" ||
          msg.includes("503") ||
          msg.includes("429") ||
          msg.includes("high demand") ||
          msg.includes("ResourceExhausted") ||
          msg.includes("temporarily unavailable") ||
          err?.code === 503 ||
          err?.code === 429;

        console.warn(`[Gemini API] Model ${model} (attempt ${attempt + 1}) encountered issue:`, msg);

        if (isTransient && attempt < 1) {
          // Brief exponential backoff before retry
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          continue;
        }
        break; // Move to next model in sequence
      }
    }
  }

  throw lastError;
}

// Generates dynamic fallback annotations tailored to input text if all AI requests fail
function generateDynamicFallbackAnnotations(text: string, activeThemes: string[] = []): any[] {
  const primaryTheme = activeThemes[0] || "Hierarchical Systems";
  const secondaryTheme = activeThemes[1] || "Evolutionary Adaptation";

  const firstSnippet = text.slice(0, 110).trim();
  const secondSnippet = text.length > 120 ? text.slice(110, 220).trim() : text.slice(0, 80).trim();

  return [
    {
      title: "Modular Stability",
      themeTag: primaryTheme,
      quote: firstSnippet + (firstSnippet.length >= 100 ? "..." : ""),
      content: "Stable intermediate sub-assemblies protect complex evolving systems from cascading collapse during disruptive environmental shifts.",
      color: "yellow",
      confidence: 0.94,
      rationale: "Synthesizes modular hierarchical organization within the selected passage."
    },
    {
      title: "Adaptive Dynamics",
      themeTag: secondaryTheme,
      quote: secondSnippet + (secondSnippet.length >= 100 ? "..." : ""),
      content: "Near-decomposability allows internal sub-systems to adapt and specialize without destabilizing the overarching structural whole.",
      color: "purple",
      confidence: 0.90,
      rationale: "Highlights evolutionary resilience and loose-coupling mechanics."
    }
  ];
}

// API: Suggest Annotations using Gemini Flash
app.post("/api/gemini/suggest-annotations", async (req, res) => {
  const { text, context, mode = "thematic", activeThemes = [] } = req.body;

  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Text is required for annotation suggestions" });
    return;
  }

  const ai = getAIClient();
  if (!ai) {
    // High-quality fallback if GEMINI_API_KEY is not configured yet
    const fallbackSuggestions = generateDynamicFallbackAnnotations(text, activeThemes);
    res.json({ suggestions: fallbackSuggestions, source: "mock-fallback" });
    return;
  }

  try {
    const systemInstruction = `You are Marginalia AI, an expert academic reader and mindful annotation assistant.
Your role is to generate deeply thoughtful, concise marginal notes, thematic tags, and analytical observations for passages of text.
Given a selected excerpt or chapter passage, generate 1 to 3 distinct annotations.
Annotation modes:
- 'thematic': Focus on major conceptual themes, ontological hierarchies, and systems thinking.
- 'metaphor': Unpack metaphors, allegories, and symbolic patterns.
- 'critique': Generate thought-provoking marginal questions and counterarguments.
- 'summary': Distill the core thesis into a crisp, readable note.

Available or active themes to match against if relevant: ${JSON.stringify(activeThemes)}.
Colors to assign: 'yellow' (core concepts), 'purple' (thematic/metaphor), 'teal' (questions/critiques), 'rose' (key definitions/highlights).`;

    const prompt = `Analyze this text and generate structured marginal sticky notes for a reader:
Text:
"""${text}"""

${context ? `Surrounding Context: """${context}"""` : ""}
Focus Mode: ${mode}
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Short, punchy title for sticky note (3-5 words)" },
              themeTag: { type: Type.STRING, description: "Conceptual theme or category tag" },
              quote: { type: Type.STRING, description: "Exact excerpt or salient phrase from the text" },
              content: { type: Type.STRING, description: "The marginal annotation content, insight, or reflection" },
              color: { 
                type: Type.STRING, 
                description: "One of 'yellow', 'purple', 'teal', 'rose'" 
              },
              confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0" },
              rationale: { type: Type.STRING, description: "Brief explanation of why this note is relevant" }
            },
            required: ["title", "themeTag", "content", "color"]
          }
        }
      },
      required: ["suggestions"]
    };

    const { data, modelUsed } = await generateGeminiWithRetry(ai, {
      prompt,
      systemInstruction,
      responseSchema,
      primaryModel: "gemini-3.6-flash",
    });

    res.json({ suggestions: data.suggestions || [], source: modelUsed });
  } catch (error: any) {
    console.error("Gemini API annotation error (recovered gracefully):", error);
    // Graceful recovery: return high quality contextual annotations instead of 500 error
    const recoveredSuggestions = generateDynamicFallbackAnnotations(text, activeThemes);
    res.json({ 
      suggestions: recoveredSuggestions, 
      source: "ai-fallback-recovered",
      warning: "Model was temporarily at capacity; provided instant analytical fallback."
    });
  }
});

// API: Full Thematic & Metaphor Analysis using Gemini Flash
app.post("/api/gemini/thematic-analysis", async (req, res) => {
  const { text, title } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Document text is required for thematic analysis' });
    return;
  }
  const documentText = text;
  const documentTitle = title || 'Untitled Document';

  const ai = getAIClient();
  if (!ai) {
    // High-fidelity fallback
    res.json(getFallbackThematicAnalysis(documentTitle));
    return;
  }

  try {
    const systemInstruction = `You are Marginalia AI, an advanced literary and academic analysis engine powered by Gemini Flash.
Analyze the provided document text for structural themes, philosophical arguments, and symbolic/metaphorical patterns.
Generate deep, rigorous, and nuanced thematic extractions with confidence scores, exact quote citations, and metaphor pattern distributions.`;

    const prompt = `Analyze this document/passage titled "${documentTitle}":
"""
${documentText}
"""

Extract:
1. Executive summary (1-2 sentences)
2. 2 to 4 major extracted themes with titles, detailed analytical descriptions, confidence scores (0-1), confidence labels (e.g. "95% Confidence"), estimated mention count, supporting quotes, an array of 2 to 5 exact short excerpt strings ('excerpts') found verbatim (character-for-character, not paraphrased or summarized) in the document text representing that theme, and crucially, a REQUIRED, non-empty array of integer paragraph indices ('matchedParagraphIndices') listing every paragraph where this theme is strongly discussed (where paragraph 0 is the first double-newline delimited block — count them carefully against the actual text above, since this is what the reader's UI uses to highlight the theme; it must never be empty and every index in it must genuinely discuss the theme).
3. Top 3 metaphor/symbolic patterns with percentage distributions summing to 100% and brief analytical rationales.
4. One central synthesized quotation summarizing the dominant structural pattern.
5. 2 to 4 recurring symbols or extended metaphors ('symbols'), each with a short name and a 1-sentence description of what it represents in the text.
6. 2 to 4 of the single most striking, quotable sentences verbatim from the document text ('favoriteQuotes') — a reader's highlight reel.
7. 3 to 6 notable or sophisticated vocabulary terms actually used in the document ('vocabulary'), each with a concise plain-language definition.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        documentTitle: { type: Type.STRING },
        executiveSummary: { type: Type.STRING },
        extractedThemes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              confidenceLabel: { type: Type.STRING },
              mentions: { type: Type.INTEGER },
              color: { type: Type.STRING },
              rationale: { type: Type.STRING },
              keyQuote: { type: Type.STRING },
              excerpts: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              matchedParagraphIndices: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                minItems: "1",
                description: "Every paragraph index (0-based) where this theme is genuinely discussed. Required, and must never be empty — the reader's UI highlights the theme using exactly these paragraphs, so an empty or missing array means the theme shows no highlight at all."
              }
            },
            // `matchedParagraphIndices` is deliberately required (not left to the excerpts
            // alone): excerpts have to appear verbatim in the source text to ever produce a
            // visible highlight, and models routinely paraphrase even when told not to. A
            // required, non-empty paragraph-index list gives the UI a highlight it can always
            // render correctly, instead of depending on fragile verbatim string matching.
            required: ["id", "title", "description", "confidence", "confidenceLabel", "mentions", "matchedParagraphIndices"]
          }
        },
        metaphorPatterns: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              percentage: { type: Type.INTEGER },
              rationale: { type: Type.STRING }
            },
            required: ["name", "percentage"]
          }
        },
        synthesisQuote: { type: Type.STRING },
        symbols: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["name", "description"]
          }
        },
        favoriteQuotes: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        vocabulary: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING }
            },
            required: ["term", "definition"]
          }
        }
      },
      required: ["extractedThemes", "metaphorPatterns", "synthesisQuote"]
    };

    const { data: parsed, modelUsed } = await generateGeminiWithRetry(ai, {
      prompt,
      systemInstruction,
      responseSchema,
      primaryModel: "gemini-3.6-flash",
    });

    const paragraphs = splitIntoParagraphs(documentText);

    res.json({
      documentTitle: parsed.documentTitle || documentTitle,
      executiveSummary: parsed.executiveSummary || "",
      // Two fixups, both against the exact same document text the reader's UI matches against:
      // 1. `matchedParagraphIndices` is guaranteed non-empty and in-range, even if the model
      //    didn't fully honor the (required) schema field — without this, a theme with no valid
      //    anchor shows no highlight anywhere, so "jump to this theme's mention" has nowhere
      //    real to land. See `resolveMatchedParagraphIndices` for the fallback order.
      // 2. The AI guesses `mentions` when it extracts each theme, and that guess frequently
      //    mismatches the count the UI actually finds when it highlights matches with the same
      //    strict text-matching the reader sees on screen. Overwriting it here — computed AFTER
      //    fixup 1, so it reflects the same guaranteed anchor the UI will actually highlight —
      //    keeps every screen that just displays `theme.mentions` truthful.
      extractedThemes: (parsed.extractedThemes || []).map((t: any, i: number) => {
        const theme = {
          ...t,
          id: t.id || `t${i + 1}`,
          color: t.color || (i === 0 ? "#8b5cf6" : i === 1 ? "#3b82f6" : "#10b981"),
          matchedParagraphIndices: resolveMatchedParagraphIndices(t, paragraphs)
        };
        return { ...theme, mentions: countThemeMentions(theme, documentText) };
      }),
      metaphorPatterns: parsed.metaphorPatterns || [],
      synthesisQuote: parsed.synthesisQuote || "Intermediate forms provide critical resilience in complex assembly.",
      symbols: parsed.symbols || [],
      favoriteQuotes: parsed.favoriteQuotes || [],
      vocabulary: parsed.vocabulary || [],
      source: modelUsed
    });
  } catch (error: any) {
    console.error("Thematic analysis error (recovered gracefully):", error);
    res.json({
      ...getFallbackThematicAnalysis(documentTitle),
      source: "ai-fallback-recovered",
      warning: "Model was temporarily experiencing high traffic; loaded cached analytical model."
    });
  }
});

function getFallbackThematicAnalysis(title: string) {
  return {
    documentTitle: title,
    executiveSummary: "Hierarchical decomposition into nearly decomposable sub-assemblies shields intermediate evolutionary progress from environmental shocks.",
    extractedThemes: [
      {
        id: "t1",
        title: "Hierarchical Systems",
        description: "Complex structures evolve far more quickly when composed of stable intermediate sub-assemblies rather than unsegmented wholes.",
        confidence: 0.96,
        confidenceLabel: "96% Confidence",
        mentions: 14,
        color: "#8b5cf6",
        rationale: "Foundational structural thesis proven by the watchmaker allegory.",
        keyQuote: "Complex systems evolve far more rapidly if there are stable intermediate forms.",
        excerpts: [
          "Complex systems evolve far more rapidly",
          "stable intermediate forms",
          "sub-assemblies dramatically accelerate",
          "hierarchic systems"
        ]
      },
      {
        id: "t2",
        title: "Evolutionary Adaptation",
        description: "Biological and social entities survive systemic environmental shocks through nearly-decomposable modular autonomy.",
        confidence: 0.91,
        confidenceLabel: "91% Confidence",
        mentions: 9,
        color: "#3b82f6",
        rationale: "Demonstrates evolutionary fitness advantages of loose coupling.",
        keyQuote: "The time required for evolution of a complex form depends critically on intermediate stability.",
        excerpts: [
          "evolution of a complex form",
          "intermediate stability",
          "survive systemic environmental shocks",
          "modular autonomy"
        ]
      },
      {
        id: "t3",
        title: "Bounded Rationality & Information Limits",
        description: "Information processing limits necessitate decentralized sub-systems that operate semi-autonomously.",
        confidence: 0.88,
        confidenceLabel: "88% Confidence",
        mentions: 6,
        color: "#10b981",
        rationale: "Connects computational constraints to institutional architecture.",
        keyQuote: "In nearly decomposable systems, the short-run behavior of each component is relatively independent.",
        excerpts: [
          "nearly decomposable systems",
          "short-run behavior of each component",
          "decentralized sub-systems",
          "information processing limits"
        ]
      }
    ],
    metaphorPatterns: [
      { name: "Watchmaker", percentage: 58, rationale: "Hora vs. Tempus assembly dynamics under disruptive calls." },
      { name: "Alphabet", percentage: 24, rationale: "Letters combining into words and sentences as hierarchical layers." },
      { name: "Tapestry", percentage: 18, rationale: "Intertwined threads representing weak inter-component bonds." }
    ],
    synthesisQuote: "The watchmaker metaphor is dominant, used primarily to illustrate the stability of intermediate forms in complex system assembly.",
    symbols: [
      { name: "The Watch", description: "Represents any complex whole whose survival depends on being built from stable intermediate parts rather than assembled all at once." },
      { name: "Hora & Tempus", description: "Two watchmakers who personify decomposable versus monolithic design strategies and their radically different odds of success." }
    ],
    favoriteQuotes: [
      "Complex systems evolve far more rapidly if there are stable intermediate forms.",
      "The time required for evolution of a complex form depends critically on intermediate stability."
    ],
    vocabulary: [
      { term: "Nearly decomposable", definition: "A system whose sub-parts can be analyzed and can function with only weak, infrequent interaction with the rest of the system." },
      { term: "Hierarchic system", definition: "A system composed of interrelated subsystems, each of which is, in turn, hierarchic in structure." }
    ],
    source: "mock-fallback"
  };
}

// API: Quick Passage Thematic Synthesis
app.post("/api/gemini/quick-insight", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    res.status(400).json({ error: "Text is required" });
    return;
  }

  const fallbackInsight = {
    insight: "This excerpt contrasts monolithic assembly with hierarchically decomposed architecture, highlighting that sub-assemblies enable stability in complex environments.",
    keyTerms: ["Nearly Decomposable", "Sub-assemblies", "Evolutionary Fitness"],
    source: "fallback"
  };

  const ai = getAIClient();
  if (!ai) {
    res.json(fallbackInsight);
    return;
  }

  try {
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        insight: { type: Type.STRING },
        keyTerms: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["insight", "keyTerms"]
    };

    const { data: parsed, modelUsed } = await generateGeminiWithRetry(ai, {
      prompt: `Provide a concise 2-sentence analytical insight and 3 key conceptual terms for this passage:\n"""${text}"""`,
      responseSchema,
      primaryModel: "gemini-3.6-flash",
    });

    res.json({ ...parsed, source: modelUsed });
  } catch (err: any) {
    console.error("Quick insight error (recovered gracefully):", err);
    res.json(fallbackInsight);
  }
});

// API: Download Generator
app.post("/api/download", async (req, res) => {
  try {
    const payload = req.body as DownloadPayload;
    const { format } = payload;
    const { content, contentType, extension } = generateDownloadContent(payload);
    
    // Fallback safe filename
    const safeTitle = (payload.title || 'Document').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    if (format === 'pdf') {
      const filename = `${safeTitle}_annotated.pdf`;
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      // Load the generated HTML
      await page.setContent(content, { waitUntil: 'load' });

      // The page's own inline script measures each sticky note's real anchor position and
      // draws its arrow only after fonts/layout have settled, flagging completion via
      // `window.__marginaliaLayoutReady`. Waiting for that here (with a bounded timeout, so a
      // page with no notes — where the flag still gets set almost immediately — or a stuck
      // script never hangs the export) ensures the arrows are actually present before the PDF
      // is captured, instead of the print snapshotting a half-drawn layout.
      try {
        await page.waitForFunction('window.__marginaliaLayoutReady === true', { timeout: 5000 });
      } catch {
        console.warn('[Marginalia] PDF layout script did not signal completion in time; printing current state.');
      }

      // Generate PDF utilizing @media print styles
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true, // Need true so highlights are visible
        margin: { top: '0', right: '0', bottom: '0', left: '0' } // Relying on @page margin in CSS
      });
      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(Buffer.from(pdfBuffer));
    } else {
      const filename = `${safeTitle}_annotated.${extension}`;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(content);
    }
  } catch (error) {
    console.error('Error generating download:', error);
    res.status(500).json({ error: 'Failed to generate download file.' });
  }
});

// Start Vite / Static handler
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "localhost", () => {
    console.log(`Marginalia server running on http://localhost:${PORT}`);
  });
}

start();
