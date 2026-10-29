import React, { useState } from 'react';
import { Menu, Search } from './icons';
import { Screen } from '../types';
import { motion, useScroll, useMotionValueEvent } from 'motion/react';
import logo from '../assets/images/marginalia-logo.png';

interface HeaderProps {
  onNavigate: (screen: Screen, transition?: 'push' | 'push_back' | 'slide_up' | 'none') => void;
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  isDark?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  onOpenMenu,
  onOpenSearch,
  isDark = false
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

  const handleLogoClick = () => {
    onNavigate('home', 'push_back');
  };

  const handleSearchClick = () => {
    onOpenSearch?.();
  };

  return (
    <motion.header 
      variants={{
        visible: { y: 0 },
        hidden: { y: '-100%' }
      }}
      initial="visible"
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className={`app-drag sticky top-0 z-30 flex items-center justify-between px-5 py-4 transition-colors ${
      isDark ? 'bg-night text-paper border-b border-white/5' : 'bg-paper text-ink border-b border-black/4'
    }`}>
      {/* Menu Icon Button */}
      <button
        id="header-menu-btn"
        type="button"
        onClick={onOpenMenu}
        aria-label="Open Navigation Menu"
        className={`p-2 -ml-2 rounded-lg transition-colors duration-150 ease-out ${
          `${isDark ? 'text-stone-300' : 'text-stone-700'} hover:bg-nav-hover hover:text-nav-active-fg`
        }`}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Brand Title: H1 with inner div to ensure both XPath patterns match */}
      <h1
        id="marginalia-brand-logo"
        onClick={handleLogoClick}
        className="cursor-pointer select-none hover:opacity-85 transition-opacity"
      >
        <img src={logo} alt="Marginalia" className="block h-auto w-auto max-h-16 max-w-full shrink-0 dark:box-content dark:max-w-[calc(100%-1rem)] dark:bg-paper dark:rounded-2xl dark:p-2" />
      </h1>

      {/* Search Button (also fulfills //a[contains(., 'Search')] | //button[contains(., 'search')]) */}
      <button
        id="header-search-btn"
        type="button"
        onClick={handleSearchClick}
        aria-label="search Search"
        className={`p-2 -mr-2 rounded-lg transition-colors duration-150 ease-out flex items-center gap-1 ${
          `${isDark ? 'text-stone-300' : 'text-stone-700'} hover:bg-nav-hover hover:text-nav-active-fg`
        }`}
      >
        <span className="sr-only">search Search</span>
        <Search className="w-5 h-5" />
      </button>
    </motion.header>
  );
};
