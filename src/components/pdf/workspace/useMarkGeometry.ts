/**
 * Marks grouped by page, and the selected mark's on-screen box kept current while the page scrolls
 * (moved verbatim from PdfWorkspace).
 */

import { useState, useEffect, useMemo } from 'react';
import { Annotation, annotationBounds } from '../annotationModel';
import type { WorkspaceMarks, WorkspaceSelection, WorkspaceView } from './workspaceState';
import { pageElementAt } from './pageElement';

export interface UseMarkGeometryDeps {
  focusMode: boolean;
  marks: Pick<WorkspaceMarks, 'annotations'>;
  selection: Pick<WorkspaceSelection, 'editingId' | 'selectedId'>;
  view: Pick<WorkspaceView, 'scale' | 'scrollRef'>;
}

export function useMarkGeometry(deps: UseMarkGeometryDeps) {
  const { focusMode } = deps;
  const { annotations } = deps.marks;
  const { editingId, selectedId } = deps.selection;
  const { scale, scrollRef } = deps.view;

  const byPage = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const a of annotations) {
      const list = map.get(a.page);
      if (list) list.push(a);
      else map.set(a.page, [a]);
    }
    return map;
  }, [annotations]);

  /**
   * The selected mark's rectangle in viewport coordinates, for placing its properties menu.
   *
   * Re-measured on scroll and zoom rather than captured once, so the menu tracks the mark instead
   * of being left behind on the page. Capture phase is needed to see the viewer's own scroll
   * container, whose scroll events do not bubble.
   */
  const selectedMark = selectedId ? annotations.find((a) => a.id === selectedId) : undefined;
  const [markRect, setMarkRect] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null);

  useEffect(() => {
    if (!selectedMark) {
      setMarkRect(null);
      return;
    }
    const measure = () => {
      const bounds = annotationBounds(selectedMark);
      const pageEl = bounds && pageElementAt(scrollRef.current, selectedMark.page, bounds.y + bounds.h / 2);
      if (!pageEl || !bounds) {
        setMarkRect(null);
        return;
      }
      const box = pageEl.getBoundingClientRect();
      setMarkRect({
        left: box.left + bounds.x * box.width,
        top: box.top + bounds.y * box.height,
        right: box.left + (bounds.x + bounds.w) * box.width,
        bottom: box.top + (bounds.y + bounds.h) * box.height
      });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [selectedMark, scale]);

  const editing = editingId ? annotations.find((a) => a.id === editingId) : undefined;
  // The viewer's top edge: popovers above a passage must not climb over the toolbar. Read at
  // render, which every popover move already causes (anchor and mark rect are state).
  // In focus mode the toolbar slides over the page when called, so menus keep clear of where it lands.
  const popoverTopInset = focusMode
    ? (document.querySelector<HTMLElement>('.focus-chrome')?.offsetHeight ?? 0)
    : (scrollRef.current?.getBoundingClientRect().top ?? 0);

  return { byPage, editing, markRect, popoverTopInset, selectedMark };
}

export type MarkGeometry = ReturnType<typeof useMarkGeometry>;
