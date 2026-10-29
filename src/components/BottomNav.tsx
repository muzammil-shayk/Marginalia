import React, { useState } from 'react';
import { BookOpen, Settings as SettingsIcon, PlusCircle } from './icons';
import { Screen, TransitionType } from '../types';
import { motion, useScroll, useMotionValueEvent } from 'motion/react';

interface BottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
  hasActiveDocument?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onNavigate,
  isDark = false,
  hasActiveDocument = true
}) => {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    // Only hide after scrolling down past a threshold, show immediately on scroll up
    if (latest > previous && latest > 80) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  });

  const tabs: Array<{
    id: Screen;
    label: string;
    icon: React.ElementType;
    screen: Screen;
    transition: TransitionType;
    isActive: boolean;
  }> = [
    {
      id: 'home',
      label: 'Library',
      icon: BookOpen,
      screen: 'home',
      transition: 'push_back',
      isActive: currentScreen === 'home' || currentScreen === 'reader'
    },
    {
      id: 'upload',
      label: 'Add',
      icon: PlusCircle,
      screen: 'upload',
      transition: 'push',
      isActive: currentScreen === 'upload'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: SettingsIcon,
      screen: 'settings',
      transition: 'push',
      isActive: currentScreen === 'settings'
    }
  ];

  return (
    <motion.nav
      variants={{
        visible: { y: 0 },
        hidden: { y: '100%' }
      }}
      initial="visible"
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      id="bottom-navigation-bar"
      className={`fixed bottom-0 z-30 w-full max-w-full overflow-hidden border-t px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] transition-colors md:hidden ${
        isDark 
          ? 'bg-night/95 border-white/5 text-stone-300 backdrop-blur-md' 
          : 'bg-paper/95 border-black/6 text-stone-700 backdrop-blur-md'
      }`}
    >
      <div className="flex items-center justify-around max-w-sm mx-auto w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          // Every remaining destination works with or without a document open.
          const isDisabled = false;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={isDisabled}
              aria-current={tab.isActive ? 'page' : undefined}
              onClick={() => {
                if (!isDisabled && currentScreen !== tab.screen) {
                  onNavigate(tab.screen, tab.transition);
                }
              }}
              className={`flex items-center justify-center transition-[color,background-color,transform] duration-150 ease-out ${
                isDisabled
                  ? 'p-2.5 rounded-full text-stone-300 dark:text-stone-700 cursor-not-allowed'
                  : `cursor-pointer ${
                      tab.isActive
                        ? 'bg-nav-active text-nav-active-fg p-2.5 rounded-full active:scale-95'
                        : 'p-2.5 rounded-full text-muted hover:text-nav-active-fg hover:bg-nav-hover active:scale-95'
                    }`
              }`}
              title={isDisabled ? 'Upload a document to start reading' : tab.label}
            >
              <Icon className="w-5 h-5 shrink-0" />
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
};
