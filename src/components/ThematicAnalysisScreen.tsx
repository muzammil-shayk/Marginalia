import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  Globe, 
  Quote, 
  ChevronRight, 
  BookOpen, 
  RefreshCw, 
  Zap, 
  Bot, 
  Layers, 
  Lightbulb, 
  Info,
  Share2
} from 'lucide-react';
import { Screen, TransitionType, ThemeInsight, MetaphorPattern } from '../types';
import { extractedThemes as defaultThemes, metaphorPatterns as defaultMetaphors, sampleReaderParagraphs } from '../data/mockData';

interface ThematicAnalysisScreenProps {
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
  documentTitle?: string;
  documentText?: string;
}

export const ThematicAnalysisScreen: React.FC<ThematicAnalysisScreenProps> = ({
  onNavigate,
  isDark = false,
  documentTitle = 'The Architecture of Complexity',
  documentText
}) => {
  const [themes, setThemes] = useState<ThemeInsight[]>(defaultThemes);
  const [metaphors, setMetaphors] = useState<MetaphorPattern[]>(defaultMetaphors);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('t1');
  const [executiveSummary, setExecutiveSummary] = useState<string>(
    'Hierarchical decomposition into nearly decomposable sub-assemblies shields intermediate evolutionary progress from environmental shocks.'
  );
  const [synthesisQuote, setSynthesisQuote] = useState<string>(
    'The watchmaker metaphor is dominant, used primarily to illustrate the stability of intermediate forms in complex system assembly.'
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [aiSource, setAiSource] = useState<string>('gemini-flash');

  // Trigger Gemini Flash Thematic Analysis
  const runGeminiAnalysis = async () => {
    setIsLoading(true);
    const textToAnalyze = documentText || sampleReaderParagraphs.map(p => p.text).join('\n\n');

    try {
      const res = await fetch('/api/gemini/thematic-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: documentTitle,
          text: textToAnalyze
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.extractedThemes && data.extractedThemes.length > 0) {
        setThemes(data.extractedThemes);
        setSelectedThemeId(data.extractedThemes[0].id);
      }
      if (data.metaphorPatterns && data.metaphorPatterns.length > 0) {
        setMetaphors(data.metaphorPatterns);
      }
      if (data.executiveSummary) {
        setExecutiveSummary(data.executiveSummary);
      }
      if (data.synthesisQuote) {
        setSynthesisQuote(data.synthesisQuote);
      }
      setAiSource(data.source || 'gemini-flash');
    } catch (err) {
      console.warn('Gemini Flash analysis fallback:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTheme = themes.find((t) => t.id === selectedThemeId) || themes[0];

  return (
    <main className="flex-1 px-5 py-4 pb-24 max-w-md mx-auto w-full space-y-6">
      {/* Document Title & Meta Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
            <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Gemini Flash Analysis</span>
          </div>

          <button
            type="button"
            onClick={runGeminiAnalysis}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-200/80 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-[12px] font-medium transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isLoading ? 'Synthesizing...' : 'Re-analyze'}</span>
          </button>
        </div>

        <h2 className="font-serif text-[26px] font-semibold leading-tight text-stone-900 dark:text-white">
          {documentTitle}
        </h2>
        
        {executiveSummary && (
          <p className="text-[13px] text-stone-600 dark:text-stone-300 leading-relaxed italic bg-stone-100 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/60 dark:border-stone-800">
            &ldquo;{executiveSummary}&rdquo;
          </p>
        )}
      </div>

      {/* EXTRACTED THEMES Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-semibold tracking-wider uppercase">
              EXTRACTED THEMES ({themes.length})
            </span>
          </div>
          <span className="text-[11px] text-stone-500">Tap to inspect details</span>
        </div>

        {/* Theme Cards List */}
        <div className="space-y-3.5">
          {themes.map((theme) => {
            const isSelected = selectedThemeId === theme.id;
            return (
              <div
                key={theme.id}
                id={`theme-card-${theme.id}`}
                onClick={() => setSelectedThemeId(theme.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? isDark
                      ? 'bg-[#1b201d] border-emerald-500/40 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-white border-stone-300/80 shadow-xs ring-1 ring-stone-300/40'
                    : isDark
                      ? 'bg-[#151917] border-stone-800/80 opacity-80 hover:opacity-100'
                      : 'bg-white/70 border-stone-200 hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-serif text-[17px] font-semibold text-stone-900 dark:text-white">
                    {theme.title}
                  </h3>
                  {isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 fill-emerald-600/10 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-stone-400 shrink-0" />
                  )}
                </div>

                <p className="text-[13px] text-stone-600 dark:text-stone-300 leading-relaxed mb-3">
                  {theme.description}
                </p>

                {/* Expanded details when selected */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2 text-[12px] animate-in fade-in duration-150">
                    <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 italic border-l-2 border-emerald-600">
                      &ldquo;{theme.description}&rdquo;
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[12px] pt-2 mt-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: theme.id === 't1' ? '#8b5cf6' : theme.id === 't2' ? '#3b82f6' : '#10b981'
                      }}
                    />
                    <span className="text-stone-700 dark:text-stone-300 font-medium">
                      {theme.confidenceLabel || `${Math.round((theme.confidence || 0.9) * 100)}% Confidence`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-stone-600 dark:text-stone-400 font-medium">
                    <Quote className="w-3.5 h-3.5 text-stone-400" />
                    <span>{theme.mentions} mentions</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PATTERN FINDING: METAPHORS */}
      <section
        id="metaphors-pattern-section"
        className={`p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#1b201d] border-stone-800 text-stone-100'
            : 'bg-[#f0eee9] border-stone-300/40 text-stone-900'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-stone-700 dark:text-stone-300" />
            <span className="text-[11px] font-semibold tracking-wider text-stone-700 dark:text-stone-300 uppercase">
              PATTERN FINDING: METAPHORS
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold text-stone-500 bg-stone-200/60 dark:bg-stone-800 px-2 py-0.5 rounded-md">
            Gemini Flash
          </span>
        </div>

        {/* Metaphor Bars */}
        <div className="space-y-3 mb-5">
          {metaphors.map((item) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="font-medium text-stone-700 dark:text-stone-300 w-28 shrink-0">
                  {item.name}
                </span>
                <div className="flex-1 h-3 bg-stone-300/60 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      item.name.toLowerCase().includes('watch')
                        ? 'bg-[#d8b4fe]'
                        : item.name.toLowerCase().includes('alpha')
                          ? 'bg-[#a7f3d0]'
                          : 'bg-amber-300'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <span className="text-[12px] font-semibold text-stone-600 dark:text-stone-400 w-9 text-right">
                  {item.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-stone-300/70 dark:bg-stone-800 my-4" />

        {/* Quoted Synthesis Finding */}
        <p className="font-serif italic text-[13px] text-stone-700 dark:text-stone-300 leading-relaxed">
          &ldquo;{synthesisQuote}&rdquo;
        </p>

        {/* Jump to Reader Button */}
        <div className="mt-4 pt-1">
          <button
            type="button"
            onClick={() => onNavigate('reader', 'push')}
            className="w-full py-2.5 px-3 rounded-xl bg-[#435c52] hover:bg-[#374c43] text-white text-[13px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <BookOpen className="w-4 h-4" />
            <span>Read in Mindful Reader</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </main>
  );
};
