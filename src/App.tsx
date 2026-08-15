/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Screen, TransitionType, UserSettings } from './types';
import { initialSettings } from './data/mockData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { ThematicAnalysisScreen } from './components/ThematicAnalysisScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { UploadDocumentScreen } from './components/UploadDocumentScreen';
import { ReaderScreen } from './components/ReaderScreen';
import { SearchModal } from './components/SearchModal';
import { SidebarDrawer } from './components/SidebarDrawer';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [transitionType, setTransitionType] = useState<TransitionType>('push');
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [analysisDoc, setAnalysisDoc] = useState<{ title: string; text: string }>({
    title: 'The Architecture of Complexity',
    text: ''
  });

  // Sync theme consistently with settings
  const isDark = settings.darkMode;

  const navigate = (screen: Screen, transition: TransitionType = 'push') => {
    setTransitionType(transition);
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

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

  return (
    <div
      id="app-container"
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#121514] text-white dark' : 'bg-[#f9f9f7] text-[#1c2321]'
      }`}
    >
      {/* Search Dialog */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={navigate}
        isDark={isDark}
      />

      {/* Sidebar Drawer */}
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
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Shared Header for Non-Reader Screens */}
          <Header
            currentScreen={currentScreen}
            onNavigate={navigate}
            onOpenMenu={() => setIsSidebarOpen(true)}
            onOpenSearch={() => setIsSearchOpen(true)}
            isDark={isDark}
          />

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
                {currentScreen === 'home' && (
                  <HomeScreen onNavigate={navigate} isDark={isDark} />
                )}

                {currentScreen === 'analysis' && (
                  <ThematicAnalysisScreen
                    onNavigate={navigate}
                    isDark={isDark}
                    documentTitle={analysisDoc.title}
                    documentText={analysisDoc.text}
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
                    onSelectDocumentForAnalysis={(title, text) => {
                      setAnalysisDoc({ title, text });
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Persistent Bottom Navigation */}
          <BottomNav
            currentScreen={currentScreen}
            onNavigate={navigate}
            isDark={isDark}
          />
        </div>
      )}
    </div>
  );
}
