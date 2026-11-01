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
import { placePanel } from './pdf/panelPlacement';

/**
 * Above the trigger and centred on it, but always inside the window: clamped 8px from either
 * side, and below the trigger when there is no room above (`placePanel`). Measured before paint,
 * so a tooltip near an edge is never seen hanging off it first.
 */
export const HoverTooltip: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = ''
}) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const tipRef = React.useRef<HTMLSpanElement>(null);
  const [trigger, setTrigger] = React.useState<DOMRect | null>(null);
  const [at, setAt] = React.useState<{ left: number; top: number } | null>(null);

  React.useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!trigger || !tip) return setAt(null);
    const { width, height } = tip.getBoundingClientRect();
    const { left, top } = placePanel({
      anchor: { left: trigger.left + trigger.width / 2 - width / 2, top: trigger.top, bottom: trigger.bottom },
      width,
      height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      gap: 6
    });
    setAt({ left, top });
  }, [trigger, label]);

  return (
    <span
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setTrigger(ref.current?.getBoundingClientRect() ?? null)}
      onMouseLeave={() => setTrigger(null)}
      // A press answers the question the tooltip asked: close it. The click often re-renders the
      // bar under a still pointer, so no mouseleave would ever come to close it otherwise.
      onPointerDownCapture={() => setTrigger(null)}
      onKeyDownCapture={() => setTrigger(null)}
    >
      {children}
      {trigger &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            style={{ left: at?.left ?? 0, top: at?.top ?? 0, visibility: at ? 'visible' : 'hidden' }}
            className="pointer-events-none fixed z-[70] max-w-[calc(100vw-16px)] whitespace-nowrap rounded-md bg-stone-900 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-lg dark:bg-white dark:text-stone-900"
          >
            {label}
          </span>,
          // Into the app's own root, not `document.body`: the dark theme is a `.dark` class on
          // that root, so a tooltip parked outside it could never see the theme it was styled for.
          document.getElementById('app-container') ?? document.body
        )}
    </span>
  );
};
