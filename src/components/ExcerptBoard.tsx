/**
 * The excerpt board, in the spirit of LiquidText: the reader's marked passages pulled out of the
 * text onto a free canvas, arranged side by side however the argument needs, joined by lines where
 * marks are linked, and each one a click away from its place in the text.
 *
 * Positions are stored on the marks themselves (`TextMark.board`), so they save, undo and travel
 * in exports with everything else. A mark with no position waits in the tray on the left.
 */

import React, { useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Link2, X } from './icons';
import type { TextMark } from '../utils/textMarks';
import { linkedIds } from '../utils/markLinks';
import { excerpt } from './MarksArchive';
import { CARD_H, CARD_W, nextFreeSlot } from './boardLayout';

export interface BoardItem {
  mark: TextMark;
  quote: string;
  color: string;
}

/** Arrow keys move a focused card this far. */
const STEP = 16;

export const ExcerptBoard: React.FC<{
  items: BoardItem[];
  /** Every mark, for the links between them. */
  marks: TextMark[];
  isDark: boolean;
  onPlace: (id: string, at: { x: number; y: number } | undefined) => void;
  onJump: (id: string) => void;
  onLink: (a: string, b: string) => void;
}> = ({ items, marks, isDark, onPlace, onJump, onLink }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; x: number; y: number } | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);

  const placed = items.filter((i) => i.mark.board);
  const tray = items.filter((i) => !i.mark.board);
  const pos = (i: BoardItem) => (drag?.id === i.mark.id ? { x: drag.x, y: drag.y } : i.mark.board!);
  const height = Math.max(640, ...placed.map((i) => pos(i).y + CARD_H + 80));
  // The board grows to the right as far as cards are put; it scrolls rather than squeezing them.
  const width = Math.max(0, ...placed.map((i) => pos(i).x + CARD_W + 24));

  const lines = useMemo(() => {
    const at = new Map(placed.map((i) => [i.mark.id, i]));
    const out: { a: string; b: string; color: string }[] = [];
    const seen = new Set<string>();
    for (const i of placed) {
      for (const other of linkedIds(marks, i.mark.id)) {
        // Either end may carry the link (an imported set can be one-sided): one line per pair.
        const key = [i.mark.id, other].sort().join(' ');
        if (!at.has(other) || seen.has(key)) continue;
        seen.add(key);
        out.push({ a: i.mark.id, b: other, color: i.color });
      }
    }
    return out;
  }, [placed, marks]);

  const toCanvas = (clientX: number, clientY: number) => {
    const box = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - box.left + canvasRef.current!.scrollLeft, y: clientY - box.top + canvasRef.current!.scrollTop };
  };
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.round(Math.max(0, Math.min(p.x, 4000)) / 4) * 4,
    y: Math.round(Math.max(0, p.y) / 4) * 4
  });

  const placeFromTray = (id: string) =>
    onPlace(id, nextFreeSlot(placed.map((i) => i.mark.board!), canvasRef.current?.clientWidth ?? 800));

  const cardClick = (id: string) => {
    if (!linkFrom) return;
    if (linkFrom !== id) onLink(linkFrom, id);
    setLinkFrom(null);
  };

  const surface = isDark ? 'bg-night-3 border-stone-700' : 'bg-white border-stone-200';

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-[640px]">
      <aside aria-label="Excerpts not on the board" className="md:w-60 shrink-0 space-y-2">
        <h3 className="caps caps-sm text-muted">Tray · {tray.length}</h3>
        {tray.length === 0 && (
          <p className="text-[12px] text-muted leading-snug">
            {items.length ? 'Every excerpt is on the board.' : 'Mark passages in the text and they wait here, ready to arrange.'}
          </p>
        )}
        <ul className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
          {tray.map((i) => (
            <li key={i.mark.id}>
              <button
                type="button"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/x-marginalia-mark', i.mark.id)}
                onClick={() => placeFromTray(i.mark.id)}
                title="Drag onto the board, or click to place it"
                className={`w-full text-left text-[12px] leading-snug px-3 py-2 rounded-xl border-l-[3px] border cursor-grab ${surface} hover:shadow-md transition-shadow`}
                style={{ borderLeftColor: i.color }}
              >
                <span dir="auto" className="line-clamp-3">{excerpt(i.quote || i.mark.text || 'Note', 140)}</span>
              </button>
            </li>
          ))}
        </ul>
        {linkFrom && (
          <p role="status" className="text-[12px] text-gold leading-snug">
            Now click the excerpt to link it to. <button type="button" className="underline cursor-pointer" onClick={() => setLinkFrom(null)}>Cancel</button>
          </p>
        )}
      </aside>

      <div
        ref={canvasRef}
        role="region"
        aria-label="Excerpt board"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const id = e.dataTransfer.getData('text/x-marginalia-mark');
          if (!id) return;
          e.preventDefault();
          const p = toCanvas(e.clientX, e.clientY);
          onPlace(id, clamp({ x: p.x - CARD_W / 2, y: p.y - 20 }));
        }}
        className={`relative flex-1 min-w-0 rounded-2xl border overflow-auto ${isDark ? 'border-stone-800 bg-night-2' : 'border-stone-200 bg-stone-50'}`}
        style={{
          backgroundImage: `radial-gradient(${isDark ? 'rgb(255 255 255 / 0.06)' : 'rgb(0 0 0 / 0.07)'} 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      >
        <div className="relative min-w-full" style={{ height, width }}>
          {placed.length === 0 && (
            <p className="absolute inset-x-0 top-1/3 text-center text-[13px] text-muted px-6">
              Drag excerpts here to set them beside each other. Link two to draw a line between them.
            </p>
          )}
          <svg aria-hidden className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            {lines.map(({ a, b, color }) => {
              const pa = pos(placed.find((i) => i.mark.id === a)!);
              const pb = pos(placed.find((i) => i.mark.id === b)!);
              return (
                <line
                  key={`${a}-${b}`}
                  x1={pa.x + CARD_W / 2}
                  y1={pa.y + CARD_H / 2}
                  x2={pb.x + CARD_W / 2}
                  y2={pb.y + CARD_H / 2}
                  stroke={color}
                  strokeOpacity="0.7"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
              );
            })}
          </svg>
          {placed.map((i) => {
            const p = pos(i);
            const id = i.mark.id;
            return (
              <div
                key={id}
                tabIndex={0}
                role="group"
                aria-label={`Excerpt: ${excerpt(i.quote || i.mark.text || 'Note')}. Arrow keys move it.`}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  const c = toCanvas(e.clientX, e.clientY);
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  setDrag({ id, dx: c.x - p.x, dy: c.y - p.y, x: p.x, y: p.y });
                }}
                onPointerMove={(e) => {
                  if (drag?.id !== id) return;
                  const c = toCanvas(e.clientX, e.clientY);
                  setDrag({ ...drag, ...clamp({ x: c.x - drag.dx, y: c.y - drag.dy }) });
                }}
                onPointerUp={() => {
                  if (drag?.id !== id) return;
                  const moved = drag.x !== i.mark.board!.x || drag.y !== i.mark.board!.y;
                  setDrag(null);
                  // One save (and one undo step) per drag, on release.
                  if (moved) onPlace(id, { x: drag.x, y: drag.y });
                  else cardClick(id);
                }}
                onKeyDown={(e) => {
                  const d = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[e.key];
                  if (d) {
                    e.preventDefault();
                    onPlace(id, clamp({ x: p.x + d[0], y: p.y + d[1] }));
                  } else if (e.key === 'Enter') cardClick(id);
                }}
                className={`absolute rounded-xl border border-l-4 p-2.5 shadow-sm select-none touch-none ${surface} ${
                  drag?.id === id ? 'shadow-xl cursor-grabbing z-10' : 'cursor-grab hover:shadow-md'
                } ${linkFrom && linkFrom !== id ? 'ring-2 ring-gold/50' : ''} ${linkFrom === id ? 'ring-2 ring-gold' : ''}`}
                style={{ left: p.x, top: p.y, width: CARD_W, minHeight: CARD_H - 20, borderLeftColor: i.color }}
              >
                <p dir="auto" className="text-[12.5px] leading-snug line-clamp-4 text-stone-800 dark:text-stone-100">
                  {i.quote ? `“${excerpt(i.quote, 220)}”` : i.mark.title || 'Note'}
                </p>
                {i.mark.text && i.quote && (
                  <p dir="auto" className="mt-1 text-[11.5px] text-muted line-clamp-2">{i.mark.text}</p>
                )}
                <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-muted">
                  <span>¶ {i.mark.anchor.paragraphIndex + 1}</span>
                  <span className="flex items-center gap-0.5">
                    <button type="button" onClick={() => onJump(id)} title="Show in the text" aria-label="Show in the text" className="p-1 rounded hover:text-gold cursor-pointer">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLinkFrom(linkFrom === id ? null : id)}
                      aria-pressed={linkFrom === id}
                      title="Link to another excerpt"
                      aria-label="Link to another excerpt"
                      className="p-1 rounded hover:text-gold cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => onPlace(id, undefined)} title="Back to the tray" aria-label="Back to the tray" className="p-1 rounded hover:text-red-600 cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
