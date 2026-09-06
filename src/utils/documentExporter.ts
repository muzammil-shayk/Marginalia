/** An inline bold/highlight/underline/circle mark over a character range within a paragraph. */
export interface CustomFormat {
  id: string;
  paragraphIndex: number;
  start: number;
  end: number;
  type: 'bold' | 'highlight' | 'underline' | 'circle';
  color?: string;
  /** Border thickness in px, only meaningful for the 'circle' type. */
  thickness?: number;
  /** References `UserSettings.activeThemes[].id`, or `null` when untagged. */
  themeId: string | null;
}
