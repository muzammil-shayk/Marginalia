/**
 * Where each margin note goes. Pure, tested.
 *
 * Every note wants to sit level with the first line of the words it is about (`desired`, px from
 * the top of the text column). Notes are laid out top to bottom in that order, and one that would
 * overlap the note above it moves down just far enough to clear it, so a run of notes on nearby
 * lines stacks in the margin instead of piling on top of each other.
 */

export interface MarginItem {
  id: string;
  desired: number;
  height: number;
}

export function stackMargin(items: MarginItem[], gap = 8): { tops: Map<string, number>; bottom: number } {
  const tops = new Map<string, number>();
  let bottom = -Infinity;
  const sorted = [...items].sort((a, b) => a.desired - b.desired || a.id.localeCompare(b.id));
  for (const it of sorted) {
    const top = Math.max(it.desired, bottom + gap);
    tops.set(it.id, top);
    bottom = top + it.height;
  }
  return { tops, bottom: sorted.length ? bottom : 0 };
}
