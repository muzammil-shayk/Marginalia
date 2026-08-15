import React from 'react';
import { BookOpen, PlusCircle, Settings as SettingsIcon } from 'lucide-react';
import { Screen, TransitionType } from '../types';

interface BottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onNavigate,
  isDark = false
}) => {
  return (
    <nav
      id="bottom-navigation-bar"
      className={`sticky bottom-0 z-30 w-full border-t px-6 py-2 transition-colors ${
        isDark 
          ? 'bg-[#121514] border-white/5 text-stone-300' 
          : 'bg-[#f9f9f7] border-black/[0.06] text-stone-700'
      }`}
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Library Tab */}
        <a
          id="nav-library-btn"
          href="#library"
          onClick={(e) => {
            e.preventDefault();
            if (currentScreen !== 'home') {
              onNavigate('home', 'push_back');
            }
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-5 rounded-2xl transition-all ${
            currentScreen === 'home'
              ? 'bg-[#435c52] text-white font-medium shadow-xs'
              : isDark
                ? 'text-stone-400 hover:text-stone-100 hover:bg-white/5'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] tracking-tight">Library</span>
        </a>

        {/* New Scan Tab */}
        <a
          id="nav-new-scan-btn"
          href="#new-scan"
          onClick={(e) => {
            e.preventDefault();
            if (currentScreen !== 'upload') {
              onNavigate('upload', 'push');
            }
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-5 rounded-2xl transition-all ${
            currentScreen === 'upload' || currentScreen === 'analysis'
              ? isDark 
                ? 'bg-[#435c52] text-white font-medium shadow-xs'
                : 'bg-[#435c52] text-white font-medium shadow-xs'
              : isDark
                ? 'text-stone-400 hover:text-stone-100 hover:bg-white/5'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
          }`}
        >
          <PlusCircle className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] tracking-tight">New Scan</span>
        </a>

        {/* Settings Tab */}
        <a
          id="nav-settings-btn"
          href="#settings"
          onClick={(e) => {
            e.preventDefault();
            if (currentScreen !== 'settings') {
              onNavigate('settings', 'push');
            }
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-5 rounded-2xl transition-all ${
            currentScreen === 'settings'
              ? isDark
                ? 'bg-[#98bbae] text-[#0f1715] font-semibold shadow-xs'
                : 'bg-[#b6d4c7] text-[#1c2e26] font-semibold shadow-xs'
              : isDark
                ? 'text-stone-400 hover:text-stone-100 hover:bg-white/5'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
          }`}
        >
          <SettingsIcon className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] tracking-tight">Settings</span>
        </a>
      </div>
    </nav>
  );
};
