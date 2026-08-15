import React, { useState, useRef } from 'react';
import { Upload, FileText, Sparkles, Clock, MoreVertical, CheckCircle2 } from 'lucide-react';
import { Screen, TransitionType } from '../types';
import { recentDocuments } from '../data/mockData';

interface UploadDocumentScreenProps {
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
  onSelectDocumentForAnalysis?: (title: string, text: string) => void;
}

export const UploadDocumentScreen: React.FC<UploadDocumentScreenProps> = ({
  onNavigate,
  isDark = false,
  onSelectDocumentForAnalysis
}) => {
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartAnalysis = (title?: string, text?: string) => {
    const finalTitle = title || (selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "Custom Document Analysis");
    const finalText = text || pastedText || `The architecture of complexity explores hierarchical decomposition, nearly decomposable systems, and how intermediate stable sub-assemblies protect evolutionary progress against environmental disturbances.`;
    if (onSelectDocumentForAnalysis) {
      onSelectDocumentForAnalysis(finalTitle, finalText);
    }
    onNavigate('analysis', 'push');
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <main className="flex-1 px-5 py-4 pb-20 max-w-md mx-auto w-full space-y-6">
      {/* Title & Subtitle */}
      <div className="text-center space-y-2 pt-1">
        <h2 className="font-serif text-[26px] font-semibold text-stone-900 dark:text-white leading-tight">
          Analyze a New Document
        </h2>
        <p className="text-[14px] text-stone-600 dark:text-stone-300 max-w-xs mx-auto leading-snug">
          Upload a file or paste text to begin mindful extraction.
        </p>
      </div>

      {/* Dashed Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-[#435c52] bg-[#435c52]/10 scale-[1.01]'
            : isDark
              ? 'border-stone-700 hover:border-stone-500 bg-[#161a18]'
              : 'border-stone-300 hover:border-stone-400 bg-white/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.epub,.txt,.docx"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex justify-center mb-3">
          <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
            <Upload className="w-6 h-6" />
          </div>
        </div>

        {selectedFile ? (
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[14px]">
              <CheckCircle2 className="w-4 h-4" />
              <span>{selectedFile.name}</span>
            </div>
            <p className="text-[12px] text-stone-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze</p>
          </div>
        ) : (
          <>
            <p className="text-[14px] font-semibold text-stone-800 dark:text-stone-200 mb-1">
              Drag & Drop your file here
            </p>
            <p className="text-[12px] text-stone-500 dark:text-stone-400 max-w-xs mx-auto mb-4 leading-relaxed">
              Supports PDF, EPUB, TXT, and DOCX formats up to 50MB.
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="bg-[#435c52] hover:bg-[#374c43] text-white text-[13px] font-medium py-2.5 px-6 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              Browse Files
            </button>
          </>
        )}
      </div>

      {/* OR Divider */}
      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-stone-200 dark:border-stone-800" />
        <span className="bg-[#f9f9f7] dark:bg-[#121514] px-4 text-[11px] font-semibold text-stone-400 uppercase tracking-widest absolute">
          OR
        </span>
      </div>

      {/* Paste Text Directly Card */}
      <div
        className={`p-4 rounded-3xl border transition-all space-y-3 ${
          isDark
            ? 'bg-[#1b201d] border-stone-800'
            : 'bg-white border-stone-200/80 shadow-xs'
        }`}
      >
        <label className="text-[13px] font-semibold text-stone-800 dark:text-stone-200 block">
          Paste Text Directly
        </label>

        <textarea
          rows={5}
          placeholder="Paste excerpts, articles, or notes here..."
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          className={`w-full p-3.5 rounded-2xl text-[13px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
            isDark
              ? 'bg-[#151917] text-stone-200 placeholder-stone-600 border border-stone-800'
              : 'bg-[#f4f4f2] text-stone-800 placeholder-stone-400 border border-stone-200/60'
          }`}
        />

        <div className="flex justify-end pt-1">
          {/* Start Analysis Button (xpath: //button[contains(., 'Start Analysis')]) */}
          <button
            id="start-analysis-btn"
            type="button"
            onClick={() => handleStartAnalysis()}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#e9d5ff] hover:bg-[#ddd6fe] active:scale-[0.99] text-[#581c87] font-semibold text-[13px] transition-all shadow-xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start Analysis</span>
          </button>
        </div>
      </div>

      {/* Recent Documents Section */}
      <section id="recent-documents-section" className="space-y-3">
        <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
          <Clock className="w-4 h-4 text-stone-500" />
          <h3 className="text-[13px] font-semibold tracking-wide text-stone-800 dark:text-stone-200">
            Recent Documents
          </h3>
        </div>

        <div className="space-y-2.5">
          {/* Doc 1: Meditations on First Philosophy */}
          <div
            id="recent-doc-1"
            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer hover:shadow-xs ${
              isDark
                ? 'bg-[#1b201d] border-stone-800 hover:bg-[#232a26]'
                : 'bg-white border-stone-200/70 hover:bg-stone-50'
            }`}
            onClick={() => handleStartAnalysis('Meditations on First Philosophy', 'Descartes examines the foundations of knowledge, systematic doubt, the cogito, and the dualism between mind and body.')}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-[13px] text-stone-900 dark:text-stone-100 truncate">
                  Meditations on First Philosophy
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  PDF • Added 2 days ago
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); }}
              className="p-1 text-stone-400 hover:text-stone-600"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Doc 2: The Architecture of Happiness (Targets xpath: //h4[contains(text(), 'The Architecture of Happiness')]/ancestor::div[contains(@class, 'cursor-pointer')]) */}
          <div
            id="recent-doc-2"
            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer hover:shadow-xs ${
              isDark
                ? 'bg-[#1b201d] border-stone-800 hover:bg-[#232a26]'
                : 'bg-white border-stone-200/70 hover:bg-stone-50'
            }`}
            onClick={() => handleStartAnalysis('The Architecture of Happiness', 'Alain de Botton explores how physical spaces and architectural forms subtly shape human psychological well-being and moral sentiments.')}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-[13px] text-stone-900 dark:text-stone-100 truncate">
                  The Architecture of Happiness...
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Text • Added last week
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); }}
              className="p-1 text-stone-400 hover:text-stone-600"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};
