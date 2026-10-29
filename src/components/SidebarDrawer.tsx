import React from 'react';
import { X, BookOpen, PlusCircle, Settings, Sparkles } from './icons';
import { Screen, TransitionType } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import logo from '../assets/images/marginalia-logo.png';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
  /** Opens the thematic analysis dialog. See DesktopNav for why it is not a screen. */
  onOpenAnalysis?: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  isDark = false,
  onOpenAnalysis
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Drawer Panel */}
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className={`relative z-10 w-72 max-w-[80vw] h-full p-6 flex flex-col justify-between shadow-2xl border-r ${
              isDark ? 'bg-night-1 border-stone-800 text-paper' : 'bg-paper border-stone-200 text-stone-900'
            }`}
          >
            <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
            <h2>
              <img src={logo} alt="Marginalia" className="h-16 w-auto dark:box-content dark:bg-paper dark:rounded-2xl dark:p-2 dark:shadow-sm" />
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-muted hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('home', 'push_back');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-200/60 dark:hover:bg-stone-800 text-[14px] font-medium transition-colors text-left"
            >
              <BookOpen className="w-4 h-4 text-gold" />
              <span className="caps">Library</span>
            </button>

            {onOpenAnalysis && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAnalysis();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-200/60 dark:hover:bg-stone-800 text-[14px] font-medium transition-colors text-left"
              >
                <Sparkles className="w-4 h-4 text-gold" />
                <span className="caps">AI Analysis</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('upload', 'push');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-200/60 dark:hover:bg-stone-800 text-[14px] font-medium transition-colors text-left"
            >
              <PlusCircle className="w-4 h-4 text-gold" />
              <span className="caps">Scan / Upload</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('settings', 'push');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-200/60 dark:hover:bg-stone-800 text-[14px] font-medium transition-colors text-left"
            >
              <Settings className="w-4 h-4 text-gold" />
              <span className="caps">Settings</span>
            </button>
          </nav>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-stone-200 dark:border-stone-800 text-[11px] text-muted space-y-1">
          <p className="title-hand text-[15px] text-gold">Marginalia</p>
          <p>Mindful reading and AI thematic synthesis</p>
          <p className="italic pt-1">
            For close readers,
            <br />
            Built with care by Shama Iqbal Hussain.
          </p>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
