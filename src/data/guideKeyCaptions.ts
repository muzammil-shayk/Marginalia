/**
 * Draft captions for the shortcuts card's step scripts (`key-<demo>` in guideSteps.generated.ts):
 * one per step, in the same order as the steps (tested in captureGuideSteps.test.ts).
 */
export const KEY_STEP_CAPTIONS: Record<string, string[]> = {
  'key-highlight': ['Point at the words', 'Press H for Highlight', 'Drag across the words: they are highlighted'],
  'key-underline': ['Point at the words', 'Press U for Underline', 'Drag across the words: they are underlined'],
  'key-strike': ['Point at the words', 'Press S for Strike out', 'Drag across the words: they are struck out'],
  'key-area': ['Point at the corner of the figure', 'Press A for Area highlight', 'Drag a box over the figure: it is highlighted'],
  'key-pen': ['Point where the line starts', 'Press P for the Pen', 'Draw on the page: the line stays'],
  'key-note': ['Point where the note goes', 'Press N for Sticky note', 'Click the page', 'Type the note', 'Press Enter: the note is saved'],
  'key-noteKeys': ['Point where the note goes', 'Click the page', 'Type the first line', 'Press Shift+Enter: the next words start a new line', 'Press Enter: the note is saved'],
  'key-selectErase': ['Point at a mark', 'Press V for Select', 'Click the mark to select it', 'Press E for Erase', 'Click another mark: it is erased'],
  'key-theme': ['Point at the words', 'Press H for Highlight', 'Press 2 to tag with theme 2', 'Drag across the words: they take theme 2’s colour', 'Click the mark to select it', 'Press 3: the mark joins theme 3'],
  'key-turn': ['Point at the pages', 'Press → to turn the page', 'Press → again', 'Press ← to turn back: the earlier pages return'],
  'key-find': ['Point at the page', 'Press Cmd/Ctrl+F to open Find', 'Type a word', 'Press Enter: the next match'],
  'key-focus': ['Point at the page', 'Press F: everything but the page steps back'],
  'key-palette': ['Point at the page', 'Press F for focus mode', 'Press T: the tools fade in'],
  'key-collapse': ['Point at the page', 'Press C: only your marks stay'],
  'key-undo': ['Point at the words', 'Press H for Highlight', 'Drag across the words', 'Press Cmd/Ctrl+Z: the highlight goes', 'Press Cmd/Ctrl+Shift+Z: it is back'],
  'key-delete': ['Point at a mark', 'Press V for Select', 'Click the mark to select it', 'Press Delete: the mark is gone'],
  'key-escape': ['Point at the page', 'Press P for the Pen', 'Press Esc to put it down', 'Click ··· to open the menu', 'Press Esc: the menu closes']
};
