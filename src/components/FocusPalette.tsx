/**
 * Focus mode's tools: a small floating column against a screen edge, instead of the toolbar.
 *
 * Out of sight until called: the pointer at its edge, or T. It stays while hovered or holding
 * keyboard focus, and fades back when left. The grip drags it up and down either edge (arrow keys
 * on the grip do the same); where it was left is saved in settings. It acts on the same tool state
 * as the toolbar, so a tool picked here is still picked after leaving focus mode. Placement and
 * show/hide rules are pure (paletteSpot.ts).
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Grip } from './icons';
import { HoverTooltip } from './HoverTooltip';
import { isTypingTarget, withShortcut } from './pdf/workspaceKeys';
import { PALETTE_HOTKEY, PaletteSpot, dropSpot, nearEdge, nudgeSpot, paletteShown, spotBox, spotOf } from './paletteSpot';

export interface PaletteTool {
  id: string;
  label: string;
  icon: React.ElementType;
  active?: boolean;
  /** The tool's ink, shown as a dot under its glyph. */
  color?: string;
  hotkey?: string;
  disabled?: boolean;
  onClick: () => void;
}

interface FocusPaletteProps {
  isDark: boolean;
  /** As saved in settings (validated here). */
  spot: unknown;
  onSpotChange: (spot: PaletteSpot) => void;
  /** Groups of buttons, drawn with a rule between groups. */
  groups: PaletteTool[][];
}

export const FocusPalette: React.FC<FocusPaletteProps> = ({ isDark, spot: rawSpot, onSpotChange, groups }) => {
  const spot = spotOf(rawSpot);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 48, h: 400 });
  const [view, setView] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [edge, setEdge] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number; sx: number; sy: number; dx: number; dy: number } | null>(null);
  const shown = paletteShown({ nearEdge: edge, pinned, hovered, focusWithin, dragging: Boolean(drag) });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize((prev) => (prev.w === el.offsetWidth && prev.h === el.offsetHeight ? prev : { w: el.offsetWidth, h: el.offsetHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    // The edge calls it for a mouse only: a touch has no hover to call it with (T still works).
    const onMove = (e: PointerEvent) => setEdge(e.pointerType === 'mouse' && nearEdge(e.clientX, spot.side, window.innerWidth));
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.key.toLowerCase() !== PALETTE_HOTKEY.toLowerCase()) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setPinned((on) => {
        if (on && ref.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
        if (!on) requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"], button:not([disabled])')?.focus());
        return !on;
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [spot.side]);

  const at = drag
    ? {
        left: Math.min(Math.max(0, drag.x - drag.dx), view.w - size.w),
        top: Math.min(Math.max(0, drag.y - drag.dy), view.h - size.h)
      }
    : spotBox(spot, size.w, size.h, view.w, view.h);

  const glyph = isDark ? 'text-stone-300 hover:text-paper hover:bg-white/10' : 'text-muted hover:text-ink hover:bg-black/5';

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={`Focus mode tools (${PALETTE_HOTKEY})`}
      aria-orientation="vertical"
      data-palette-side={spot.side}
      data-shown={shown}
      inert={!shown || undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        // Puts the palette away; a second Escape (outside it) leaves focus mode as usual.
        e.stopPropagation();
        setPinned(false);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
      style={{
        left: at.left,
        top: at.top,
        opacity: shown ? 1 : 0,
        translate: shown || reduce ? '0 0' : `${spot.side === 'left' ? -8 : 8}px 0`,
        transition: drag ? 'none' : reduce ? 'opacity 120ms linear' : 'opacity 180ms var(--ease-out), translate 180ms var(--ease-out), left 240ms var(--ease-out), top 240ms var(--ease-out)'
      }}
      className={`focus-palette fixed z-40 flex flex-col items-center gap-0.5 p-1.5 rounded-2xl border shadow-lg ${
        shown ? '' : 'pointer-events-none'
      } ${isDark ? 'bg-night-3 border-stone-700' : 'bg-paper-0 border-stone-200'}`}
    >
      <button
        type="button"
        aria-label="Move the tools: drag, or arrow keys"
        title="Drag to move"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const box = ref.current!.getBoundingClientRect();
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag({ x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, dx: e.clientX - box.left, dy: e.clientY - box.top });
        }}
        onPointerMove={(e) => drag && setDrag({ ...drag, x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          if (!drag) return;
          const left = Math.min(Math.max(0, e.clientX - drag.dx), view.w - size.w);
          const top = Math.min(Math.max(0, e.clientY - drag.dy), view.h - size.h);
          setDrag(null);
          // A press without a drag is not a move.
          if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 3) onSpotChange(dropSpot(left + size.w / 2, top + size.h / 2, view.w, view.h));
        }}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={(e) => {
          const next = nudgeSpot(spot, e.key);
          if (!next) return;
          e.preventDefault();
          onSpotChange(next);
        }}
        className={`w-9 h-5 flex items-center justify-center rounded-lg touch-none ${drag ? 'cursor-grabbing' : 'cursor-grab'} ${glyph}`}
      >
        <Grip className="w-4 h-4" weight="bold" />
      </button>
      {groups.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <span aria-hidden className={`w-6 h-px my-1 ${isDark ? 'bg-stone-700' : 'bg-stone-200'}`} />}
          {group.map(({ id, label, icon: Icon, active, color, hotkey, disabled, onClick }) => (
            <HoverTooltip key={id} label={withShortcut(label, hotkey)}>
              <button
                type="button"
                // Keeps a text selection alive (a tool tapped over one marks it), like the toolbar.
                onMouseDown={(e) => e.preventDefault()}
                data-mark-tool
                onClick={onClick}
                disabled={disabled}
                aria-label={withShortcut(label, hotkey)}
                aria-pressed={active === undefined ? undefined : active}
                className={`relative w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-default ${
                  active ? 'bg-accent text-on-accent' : glyph
                }`}
              >
                <Icon className="w-4 h-4" weight={active ? 'fill' : 'regular'} />
                {color && (
                  <span
                    aria-hidden
                    className={`absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full ${isDark ? 'ring-1 ring-stone-400' : 'ring-1 ring-black/10'}`}
                    style={{ backgroundColor: color }}
                  />
                )}
              </button>
            </HoverTooltip>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};
