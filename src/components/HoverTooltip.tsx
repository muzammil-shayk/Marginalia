/**
 * A small label that appears above whatever it wraps, on hover.
 *
 * Not the native `title` attribute — that renders as an OS-drawn tooltip, and in this app's
 * frameless Electron window it was found to not reliably appear at all (a known category of
 * platform quirk with native tooltips in custom-chrome windows). This is pure CSS hover instead
 * (`:hover` needs no OS involvement and no timing delay to get right), so it is the one used
 * anywhere a swatch or icon needs to name itself without spelling it out inline — a colour dot
 * standing in for a theme is exactly that case, since the dot alone carries no name at all.
 */

import React from 'react';

export const HoverTooltip: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = ''
}) => (
  <span className={`relative inline-flex group/tooltip ${className}`}>
    {children}
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-stone-900 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover/tooltip:opacity-100 dark:bg-white dark:text-stone-900 z-50"
    >
      {label}
    </span>
  </span>
);
