import React from 'react';
import { BookOpen, Settings as SettingsIcon, PlusCircle, PanelLeftClose, PanelLeftOpen, Sparkles } from './icons';
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
      className={`relative hidden md:flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-200 overflow-hidden ${
        // 80px, not 64: macOS's three window buttons span about 78px including their margin, so a
        // narrower collapsed rail put the zoom button half over the content area with the
        // sidebar's own edge running between them. The rail is now wider than they are.
        collapsed ? 'w-20' : 'w-55'
      } ${isDark ? 'bg-[#121514]' : 'bg-[#f9f9f7]'}`}
    >
      {/*
        The sidebar's edge, drawn from below the title bar rather than by a `border-r` on the
        aside itself.
        
        macOS puts its close/minimise/zoom buttons in the window's top-left corner, which — with
        the system title bar hidden — is inside this sidebar. A full-height border ran a hairline
        straight through them, and when the sidebar is collapsed to 64px the buttons are wider
        than the column, so the line cut across them. Starting the edge below that zone leaves the
        corner clean on every platform, and costs nothing where there are no traffic lights.
      */}
      <span
        aria-hidden
        className={`absolute top-12 right-0 bottom-0 w-px ${isDark ? 'bg-white/5' : 'bg-black/4'}`}
      />
      {/* Brand, and the control that gives the window back to the document. */}
      {/* Also a drag handle: on macOS the traffic lights sit in this corner and the rest of the
          row is the only chrome the window has left to be moved by. */}
      <div
        className={`app-drag flex items-center pb-4 overflow-hidden ${
          // Collapsed, this column starts under macOS's traffic lights, so it begins lower than
          // the expanded sidebar does — where the wordmark is tall enough to clear them anyway.
          collapsed ? 'flex-col gap-4 px-2 pt-11' : 'px-4 gap-2 pt-6'
        }`}
      >
        {!collapsed && (
          <h1
            onClick={() => onNavigate('home', 'push_back')}
            className="cursor-pointer hover:opacity-80 transition-opacity select-none flex-1 min-w-0 overflow-hidden"
          >
            <img src={logo} alt="Marginalia" className="h-20 w-auto shrink-0" />
          </h1>
        )}
        {collapsed && (
          // The wordmark does not survive a 64px column, so the icon stands in for it. Same
          // artwork as the app icon and the tab favicon, so the mark is one thing everywhere.
          <button
            type="button"
            onClick={() => onNavigate('home', 'push_back')}
            title="Marginalia"
            className="shrink-0 rounded-xl cursor-pointer transition-transform duration-150 ease-out hover:opacity-85 active:scale-[0.94]"
          >
            <img src="/favicon.png" alt="Marginalia" className="w-10 h-10 rounded-xl" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          aria-expanded={!collapsed}
          className="p-1.5 rounded-lg shrink-0 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-200/70 dark:hover:bg-white/5 cursor-pointer transition-colors"
        >
          {/* One glyph, mirrored. Phosphor has no open/close pair for a sidebar, and the
              direction is the whole message: the panel opens the way the icon points. */}
          <PanelLeftOpen className={`transition-transform duration-200 ${collapsed ? 'w-5 h-5' : 'w-4 h-4 scale-x-[-1]'}`} />
        </button>
      </div>

      {/* Nav Items */}
      <nav className={`flex-1 space-y-1 pt-2 overflow-hidden ${collapsed ? 'px-2' : 'px-3'}`}>
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
              className={`w-full flex items-center rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] whitespace-nowrap overflow-hidden ${
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
              {/* Larger when collapsed: with the labels gone the glyph is the whole control, and
                  a 16px icon alone in an 80px rail reads as an afterthought. */}
              <Icon className={`shrink-0 ${collapsed ? 'w-5.5 h-5.5' : 'w-4 h-4'}`} />
              {!collapsed && <span className="truncate whitespace-nowrap">{tab.label}</span>}
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
            className={`w-full flex items-center rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] whitespace-nowrap overflow-hidden cursor-pointer ${
              collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3.5 py-2.5'
            } ${
              isDark
                ? 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
            }`}
          >
            <Sparkles className={`shrink-0 ${collapsed ? 'w-5.5 h-5.5' : 'w-4 h-4'}`} />
            {!collapsed && <span className="truncate whitespace-nowrap">AI Analysis</span>}
          </button>
        )}
      </nav>

      {/* Bottom section */}
      {!collapsed && (
        <div className={`px-4 py-4 border-t text-[13px] text-stone-500 dark:text-stone-600 space-y-1.5 overflow-hidden whitespace-nowrap ${
          isDark ? 'border-white/5' : 'border-black/4'
        }`}>
          <span className="font-serif font-bold tracking-tight text-[#435c52] dark:text-emerald-300 block truncate whitespace-nowrap">
            Marginalia • Annotator
          </span>
          <p className="italic text-[12px] text-stone-400 dark:text-stone-600 leading-snug truncate whitespace-nowrap">
            For close readers,
          </p>
          <p className="italic text-[12px] text-stone-400 dark:text-stone-600 leading-snug truncate whitespace-nowrap">
            Built with care by Shama Iqbal Hussain.
          </p>
        </div>
      )}
    </aside>
  );
};
