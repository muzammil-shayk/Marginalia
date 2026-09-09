/**
 * A small label that appears above whatever it wraps, on hover.
 *
 * Not the native `title` attribute — that renders as an OS-drawn tooltip, and in this app's
 * frameless Electron window it was found to not reliably appear at all (a known category of
 * platform quirk with native tooltips in custom-chrome windows). So the app draws its own.
 *
 * It is drawn into `document.body` rather than beside its trigger. As a sibling it was a child of
 * whatever contained the trigger, and the annotation toolbar clips its overflow — which left
 * every tooltip in that row sliced down to a dark sliver hanging above the tools, unreadable and
 * unexplainable. A tooltip has no business being clipped by the thing it is describing, so it is
 * positioned from the trigger's own rectangle and rendered outside the layout entirely.
 */

import React from 'react';
import { createPortal } from 'react-dom';

export const HoverTooltip: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = ''
}) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [at, setAt] = React.useState<{ left: number; top: number } | null>(null);

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setAt({ left: rect.left + rect.width / 2, top: rect.top - 6 });
  };

  return (
    <span
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={() => setAt(null)}
    >
      {children}
      {at &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: at.left, top: at.top }}
            className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-stone-900 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-lg dark:bg-white dark:text-stone-900"
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  );
};
