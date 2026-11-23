/**
 * Follows a drag that started on a page until it ends: `onEnd` gets the last point on pointerup;
 * a pointercancel ends it with no callback. Every listener goes either way. Returns a stop.
 */

import type { PagePoint } from './ocrLayer';

interface PointerLike {
  clientX: number;
  clientY: number;
}

export function trackDrag(win: EventTarget, at: (x: number, y: number) => PagePoint, onEnd: (to: PagePoint) => void): () => void {
  let to: PagePoint | null = null;
  const move = (e: Event) => (to = at((e as unknown as PointerLike).clientX, (e as unknown as PointerLike).clientY));
  const stop = () => {
    win.removeEventListener('pointermove', move);
    win.removeEventListener('pointerup', up);
    win.removeEventListener('pointercancel', stop);
  };
  const up = (e: Event) => {
    stop();
    onEnd(to ?? at((e as unknown as PointerLike).clientX, (e as unknown as PointerLike).clientY));
  };
  win.addEventListener('pointermove', move);
  win.addEventListener('pointerup', up);
  win.addEventListener('pointercancel', stop);
  return stop;
}
