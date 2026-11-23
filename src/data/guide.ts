/**
 * "Getting the most from Marginalia": the guide at the foot of My Collections (2.8.0).
 *
 * Every picture is a real screenshot of the app, made by `scripts/capture-guide.cjs` (run it after
 * changing anything shown here: `npm run guide:capture`). Each entry's `id` is its image's file
 * name in `src/assets/guide/`.
 */

import { GUIDE_POINTS } from './guidePoints';

export type GuideGroupId = 'reading' | 'toolbar' | 'marking' | 'notes' | 'themes' | 'finding' | 'exporting';

export interface GuideFeature {
  id: string;
  title: string;
  caption: string;
  /**
   * Where the card's picture zooms and the pointer clicks while it plays (tutorial deck):
   * x and y in percent of the screenshot, zoom the scale it reaches. Re-check after a re-capture.
   */
  focus?: { x: number; y: number; zoom: number };
  /**
   * For a toolbar card: where its tool's button is. The pointer clicks it first, then the picture
   * zooms to `focus`, the mark the tool made. Measured by the capture script (guidePoints.ts).
   */
  tool?: { x: number; y: number };
  /** A list of keys shown in place of a picture (the keyboard shortcuts card). */
  keys?: { keys: string; does: string; demo: ShortcutDemo }[];
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl+';

/** The little scene the shortcuts card plays for each key (GuideSection.tsx). */
export type ShortcutDemo = 'collapse' | 'highlight' | 'underline' | 'strike' | 'area' | 'pen' | 'note' | 'selectErase' | 'theme' | 'turn' | 'find' | 'focus' | 'undo' | 'delete' | 'escape' | 'noteKeys' | 'palette';

/** The keys the app answers to, as the workspace and reader define them (workspaceKeys.ts, FocusMode, FindBar). */
export const SHORTCUTS: { keys: string; does: string; demo: ShortcutDemo }[] = [
  { keys: 'H', does: 'Highlight: drag across words and they are highlighted', demo: 'highlight' },
  { keys: 'U', does: 'Underline the words you drag across', demo: 'underline' },
  { keys: 'S', does: 'Strike out the words you drag across', demo: 'strike' },
  { keys: 'A', does: 'Area highlight: drag a box over a figure or a scanned page (PDF)', demo: 'area' },
  { keys: 'P', does: 'Pen: draw freehand on the page (PDF)', demo: 'pen' },
  { keys: 'N', does: 'Sticky note: click where it goes, then write (PDF)', demo: 'note' },
  { keys: 'Enter · Shift+Enter', does: 'Writing a note: Enter saves it, Shift+Enter starts a new line', demo: 'noteKeys' },
  { keys: 'V · E', does: 'Select a mark to change it; erase a mark with a click (PDF)', demo: 'selectErase' },
  { keys: '1 – 9', does: 'File new marks under that theme; over a selected mark, turn the theme on or off', demo: 'theme' },
  { keys: '← →', does: 'Turn the pages of a two-page spread (Page Up and Page Down too)', demo: 'turn' },
  { keys: `${MOD}F`, does: 'Find words in the open document and step through them', demo: 'find' },
  { keys: 'F', does: 'Focus mode: everything but the page steps back', demo: 'focus' },
  { keys: 'T', does: 'In focus mode: bring the tools in from the side of the window, or put them away', demo: 'palette' },
  { keys: 'C', does: 'Collapse to marks: only what you marked stays, the rest folds away', demo: 'collapse' },
  { keys: `${MOD}Z · ${MOD}Shift+Z`, does: 'Undo the last change, then redo it (Ctrl+Y redoes on Windows too)', demo: 'undo' },
  { keys: 'Delete', does: 'Remove the selected mark', demo: 'delete' },
  { keys: 'Esc', does: 'Put the tool down and close an open menu', demo: 'escape' }
];

export interface GuideGroup {
  id: GuideGroupId;
  title: string;
  features: GuideFeature[];
}

/** Toolbar cards: their points come from guidePoints.ts, so only the zoom is set here. */
const at = (zoom: number) => ({ x: 50, y: 50, zoom });

const GROUPS: GuideGroup[] = [
  {
    id: 'reading',
    title: 'Reading',
    features: [
      { id: 'shelf', title: 'Your shelf', caption: 'Everything you add stands on My Readings, with how far you have read. Click a spine, then Read.', focus: { x: 58, y: 62, zoom: 1.6 } },
      { id: 'reader', title: 'A page to read and mark', caption: 'Text, EPUB, DOCX and pasted excerpts open in the reader, with your tools along the top.', focus: { x: 47, y: 61, zoom: 1.5 } },
      { id: 'spread', title: 'Two pages, turned like a book', caption: 'The open-book button shows two pages. Turn with the arrows at the edges, the arrow keys, or a sideways swipe.', focus: { x: 91.7, y: 16.7, zoom: 1.5 } },
      { id: 'poetry', title: 'Poetry view', caption: 'The feather button keeps a poem’s lines, numbers its lines or couplets, and underlines the rhymes.', focus: { x: 38.9, y: 16.7, zoom: 1.6 } },
      { id: 'pdfgrid', title: 'One, two, four or six PDF pages', caption: 'In a PDF, choose 1 page, 2 as a book, 4 or 6 in view, or Fit page. In 4 or 6, click a page to open it at reading size.', focus: { x: 40, y: 40, zoom: 1.4 } },
      { id: 'focus', title: 'Focus mode', caption: 'Press F (or the focus button) and everything but the page steps back. Your tools wait at the side of the window: move the pointer to that edge, or press T, and they fade in. Drag them by the grip to either side. Esc brings it all back.', focus: { x: 31, y: 41, zoom: 1.4 } }
    ]
  },
  {
    id: 'toolbar',
    title: 'Toolbar',
    features: [
      { id: 'tool-select', title: 'Select', caption: 'The arrow picks up a mark you have made: click it to recolour, restyle or link it, or drag it and its corners to move or resize it.', focus: at(1.4) },
      { id: 'tool-highlight', title: 'Highlight', caption: 'Press H, then drag across words: they are highlighted in the theme you are tagging with. TXT, EPUB and DOCX books have the same button.', focus: at(1.5) },
      { id: 'tool-area', title: 'Area highlight', caption: 'Drag a box over a figure, a table or a scanned page with no text, and the whole area is highlighted.', focus: at(1.4) },
      { id: 'tool-underline', title: 'Underline', caption: 'Press U and drag across words to underline them in the theme’s colour.', focus: at(1.6) },
      { id: 'tool-strikeout', title: 'Strike out', caption: 'Press S and drag across words to strike them through: a claim you doubt, or a word to cut.', focus: at(1.6) },
      { id: 'tool-pen', title: 'Pen', caption: 'Press P and draw freehand: a squiggle under a line, a ring round a word. Its options set colour, thickness and dashes.', focus: at(1.5) },
      { id: 'tool-inkarrow', title: 'Freehand arrow', caption: 'Draw a curve by hand, round the text in the way, and an arrowhead lands where you lift the pen, pointing the way the line was heading. Its options set colour, thickness and dashes.', focus: at(1.6) },
      { id: 'blackout', title: 'Black it out', caption: 'Hide words or anything on the page. In its options pick Words (select text), Box (drag) or Freehand (draw); on a scanned page Words draws a box. Export can remove the hidden words from the PDF too.', focus: at(1.6) },
      { id: 'tool-rect', title: 'Rectangle', caption: 'Drag a rectangle round a passage. Its options set colour, thickness, and solid, dashed or dotted lines.', focus: at(1.4) },
      { id: 'tool-ellipse', title: 'Ellipse', caption: 'Drag an ellipse to ring a word or a phrase.', focus: at(1.8) },
      { id: 'tool-arrow', title: 'Arrow', caption: 'Drag from where the arrow starts to what it points at, to tie a thought to a line.', focus: at(1.6) },
      { id: 'tool-line', title: 'Line', caption: 'Drag a straight line: a rule under a paragraph, or a stroke down the margin.', focus: at(1.5) },
      { id: 'tool-bracket', title: 'Bracket', caption: 'Drag down beside the lines you mean and a brace gathers them, on the left or the right as set in its options.', focus: at(1.8) },
      { id: 'tool-note', title: 'Sticky note', caption: 'Press N and click to place a note, then write in it: Enter saves, Shift+Enter starts a new line, or press Save. Three styles in its options: outline, solid or see-through. Its colour is the theme it is filed under: with the starting themes, green is Key Concepts, violet Questions, orange Metaphors.', focus: at(1.3) },
      { id: 'tool-text', title: 'Text box', caption: 'Drag a box and write straight onto the page. Pick Hand in its options for handwriting; size, bold, italic, alignment and colour are there too. Select a box later to change any of them.', focus: at(1.3) },
      { id: 'tool-erase', title: 'Erase', caption: 'Press E and click any mark to remove it. Undo brings it back.', focus: at(1.6) },
      { id: 'tool-undo', title: 'Undo and redo', caption: `Took back a mark, an edit or a delete? Undo with ${MOD}Z and redo with ${MOD}Shift+Z, or the curved arrows.`, focus: at(2) },
      { id: 'tool-more', title: 'The ··· menu', caption: 'Holds the rest: page up and down, zoom, fit to width or page, 1, 2, 4 or 6 pages in view, and inserting or deleting a page.', focus: at(1.7) },
      { id: 'tool-addnote', title: 'Add a note', caption: 'In a TXT, EPUB or DOCX book, + writes a note on the paragraph you are reading, with a title and quote if you like. Enter saves it, Shift+Enter starts a new line.', focus: at(1.3) },
      { id: 'tool-collapse', title: 'Collapse to marks', caption: 'Press C, or the pinch button, and the document folds shut around what you marked: one theme, notes, terminology or Find hits if you like, with a little context around each. Open any fold, or read on from it.', focus: at(1.4) },
      { id: 'tool-notes', title: 'Marks and notes', caption: 'The pill counts the document’s marks and notes. Click it to show or hide the notes in the margin.', focus: at(1.5) }
    ]
  },
  {
    id: 'marking',
    title: 'Marking',
    features: [
      { id: 'popover', title: 'Select words to mark them', caption: 'Select a passage and a menu appears: pick a theme, then highlight, underline, strike out, react, or write a sticky note.', focus: { x: 87, y: 45, zoom: 1.6 } },
      { id: 'overlap', title: 'One passage, several themes', caption: 'Turn on more than one theme in the selection menu, or mark the same words again under another theme: the mark is filed under each, with a small dot for every extra theme.', focus: { x: 10, y: 20, zoom: 1.6 } },
      { id: 'terminology', title: 'Terminology', caption: 'The tag button marks a term or piece of jargon, always in the terminology colour set in Settings, and gathers terms in My Margins Tracker.', focus: { x: 14, y: 20, zoom: 1.8 } },
      { id: 'ocr', title: 'Scanned pages', caption: 'A page that is only a picture has no words to select. Select on it as usual and its words are read on your computer first, then your selection is made; the text-cursor button in the toolbar reads the whole document. Then highlight, underline and Find work there. Scans are read in English; Urdu and other right-to-left books aren’t supported yet. Inserting or deleting a page clears what was read.', focus: { x: 50, y: 30, zoom: 1.5 } },
      { id: 'pdftools', title: 'Drawing on a PDF', caption: 'Pen, shapes, arrows, brackets, sticky notes, text boxes and area highlights over figures and tables.', focus: { x: 33.5, y: 9.5, zoom: 1.7 } },
      { id: 'links', title: 'Linked marks', caption: 'Link two marks that answer each other, even pages apart, and jump from one to the other.', focus: { x: 92, y: 65.7, zoom: 1.7 } },
      { id: 'shortcuts', title: 'Keyboard shortcuts', caption: 'Each shortcut in turn: the keys, what they do, and the effect on a page. Click the dots to pick one.', keys: SHORTCUTS }
    ]
  },
  {
    id: 'notes',
    title: 'Notes',
    features: [
      { id: 'margin', title: 'Notes in the margin', caption: 'A sticky note sits in the margin level with its line, and lights up the words it is about.', focus: { x: 85, y: 90, zoom: 1.6 } },
      { id: 'board', title: 'Excerpt board', caption: 'Pull marked passages onto a board, set them side by side, link them, and jump back to any one in the text.', focus: { x: 69, y: 65, zoom: 1.4 } }
    ]
  },
  {
    id: 'themes',
    title: 'Themes',
    features: [
      { id: 'tagging', title: 'File marks under a theme', caption: 'Choose a theme in the Tagging as strip (or press 1–9) and new marks take its colour. “+ New theme” in the selection menu makes one on the spot.', focus: { x: 28, y: 12, zoom: 2 } },
      { id: 'tracker', title: 'My Margins Tracker', caption: 'Key concepts, themes and terminology from every book, gathered on My Collections.', focus: { x: 38, y: 14, zoom: 1.4 } },
      { id: 'thememanager', title: 'Your themes', caption: 'Create, rename, recolour and delete themes in Settings.', focus: { x: 76.7, y: 7.3, zoom: 1.6 } }
    ]
  },
  {
    id: 'finding',
    title: 'Finding',
    features: [
      { id: 'find', title: 'Find in a document', caption: 'Ctrl+F (⌘F on a Mac) finds words in the open document and steps through each one.', focus: { x: 31, y: 22, zoom: 1.6 } },
      { id: 'search', title: 'Search everything', caption: 'Search looks through every document and every mark, note and theme in My Collections.', focus: { x: 34, y: 21.5, zoom: 1.5 } },
      { id: 'markspanel', title: 'The marks panel', caption: 'Every mark in the open document, grouped by theme, searchable and filtered by kind. Click one to go to it.', focus: { x: 84, y: 45, zoom: 1.4 } },
      { id: 'motif', title: 'Trace a motif', caption: 'Follow an image or idea across your collections. Each passage opens at its place with the words painted.', focus: { x: 66.8, y: 31.7, zoom: 1.5 } }
    ]
  },
  {
    id: 'exporting',
    title: 'Exporting',
    features: [
      { id: 'export', title: 'Export and the commonplace book', caption: 'Export a book’s marks as PDF, Markdown or text, or as a commonplace book: quotations by theme, cited and ready for an essay.', focus: { x: 77.3, y: 70.7, zoom: 1.5 } },
      { id: 'archive', title: 'Import and backups', caption: 'From Export: save your marks as Markdown or JSON, import marks from a JSON file, or restore one of the five automatic backups of your marks.', focus: { x: 75.4, y: 88, zoom: 1.6 } },
      { id: 'classpack', title: 'Class packs', caption: 'Save a document with your marks as one file for students. They open it from Add Document, with no account and no internet.', focus: { x: 77.2, y: 77.7, zoom: 1.6 } }
    ]
  }
];

/** Every group, toolbar cards carrying the points the capture script measured. */
export const GUIDE_GROUPS: GuideGroup[] = GROUPS.map((g) => ({
  ...g,
  features: g.features.map((f) => {
    const p = GUIDE_POINTS[f.id];
    return p ? { ...f, tool: p.tool, focus: { ...p.focus, zoom: f.focus?.zoom ?? 1.6 } } : f;
  })
}));

/** Every feature's image name, in the order the capture script makes them. */
export const GUIDE_IMAGE_IDS = GUIDE_GROUPS.flatMap((g) => g.features.map((f) => f.id));
