/**
 * When the text reader reads the page's selection and opens its menu. Pure, tested.
 *
 * A mouse or pen ends a selection with a release, so it is read at once and an armed tool marks
 * it. A finger does not: long-press and the selection handles fire no mouseup, and a long-press
 * usually ends in `pointercancel`, never `pointerup`. So after touch (and after keyboard
 * selection) the selection is read once it has stopped changing, and an armed tool never marks
 * on its own; the menu opens and the reader picks.
 */

export type InputKind = 'mouse' | 'pen' | 'touch' | 'key';

export type SelectionTrigger =
  | { mode: 'ignore' }
  | { mode: 'now'; applyArmedTool: boolean }
  | { mode: 'debounce'; delayMs: number; applyArmedTool: false };

export const KEY_SETTLE_MS = 300;
/** Longer than keys: a handle drag pauses between moves more than a held Shift+Arrow does. */
export const TOUCH_SETTLE_MS = 400;

export function inputKindOf(pointerType: string): InputKind {
  return pointerType === 'touch' ? 'touch' : pointerType === 'pen' ? 'pen' : 'mouse';
}

export function selectionTrigger(last: InputKind | null, event: 'pointerup' | 'selectionchange'): SelectionTrigger {
  if (event === 'pointerup') {
    if (last === 'touch') return { mode: 'debounce', delayMs: TOUCH_SETTLE_MS, applyArmedTool: false };
    return { mode: 'now', applyArmedTool: true };
  }
  if (last === 'key') return { mode: 'debounce', delayMs: KEY_SETTLE_MS, applyArmedTool: false };
  if (last === 'touch') return { mode: 'debounce', delayMs: TOUCH_SETTLE_MS, applyArmedTool: false };
  // A mouse drag's selection is read on release; reading it mid-drag would open the menu early.
  return { mode: 'ignore' };
}
