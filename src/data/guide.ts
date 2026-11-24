/**
 * "Getting the most from Marginalia": the guide at the foot of My Collections (2.8.0).
 *
 * Every card plays real frames of the app, made by `scripts/capture-guide.cjs` (run it after
 * changing anything shown here: `npm run guide:capture`). Each entry's `id` names its step script
 * (data/guideSteps.generated.ts) and its frames in `src/assets/guide/steps/<id>/`.
 */

export type GuideGroupId = 'reading' | 'toolbar' | 'marking' | 'notes' | 'themes' | 'finding' | 'exporting';

export interface GuideFeature {
  id: string;
  title: string;
  caption: string;
  /** How far the picture zooms in on each step while the card plays (1.5 if unset). */
  zoom?: number;
  /**
   * One caption per step of the card's script (data/guideSteps.ts), same order. Until written,
   * the player names each step plainly ("Click", "Press H").
   */
  steps?: string[];
  /** A list of keys shown in place of a picture (the keyboard shortcuts card). */
  keys?: { keys: string; does: string; demo: ShortcutDemo }[];
}

export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl+';

/** Which shortcut a row is: its script is `key-<demo>` in data/guideSteps.generated.ts (GuideSection.tsx). */
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

export const GUIDE_GROUPS: GuideGroup[] = [
  {
    id: 'reading',
    title: 'Reading',
    features: [
      { id: 'shelf', title: 'Your shelf', caption: 'Everything you add stands on My Readings, with how far you have read. Click a spine, then Read.', zoom: 1.6, steps: ['Point at a book on the shelf', 'Click its spine: it opens on the desk', 'Click Read: the book opens'] },
      { id: 'reader', title: 'A page to read and mark', caption: 'Text, EPUB, DOCX and pasted excerpts open in the reader, with your tools along the top.', zoom: 1.5, steps: ['Point at the Highlight tool', 'Click Highlight', 'Drag across the words: they are highlighted'] },
      { id: 'spread', title: 'Two pages, turned like a book', caption: 'The open-book button shows two pages. Turn with the arrows at the edges, the arrow keys, or a sideways swipe.', zoom: 1.5, steps: ['Point at the open-book button', 'Click it: two pages, like a book', 'Click the arrow at the edge to turn', 'Press → to turn again: the next pages show'] },
      { id: 'poetry', title: 'Poetry view', caption: 'The feather button keeps a poem’s lines, numbers its lines or couplets, and underlines the rhymes.', zoom: 1.6, steps: ['Point at the feather', 'Click it to open Poetry view', 'Click Read this as a poem: the rhymes are underlined', 'Click Lines: every line is numbered', 'Close it: the poem keeps its numbers and underlined rhymes'] },
      { id: 'pdfgrid', title: 'One, two, four or six PDF pages', caption: 'In a PDF, choose 1 page, 2 as a book, 4 or 6 in view, or Fit page. In 4 or 6, click a page to open it at reading size.', zoom: 1.4, steps: ['Point at the ··· button', 'Click ···', 'Click 4 pages', 'Click a page to open it at reading size'] },
      { id: 'focus', title: 'Focus mode', caption: 'Read with nothing else on screen. Press F (or the focus button); your tools wait at the side of the window and fade in at that edge or on T. Drag them by the grip to either side. Esc brings it all back.', zoom: 1.4, steps: ['Point at the focus button', 'Click it: the page steps forward', 'Point at the left edge: the tools fade in', 'Click Highlight', 'Drag across the words', 'Press Esc: the toolbar returns and the highlight stays'] }
    ]
  },
  {
    id: 'toolbar',
    title: 'Toolbar',
    features: [
      { id: 'tool-select', title: 'Select', caption: 'The arrow picks up a mark you have made: click it to recolour, restyle or link it, or drag it and its corners to move or resize it.', zoom: 1.4, steps: ['Point at the Select arrow', 'Click Select', 'Click the box to select it', 'Click red to recolour it', 'Drag it up round the paragraph: the box frames the text'] },
      { id: 'tool-highlight', title: 'Highlight', caption: 'Mark a passage in the theme you are tagging with, so you can find it again. Press H. TXT, EPUB and DOCX books have the same button.', zoom: 1.5, steps: ['Point at the Highlight tool', 'Click Highlight', 'Drag across the words: they are highlighted'] },
      { id: 'tool-area', title: 'Area highlight', caption: 'Drag a box over a figure, a table or a scanned page with no text, and the whole area is highlighted.', zoom: 1.4, steps: ['Point at Area highlight', 'Click Area highlight', 'Drag a box over the figure: it is highlighted'] },
      { id: 'tool-underline', title: 'Underline', caption: 'Press U and drag across words to underline them in the theme’s colour.', zoom: 1.6, steps: ['Point at the Underline tool', 'Click Underline', 'Pick the Questions theme', 'Drag across the words: they are underlined'] },
      { id: 'tool-strikeout', title: 'Strike out', caption: 'Press S and drag across words to strike them through: a claim you doubt, or a word to cut.', zoom: 1.6, steps: ['Point at Strike out', 'Click Strike out', 'Drag across the words: they are struck out'] },
      { id: 'tool-pen', title: 'Pen', caption: 'Press P and draw freehand: a squiggle under a line, a ring round a word. Its options set colour, thickness and line style.', zoom: 1.5, steps: ['Point at the Pen', 'Click the Pen', 'Pick a colour', 'Pick a thickness', 'Pick a dashed line', 'Draw a squiggle under the line: it stays, dashed'] },
      { id: 'tool-inkarrow', title: 'Freehand arrow', caption: 'Draw a curve by hand, round the text in the way, and an arrowhead lands where you lift the pen, pointing the way the line was heading. Its options set colour, thickness and line style.', zoom: 1.6, steps: ['Point at the Freehand arrow', 'Click the Freehand arrow', 'Pick a colour', 'Pick a thickness', 'Pick a dotted line', 'Draw a curve to the words: an arrowhead lands where you lift'] },
      { id: 'blackout', title: 'Black it out', caption: 'Hide words or anything on the page. In its options pick Words (select text), Box (drag) or Freehand (draw); on a scanned page Words draws a box. Export can remove the hidden words from the PDF too.', zoom: 1.6, steps: ['Point at Black it out', 'Click Black it out', 'Pick Words', 'Drag across the words: they are blacked out'] },
      { id: 'tool-rect', title: 'Rectangle', caption: 'Drag a rectangle round a passage. Its options set colour, thickness, and solid, dashed or dotted lines.', zoom: 1.4, steps: ['Point at the Rectangle', 'Click the Rectangle', 'Pick a colour', 'Pick a thickness', 'Pick a dashed line', 'Drag round the paragraph: it is boxed'] },
      { id: 'tool-ellipse', title: 'Ellipse', caption: 'Drag an ellipse to ring a word or a phrase.', zoom: 1.8, steps: ['Point at the Ellipse', 'Click the Ellipse', 'Pick a colour', 'Drag round the phrase: it is ringed'] },
      { id: 'tool-arrow', title: 'Arrow', caption: 'Drag from where the arrow starts to what it points at, to tie a thought to a line.', zoom: 1.6, steps: ['Point at the Arrow', 'Click the Arrow', 'Drag from the margin to the words: an arrow points at them'] },
      { id: 'tool-line', title: 'Line', caption: 'Drag a straight line: a rule under a paragraph, or a stroke down the margin.', zoom: 1.5, steps: ['Point at the Line', 'Click the Line', 'Drag under the paragraph: a straight line is drawn'] },
      { id: 'tool-bracket', title: 'Bracket', caption: 'Drag down beside the lines you mean and a brace gathers them, on the left or the right as set in its options.', zoom: 1.8, steps: ['Point at the Bracket', 'Click the Bracket', 'Pick the right side', 'Drag down beside the lines: a brace gathers them'] },
      { id: 'tool-note', title: 'Sticky note', caption: 'A thought tied to the page, filed under a theme. Press N and click to place it. Enter saves, Shift+Enter starts a new line, or press Save. Its options offer three note styles. Its colour is the theme it is filed under: with the starting themes, green is Key Concepts, violet Questions, orange Metaphors.', zoom: 1.3, steps: ['Point at the Sticky note', 'Click the Sticky note', 'Pick a note style', 'Click where the note goes', 'Type the note', 'Press Enter: the note is saved and sits on the page'] },
      { id: 'tool-text', title: 'Text box', caption: 'Drag a box and write straight onto the page. Pick Hand in its options for handwriting; size, bold, italic, alignment and colour are there too. Select a box later to change any of them.', zoom: 1.3, steps: ['Point at the Text box', 'Click the Text box', 'Pick Hand', 'Drag out a box', 'Type in it', 'Click Save: the text sits on the page in handwriting'] },
      { id: 'tool-erase', title: 'Erase', caption: 'Press E and click any mark to remove it. Undo brings it back.', zoom: 1.6, steps: ['Point at Erase', 'Click Erase', 'Click the mark: it is gone'] },
      { id: 'tool-undo', title: 'Undo and redo', caption: `Took back a mark, an edit or a delete? Undo with ${MOD}Z and redo with ${MOD}Shift+Z, or the curved arrows.`, zoom: 2, steps: ['Point at Highlight', 'Click Highlight', 'Drag across the words', 'Click Undo: the mark goes', 'Click Redo: it is back'] },
      { id: 'tool-more', title: 'The ··· menu', caption: 'Holds the rest: page up and down, zoom, fit to width or page, 1, 2, 4 or 6 pages in view, and inserting or deleting a page.', zoom: 1.7, steps: ['Point at the ··· button', 'Click ···', 'Click Zoom in', 'Click 4 pages: four pages show at once'] },
      { id: 'tool-addnote', title: 'Add a note', caption: 'In a TXT, EPUB or DOCX book, + writes a note on the paragraph you are reading, with a title and quote if you like. Enter saves it, Shift+Enter starts a new line.', zoom: 1.3, steps: ['Point at the + button', 'Click +', 'Type the note', 'Press Enter: the note is saved'] },
      { id: 'tool-collapse', title: 'Collapse to marks', caption: 'Press C, or the pinch button, and the document folds shut around what you marked: one theme, notes, terminology or Find hits if you like, with a little context around each. Open any fold, or read on from it.', zoom: 1.4, steps: ['Point at the pinch button', 'Click it: the text folds round your marks', 'Click a fold: the hidden paragraph opens'] },
      { id: 'tool-notes', title: 'Marks and notes', caption: 'The pill counts the document’s marks and notes. Click it to show or hide the notes in the margin.', zoom: 1.5, steps: ['Point at the marks pill', 'Click it to hide the margin notes', 'Click again to show them'] }
    ]
  },
  {
    id: 'marking',
    title: 'Marking',
    features: [
      { id: 'popover', title: 'Select words to mark them', caption: 'Select a passage and a menu appears: pick a theme, then highlight, underline, strike out, react, or write a sticky note.', zoom: 1.6, steps: ['Point at the words', 'Drag across them: the menu appears', 'Pick the Questions theme', 'Click Highlight: the words are marked'] },
      { id: 'overlap', title: 'One passage, several themes', caption: 'Turn on more than one theme in the selection menu, or mark the same words again under another theme: the mark is filed under each, with a small dot for every extra theme.', zoom: 1.6, steps: ['Point at a marked passage', 'Drag across it again', 'Pick a second theme, Memory', 'Click Highlight', 'A dot shows the extra theme'] },
      { id: 'terminology', title: 'Terminology', caption: 'The tag button marks a term or piece of jargon, always in the terminology colour set in Settings, and gathers terms in My Margins Tracker.', zoom: 1.8, steps: ['Point at the term', 'Drag across it', 'Click the tag button', 'Click My Collections', 'Choose Terminologies in the tracker', 'Click the arrow: the term is listed under its book'] },
      { id: 'ocr', title: 'Scanned pages', caption: 'A page that is only a picture has no words to select. Drag across a line on it and the page is read on your computer first, then your selection is made; the text-cursor button in the toolbar reads the whole document. After that, highlight, underline and Find work there. Scans are read in English. Inserting or deleting a page clears what was read.', zoom: 1.5, steps: ['Point at the Highlight tool', 'Click Highlight', 'Drag across a line of the scan: the page is read first', 'Then the words are highlighted'] },
      { id: 'pdftools', title: 'Drawing on a PDF', caption: 'Pen, shapes, arrows, brackets, sticky notes, text boxes and area highlights over figures and tables.', zoom: 1.7, steps: ['Point at the Pen', 'Click the Pen', 'Draw a squiggle', 'Click the Rectangle', 'Drag round the paragraph: it is boxed'] },
      { id: 'links', title: 'Linked marks', caption: 'Link two marks that answer each other, even pages apart, and jump from one to the other.', zoom: 1.7, steps: ['Point at a mark', 'Click it', 'Click Link', 'Pick the mark to link to', 'Click it under Linked: the page jumps to the other mark'] },
      { id: 'shortcuts', title: 'Keyboard shortcuts', caption: 'Each shortcut played in the app, one after another: the key, then what it does. Pick a key to watch that one.', keys: SHORTCUTS }
    ]
  },
  {
    id: 'notes',
    title: 'Notes',
    features: [
      { id: 'margin', title: 'Notes in the margin', caption: 'A sticky note sits in the margin level with its line, and lights up the words it is about.', zoom: 1.6, steps: ['Point at the line', 'Drag across the words', 'Click Sticky note', 'Type the note', 'Press Enter: the note is saved', 'Point at the note: its words light up'] },
      { id: 'board', title: 'Excerpt board', caption: 'Pull marked passages onto a board, set them side by side, link them, and jump back to any one in the text.', zoom: 1.4, steps: ['Point at the Excerpt board button', 'Click it: the board opens', 'Click a passage in the tray to place it', 'Click Link on one excerpt', 'Click another to draw the link', 'Click Show in the text: the text opens at that passage'] }
    ]
  },
  {
    id: 'themes',
    title: 'Themes',
    features: [
      { id: 'tagging', title: 'File marks under a theme', caption: 'Choose a theme in the Tagging as strip (or press 1–9) and new marks take its colour. “+ New theme” in the selection menu makes one on the spot.', zoom: 2, steps: ['Point at Metaphors in Tagging as', 'Click it', 'Click Highlight', 'Drag across words: they take its colour', 'Click Questions', 'Drag again: the new colour'] },
      { id: 'tracker', title: 'My Margins Tracker', caption: 'Key concepts, themes and terminology from every book, gathered on My Collections.', zoom: 1.4, steps: ['Point at Themes in the tracker', 'Click Themes', 'Click the arrow beside a book: its marks show under the theme', 'Click Terminologies', 'Click the arrow: the book’s term shows'] },
      { id: 'thememanager', title: 'Your themes', caption: 'Create, rename, recolour and delete themes in Settings.', zoom: 1.6, steps: ['Point at New theme', 'Click New theme', 'Type its name', 'Pick a colour', 'Click Create theme: the new theme joins the list'] }
    ]
  },
  {
    id: 'finding',
    title: 'Finding',
    features: [
      { id: 'find', title: 'Find in a document', caption: `Look up a passage without leaving the page. Press ${MOD}F; Enter steps to the next match and Esc closes Find.`, zoom: 1.6, steps: ['Point at the page', `Press ${MOD}F`, 'Type a word', 'Click Next match: it moves to the next one'] },
      { id: 'search', title: 'Search everything', caption: 'Search looks through every document and every mark, note and theme in My Collections.', zoom: 1.5, steps: ['Point at Search', 'Click Search', 'Type a word', 'Click a result: the book opens at that mark'] },
      { id: 'markspanel', title: 'The marks panel', caption: 'Every mark in the open document, grouped by theme, searchable and filtered by kind. Click one to go to it.', zoom: 1.4, steps: ['Point at the marks panel button', 'Click it to open the panel', 'Click Highlight: only highlights are listed', 'Click a mark: the page goes to it'] },
      { id: 'motif', title: 'Trace a motif', caption: 'Follow an image or idea across your collections. Each passage opens at its place with the words painted.', zoom: 1.5, steps: ['Point at Trace a motif', 'Click it', 'Type the words that carry it', 'Click Trace', 'Click a passage: it opens at its place with the words painted'] }
    ]
  },
  {
    id: 'exporting',
    title: 'Exporting',
    features: [
      { id: 'export', title: 'Export and the commonplace book', caption: 'Export a book’s marks as PDF, Markdown or text, or as a commonplace book, a notebook of quotations gathered by theme, each cited and ready for an essay.', zoom: 1.5, steps: ['Point at the export button', 'Click it to open Export', 'Keep only Key Concepts', 'Click Markdown to save the file', 'Open the saved file: your Key Concepts marks, in Markdown'] },
      { id: 'archive', title: 'Import and backups', caption: 'From Export: save your marks as Markdown or JSON, import marks from a JSON file, or restore one of the five automatic backups of your marks.', zoom: 1.6, steps: ['Point at Export', 'Click Export', 'Click Restore marks…', 'Pick a backup', 'Click Restore: the marks come back'] },
      { id: 'classpack', title: 'Class packs', caption: 'Save a document with your marks as one file for students. They open it from Add Document, with no account and no internet.', zoom: 1.6, steps: ['Point at Export', 'Click Export', 'Click Save class pack', 'Click Add Document', 'Choose the pack: it opens with its marks'] }
    ]
  }
];
