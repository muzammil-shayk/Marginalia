import React from 'react';
import { BookOpen, Settings as SettingsIcon, PlusCircle, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import { Screen, TransitionType } from '../types';
import logo from '../assets/images/marginalia-logo.png';

interface DesktopNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
  hasActiveDocument?: boolean;
  /**
   * A collapsed sidebar is a standing preference about how much of the window belongs to the
   * document rather than a per-visit decision, so it lives in `UserSettings` (server-backed) —
   * not local component state — the same as every other reading preference. Controlled from
   * `App.tsx` rather than owned here so it persists the same way settings changed from Settings
   * itself do.
   */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Opens the thematic analysis dialog. Not a screen: it asks which book to read and shows the
   *  result in place, so routing to it would leave a back button pointing at nothing. */
  onOpenAnalysis?: () => void;
}

export const DesktopNav: React.FC<DesktopNavProps> = ({
  currentScreen,
  onNavigate,
  isDark = false,
  hasActiveDocument = true,
  collapsed,
  onToggleCollapsed,
  onOpenAnalysis
}) => {

  const tabs: Array<{
    id: Screen;
    label: string;
    icon: React.ElementType;
    screen: Screen;
    transition: TransitionType;
  }> = [
    // Library, Add Document and Settings only. Reading and analysis are reached from a document
    // rather than from the sidebar.
    { id: 'home', label: 'Library', icon: BookOpen, screen: 'home', transition: 'push_back' },
    { id: 'upload', label: 'Add Document', icon: PlusCircle, screen: 'upload', transition: 'push' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, screen: 'settings', transition: 'push' }
  ];

  const isActive = (tab: typeof tabs[number]) => {
    // Reading a document opened from the library still belongs to the Library tab.
    if (tab.id === 'home') return currentScreen === 'home' || currentScreen === 'reader';
    return currentScreen === tab.id;
  };

  return (
    <aside
      id="desktop-sidebar-nav"
      className={`hidden md:flex flex-col shrink-0 border-r h-screen sticky top-0 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-55'
      } ${isDark ? 'bg-[#121514] border-white/5' : 'bg-[#f9f9f7] border-black/4'}`}
    >
      {/* Brand, and the control that gives the window back to the document. */}
      {/* Also a drag handle: on macOS the traffic lights sit in this corner and the rest of the
          row is the only chrome the window has left to be moved by. */}
      <div className={`app-drag flex items-center pt-6 pb-4 ${collapsed ? 'flex-col gap-3 px-2' : 'px-4 gap-2'}`}>
        {!collapsed && (
          <h1
            onClick={() => onNavigate('home', 'push_back')}
            className="cursor-pointer hover:opacity-80 transition-opacity select-none flex-1 min-w-0"
          >
            <img src={logo} alt="Marginalia" className="h-20 w-auto" />
          </h1>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          aria-expanded={!collapsed}
          className="p-1.5 rounded-lg shrink-0 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-200/70 dark:hover:bg-white/5 cursor-pointer transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <nav className={`flex-1 space-y-1 pt-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);
          // Every remaining destination works with or without a document open.
          const isDisabled = false;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled && currentScreen !== tab.screen) {
                  onNavigate(tab.screen, tab.transition);
                }
              }}
              className={`w-full flex items-center rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] ${
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3.5 py-2.5'
              } ${
                isDisabled
                  ? 'cursor-not-allowed text-stone-300 dark:text-stone-700'
                  : `cursor-pointer ${
                      active
                        ? 'bg-[#435c52] text-white shadow-sm'
                        : isDark
                          ? 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                    }`
              }`}
              title={isDisabled ? 'Upload a document to start reading' : collapsed ? tab.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{tab.label}</span>}
            </button>
          );
        })}

        {/* Analysis is a dialog rather than a tab: it can be opened over any screen, and it
            asks which book to read rather than assuming the one on screen. */}
        {onOpenAnalysis && (
          <button
            type="button"
            onClick={onOpenAnalysis}
            title={collapsed ? 'AI Analysis' : undefined}
            className={`w-full flex items-center rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] cursor-pointer ${
              collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3.5 py-2.5'
            } ${
              isDark
                ? 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            {!collapsed && <span>AI Analysis</span>}
          </button>
        )}
      </nav>

      {/* Bottom section */}
      {!collapsed && (
        <div className={`px-4 py-4 border-t text-[13px] text-stone-500 dark:text-stone-600 space-y-1.5 ${
          isDark ? 'border-white/5' : 'border-black/4'
        }`}>
          <span className="font-serif font-bold tracking-tight text-[#435c52] dark:text-emerald-300">
            Marginalia • Annotator
          </span>
          <p className="italic text-[12px] text-stone-400 dark:text-stone-600 leading-snug">
            For close readers,
            <br />
            Built with care by Shama Iqbal Hussain.
          </p>
        </div>
      )}
    </aside>
  );
};
