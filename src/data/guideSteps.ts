/**
 * The tutorial cards' scripts (GuideSection.tsx): each card plays a few steps over real frames of
 * the app, so the card shows the feature working, not one picture with one click.
 *
 * The steps are made by the capture script (scripts/capture-guide.cjs) into
 * `guideSteps.generated.ts`, which exports `GUIDE_STEPS: Record<string, GuideStep[]>` keyed by the
 * card id in data/guide.ts. Never place pointer points by hand in shipped data. A card with no
 * steps there plays its single screenshot as before.
 *
 * How a script plays:
 * - `steps[0].frame` is on screen before anything moves. After step i is done, `steps[i].frame`
 *   shows (crossfaded in). So step 0 should be where the pointer comes in (usually 'hover'), and
 *   its frame the starting state; from step 1 on, each frame is the result of that step.
 * - The step's caption is `steps[i]` of the card in data/guide.ts (same index), when written.
 */

export type StepAction = 'click' | 'drag' | 'type' | 'key' | 'hover';

export interface GuideStep {
  action: StepAction;
  /** Where the pointer goes (a drag's start), in percent of the frame image. */
  at: { x: number; y: number };
  /** A drag's end, in percent of the frame image. */
  to?: { x: number; y: number };
  /** The text typed ('type') or the key caption shown on a keycap ('key'), e.g. "H" or "⌘F". */
  keys?: string;
  /**
   * The picture shown once this step is done: a path under `src/assets/guide/` (extension optional,
   * e.g. "steps/find/2.jpg"), or an absolute URL.
   */
  frame: string;
}

export type GuideSteps = Record<string, GuideStep[]>;
