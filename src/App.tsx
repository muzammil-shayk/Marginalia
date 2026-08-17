/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Screen, TransitionType, UserSettings, StickyNote } from './types';
import { initialSettings } from './data/mockData';
import { analysisCacheKey } from './utils/cacheKeys';
import { CustomFormat } from './utils/documentExporter';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DesktopNav } from './components/DesktopNav';
import { HomeScreen } from './components/HomeScreen';
import { ThematicAnalysisScreen } from './components/ThematicAnalysisScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { UploadDocumentScreen } from './components/UploadDocumentScreen';
import { ReaderScreen } from './components/ReaderScreen';
import { SearchModal } from './components/SearchModal';
import { SidebarDrawer } from './components/SidebarDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';

// ── Storage Keys ──
const SETTINGS_KEY = 'marginalia_settings';       // localStorage — persists across sessions
const SESSION_KEY = 'marginalia_session';          // sessionStorage — per-tab, clears on close

// ── Helpers ──
function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return initialSettings;
}

function saveSettings(s: UserSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

interface SessionState {
  currentScreen: Screen;
  analysisDoc: { title: string; text: string; format?: string };
  uploadedLibrary: Array<{ id: string; title: string; text: string; date: string; wordCount: number; format?: string }>;
  /** Sticky notes / margin annotations, keyed by document title, shared by the Reader and the Inspection Panel. */
  documentNotes: Record<string, StickyNote[]>;
  /** Inline bold/highlight/underline marks, keyed by document title. */
  documentFormats: Record<string, CustomFormat[]>;
}

function loadSession(): SessionState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function saveSession(s: SessionState) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

/** Load cached AI analysis for a document (from sessionStorage) */
function loadCachedAnalysis(docTitle: string): any | null {
  try {
    const raw = sessionStorage.getItem(analysisCacheKey(docTitle));
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

export default function App() {
  // ── Hydrate state ──
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());

  const savedSession = loadSession();

  const [currentScreen, setCurrentScreen] = useState<Screen>(
    savedSession?.currentScreen || 'home'
  );
  const [transitionType, setTransitionType] = useState<TransitionType>('push');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [analysisDoc, setAnalysisDoc] = useState<{ title: string; text: string; format?: string }>(
    savedSession?.analysisDoc || { title: '', text: '' }
  );
  const [uploadedLibrary, setUploadedLibrary] = useState<
    Array<{ id: string; title: string; text: string; date: string; wordCount: number; format?: string }>
  >(savedSession?.uploadedLibrary || []);

  // Per-document notes/formats, shared by the Reader screen and the Analysis Inspection Panel,
  // and persisted so they survive navigating away and back within the same session.
  const [documentNotes, setDocumentNotes] = useState<Record<string, StickyNote[]>>(
    savedSession?.documentNotes || {}
  );
  const [documentFormats, setDocumentFormats] = useState<Record<string, CustomFormat[]>>(
    savedSession?.documentFormats || {}
  );

  const updateDocumentNotes = useCallback((docTitle: string, updater: (prev: StickyNote[]) => StickyNote[]) => {
    setDocumentNotes((prev) => ({ ...prev, [docTitle]: updater(prev[docTitle] || []) }));
  }, []);

  const updateDocumentFormats = useCallback((docTitle: string, updater: (prev: CustomFormat[]) => CustomFormat[]) => {
    setDocumentFormats((prev) => ({ ...prev, [docTitle]: updater(prev[docTitle] || []) }));
  }, []);

  // Cached analysis for home screen (read from sessionStorage)
  const [cachedAnalysis, setCachedAnalysis] = useState<any>(null);

  // Load cached analysis whenever analysisDoc changes
  useEffect(() => {
    if (analysisDoc.title && analysisDoc.text) {
      const cached = loadCachedAnalysis(analysisDoc.title);
      setCachedAnalysis(cached);
    } else {
      setCachedAnalysis(null);
    }
  }, [analysisDoc.title, analysisDoc.text]);

  // ── Persist settings to localStorage ──
  useEffect(() => { saveSettings(settings); }, [settings]);

  // ── Persist session to sessionStorage ──
  useEffect(() => {
    saveSession({ currentScreen, analysisDoc, uploadedLibrary, documentNotes, documentFormats });
  }, [currentScreen, analysisDoc, uploadedLibrary, documentNotes, documentFormats]);

  const isDark = settings.darkMode;

  const navigate = useCallback((screen: Screen, transition: TransitionType = 'push') => {
    setTransitionType(transition);
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSelectDocumentForAnalysis = useCallback((title: string, text: string, format?: string) => {
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: title || 'Uploaded Document',
      text,
      date: new Date().toLocaleDateString(),
      wordCount: text.split(/\s+/).filter(Boolean).length,
      format
    };
    setUploadedLibrary((prev) => [newDoc, ...prev.filter((d) => d.title !== title)]);
    setAnalysisDoc({ title, text, format });
  }, []);

  const getTransitionVariants = () => {
    switch (transitionType) {
      case 'push':
        return {
          initial: { opacity: 0, x: 20 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -20 },
          transition: { duration: 0.22, ease: 'easeOut' }
        };
      case 'push_back':
        return {
          initial: { opacity: 0, x: -20 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: 20 },
          transition: { duration: 0.22, ease: 'easeOut' }
        };
      case 'slide_up':
        return {
          initial: { opacity: 0, y: 30 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -30 },
          transition: { duration: 0.25, ease: 'easeOut' }
        };
      case 'none':
      default:
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 1 },
          transition: { duration: 0 }
        };
    }
  };

  const variants = getTransitionVariants();
  const hasActiveDocument = Boolean(analysisDoc.text?.trim());

  return (
    <div
      id="app-container"
      className={`min-h-screen flex flex-row font-sans transition-colors duration-200 overflow-x-clip w-full max-w-full ${
        isDark ? 'bg-[#121514] text-white dark' : 'bg-[#f9f9f7] text-[#1c2321]'
      }`}
    >
      {/* Desktop Sidebar Navigation (hidden on mobile) */}
      <DesktopNav
        currentScreen={currentScreen}
        onNavigate={navigate}
        isDark={isDark}
        hasActiveDocument={hasActiveDocument}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Search Dialog */}
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onNavigate={navigate}
          isDark={isDark}
          uploadedLibrary={uploadedLibrary}
          documentNotes={documentNotes}
          onSelectDocumentForAnalysis={handleSelectDocumentForAnalysis}
        />

        {/* Sidebar Drawer (mobile menu) */}
        <SidebarDrawer
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onNavigate={navigate}
          isDark={isDark}
        />

        {/* Screen Rendering */}
        {currentScreen === 'reader' ? (
          <ReaderScreen
            settings={settings}
            onNavigate={navigate}
            isDark={isDark}
            documentText={analysisDoc.text}
            documentTitle={analysisDoc.title}
            notes={documentNotes[analysisDoc.title] || []}
            onNotesChange={(updater) => updateDocumentNotes(analysisDoc.title, updater)}
          />
        ) : (
          <div className="flex-1 flex flex-col min-h-screen">
            {/* Shared Header for Non-Reader Screens — mobile only since desktop has sidebar */}
            <div className="md:hidden">
              <Header
                currentScreen={currentScreen}
                onNavigate={navigate}
                onOpenMenu={() => setIsSidebarOpen(true)}
                onOpenSearch={() => setIsSearchOpen(true)}
                isDark={isDark}
              />
            </div>

            {/* Active Screen Content with Animated Transition */}
            <div className="flex-1 flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentScreen}
                  initial={variants.initial}
                  animate={variants.animate}
                  exit={variants.exit}
                  transition={variants.transition}
                  className="flex-1 flex flex-col"
                >
                  <ErrorBoundary>
                    {currentScreen === 'home' && (
                      <HomeScreen
                        onNavigate={navigate}
                        isDark={isDark}
                        activeDocument={analysisDoc.text ? analysisDoc : null}
                        uploadedLibrary={uploadedLibrary}
                        cachedAnalysis={cachedAnalysis}
                        onSelectDocumentForAnalysis={handleSelectDocumentForAnalysis}
                      />
                    )}

                    {currentScreen === 'analysis' && (
                      <ThematicAnalysisScreen
                        onNavigate={navigate}
                        isDark={isDark}
                        documentTitle={analysisDoc.title}
                        documentText={analysisDoc.text}
                        isPdfSource={analysisDoc.format === 'PDF'}
                        notes={documentNotes[analysisDoc.title] || []}
                        onNotesChange={(updater) => updateDocumentNotes(analysisDoc.title, updater)}
                        formats={documentFormats[analysisDoc.title] || []}
                        onFormatsChange={(updater) => updateDocumentFormats(analysisDoc.title, updater)}
                        authorName={settings.name}
                      />
                    )}

                    {currentScreen === 'settings' && (
                      <SettingsScreen
                        settings={settings}
                        onUpdateSettings={setSettings}
                        onNavigate={navigate}
                        isDark={isDark}
                      />
                    )}

                    {currentScreen === 'upload' && (
                      <UploadDocumentScreen
                        onNavigate={navigate}
                        isDark={isDark}
                        uploadedLibrary={uploadedLibrary}
                        onSelectDocumentForAnalysis={handleSelectDocumentForAnalysis}
                      />
                    )}
                  </ErrorBoundary>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Persistent Bottom Navigation (mobile only via md:hidden in component) */}
        <BottomNav
          currentScreen={currentScreen}
          onNavigate={navigate}
          isDark={isDark}
          hasActiveDocument={hasActiveDocument}
        />
      </div>
    </div>
  );
}
