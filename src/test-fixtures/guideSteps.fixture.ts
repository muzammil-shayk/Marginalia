/**
 * Test-only scripts for the tutorial player's pure logic (guideDeck.test.ts). Hand-placed
 * points; the frame names are placeholders and no picture is loaded. Never shipped. The real scripts come from scripts/capture-guide.cjs (data/guideSteps.generated.ts).
 */

import type { GuideSteps } from '../data/guideSteps';

export const GUIDE_STEPS_FIXTURE: GuideSteps = {
  'tool-highlight': [
    { action: 'hover', at: { x: 30, y: 20 }, frame: 'pdftools.jpg' },
    { action: 'click', at: { x: 21.3, y: 8.9 }, frame: 'pdftools.jpg' },
    { action: 'drag', at: { x: 38, y: 33.6 }, to: { x: 68, y: 33.6 }, frame: 'tool-highlight.jpg' }
  ],
  'tool-note': [
    { action: 'hover', at: { x: 60, y: 20 }, frame: 'pdftools.jpg' },
    { action: 'click', at: { x: 52.8, y: 8.9 }, frame: 'pdftools.jpg' },
    { action: 'click', at: { x: 50, y: 49 }, frame: 'tool-note.jpg' },
    { action: 'type', at: { x: 50, y: 49 }, keys: 'Answer it', frame: 'tool-note.jpg' }
  ],
  find: [
    { action: 'hover', at: { x: 50, y: 60 }, frame: 'reader.jpg' },
    { action: 'key', at: { x: 50, y: 60 }, keys: '⌘F', frame: 'find.jpg' },
    { action: 'type', at: { x: 31, y: 22 }, keys: 'margin', frame: 'find.jpg' },
    { action: 'click', at: { x: 29.5, y: 66.7 }, frame: 'find.jpg' }
  ],
  'key-highlight': [
    { action: 'hover', at: { x: 50, y: 55 }, frame: 'reader.jpg' },
    { action: 'key', at: { x: 50, y: 55 }, keys: 'H', frame: 'reader.jpg' },
    { action: 'drag', at: { x: 38, y: 33.6 }, to: { x: 68, y: 33.6 }, frame: 'tool-highlight.jpg' }
  ],
  'key-find': [
    { action: 'hover', at: { x: 50, y: 60 }, frame: 'reader.jpg' },
    { action: 'key', at: { x: 50, y: 60 }, keys: 'Mod+F', frame: 'find.jpg' },
    { action: 'type', at: { x: 31, y: 22 }, keys: 'margin', frame: 'find.jpg' }
  ],
  'key-undo': [
    { action: 'hover', at: { x: 50, y: 50 }, frame: 'tool-highlight.jpg' },
    { action: 'key', at: { x: 50, y: 50 }, keys: 'Mod+Z', frame: 'pdftools.jpg' },
    { action: 'key', at: { x: 50, y: 50 }, keys: 'Mod+Shift+Z', frame: 'tool-highlight.jpg' }
  ]
};
