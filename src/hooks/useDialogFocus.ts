/**
 * Keyboard rules for a small modal dialog: Escape calls `onEscape`, Tab and Shift+Tab cycle
 * inside the dialog, and closing gives focus back to whatever had it when the dialog opened (or
 * to `fallback()` when that element is gone, e.g. a popover button that closed with the dialog).
 * The same trap as the update prompt's, for dialogs that also hold text fields.
 */

import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onEscape: () => void,
  fallback?: () => HTMLElement | null | undefined
) {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (!el) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        escapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const stops = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (stops.length === 0) return;
      e.preventDefault();
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const next = at < 0 ? (e.shiftKey ? stops.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length;
      stops[next].focus();
    };
    // Capture, so the page's own Escape and shortcut handlers never see a key meant for the dialog.
    document.addEventListener('keydown', onKey, true);
    const openerLabel = opener?.getAttribute('aria-label') ?? null;
    return () => {
      document.removeEventListener('keydown', onKey, true);
      // A frame later, so a toolbar that hid behind the dialog has mounted its buttons again.
      requestAnimationFrame(() =>
        returnFocusTarget(opener, openerLabel, (sel) => document.querySelector<HTMLElement>(sel), fallbackRef.current)?.focus({
          preventScroll: true
        })
      );
    };
  }, [open, ref]);
}

/**
 * Where focus goes when a dialog closes: the opener if it is still on the page; else the same
 * control re-mounted (found by its aria-label, e.g. a toolbar's comment button); else `fallback`.
 */
export function returnFocusTarget(
  opener: HTMLElement | null,
  openerLabel: string | null,
  query: (selector: string) => HTMLElement | null,
  fallback?: () => HTMLElement | null | undefined
): HTMLElement | null | undefined {
  if (opener?.isConnected && opener.tagName !== 'BODY') return opener;
  const twin = openerLabel ? query(`[aria-label="${openerLabel.replace(/["\\]/g, '\\$&')}"]`) : null;
  return twin ?? fallback?.();
}
