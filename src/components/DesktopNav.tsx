import React from 'react';
import { BookOpen, StickyNote, Sparkles, Settings as SettingsIcon } from 'lucide-react';
import { Screen, TransitionType } from '../types';

interface DesktopNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
}

export const DesktopNav: React.FC<DesktopNavProps> = ({
  currentScreen,
  onNavigate,
  isDark = false
}) => {
  const tabs: Array<{
    id: Screen;
    label: string;
    icon: React.ElementType;
    screen: Screen;
    transition: TransitionType;
  }> = [
    { id: 'home', label: 'Library', icon: BookOpen, screen: 'home', transition: 'push_back' },
    { id: 'reader', label: 'AI Notes', icon: StickyNote, screen: 'reader', transition: 'push' },
    { id: 'analysis', label: 'Analysis', icon: Sparkles, screen: 'analysis', transition: 'push' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, screen: 'settings', transition: 'push' }
  ];

  const isActive = (tab: typeof tabs[number]) => {
    if (tab.id === 'analysis') return currentScreen === 'analysis' || currentScreen === 'upload';
    return currentScreen === tab.id;
  };

  return (
    <aside
      id="desktop-sidebar-nav"
      className={`hidden md:flex flex-col w-55 shrink-0 border-r h-screen sticky top-0 transition-colors ${
        isDark
          ? 'bg-[#121514] border-white/5'
          : 'bg-[#f9f9f7] border-black/4'
      }`}
    >
      {/* Brand */}
      <div className="px-6 pt-6 pb-4">
        <h1
          onClick={() => onNavigate('home', 'push_back')}
          className="font-serif text-[22px] font-normal tracking-tight cursor-pointer hover:opacity-80 transition-opacity text-stone-900 dark:text-white select-none"
        >
          Marginalia
        </h1>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1 pt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (currentScreen !== tab.screen) {
                  onNavigate(tab.screen, tab.transition);
                }
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer active:scale-[0.97] ${
                active
                  ? isDark
                    ? 'bg-[#435c52] text-white shadow-sm'
                    : 'bg-[#435c52] text-white shadow-sm'
                  : isDark
                    ? 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={`px-4 py-4 border-t text-[11px] text-stone-500 dark:text-stone-600 ${
        isDark ? 'border-white/5' : 'border-black/4'
      }`}>
        <span>Marginalia • AI Reading</span>
      </div>
    </aside>
  );
};
