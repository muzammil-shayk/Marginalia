import { jsPDF } from 'jspdf';
import { StickyNote } from '../types';

/** The global theme list, just enough of it to resolve an id to a display name. */
export type ThemeRef = { id: string; name: string };

export interface ExportOptions {
  bookTitle: string;
  bookAuthor: string;
  bookChapter?: string;
  /** A theme id, or 'All' — filtering is by id so a later rename doesn't silently break it. */
  themeFilter?: string;
  themes: ThemeRef[];
  format: 'pdf' | 'markdown' | 'txt';
  includeQuotes: boolean;
}

function themeName(themeId: string | null | undefined, themes: ThemeRef[]): string {
  return themes.find((t) => t.id === themeId)?.name || 'General';
}

/**
 * Filter annotations based on user selection
 */
export function getFilteredAnnotations(
  notes: StickyNote[],
  themeFilter: string = 'All'
): StickyNote[] {
  return notes.filter((note) => {
    if (themeFilter !== 'All' && note.themeId !== themeFilter) return false;
    return true;
  });
}

/**
 * Generate formatted plain text representation
 */
export function generatePlainText(notes: StickyNote[], options: ExportOptions): string {
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let output = `=================================================================\n`;
  output += `  MARGINALIA - ANNOTATIONS & MARGIN NOTES\n`;
  output += `=================================================================\n\n`;
  output += `Title:    ${options.bookTitle}\n`;
  output += `Author:   ${options.bookAuthor}\n`;
  if (options.bookChapter) output += `Chapter:  ${options.bookChapter}\n`;
  output += `Exported: ${dateStr}\n`;
  output += `Total:    ${notes.length} annotation(s)\n`;
  output += `Theme:    ${!options.themeFilter || options.themeFilter === 'All' ? 'All' : themeName(options.themeFilter, options.themes)}\n\n`;
  output += `-----------------------------------------------------------------\n\n`;

  notes.forEach((note, idx) => {
    output += `${idx + 1}. ${note.title}\n`;
    output += `   Theme:     ${themeName(note.themeId, options.themes)}\n`;
    output += `   Author:    ${note.author || 'Reader'}\n`;
    output += `   Date:      ${note.timestamp}\n`;

    if (note.quote && options.includeQuotes) {
      output += `\n   Passage Excerpt:\n`;
      output += `   "${note.quote}"\n`;
    }

    output += `\n   Annotation Note:\n`;
    output += `   ${note.content}\n`;

    output += `\n-----------------------------------------------------------------\n\n`;
  });

  return output;
}

/**
 * Generate structured Markdown representation
 */
export function generateMarkdown(notes: StickyNote[], options: ExportOptions): string {
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let md = `# Marginalia Notes: ${options.bookTitle}\n\n`;
  md += `**Author:** ${options.bookAuthor}  \n`;
  if (options.bookChapter) md += `**Chapter:** ${options.bookChapter}  \n`;
  md += `**Export Date:** ${dateStr}  \n`;
  md += `**Total Annotations:** ${notes.length}  \n\n`;
  md += `---\n\n`;

  notes.forEach((note, idx) => {
    md += `### ${idx + 1}. ${note.title}\n\n`;
    md += `- **Theme:** ${themeName(note.themeId, options.themes)}\n`;
    md += `- **Author:** ${note.author || 'Reader'} (${note.timestamp})\n`;
    md += `\n`;

    if (note.quote && options.includeQuotes) {
      md += `> "${note.quote}"\n\n`;
    }

    md += `${note.content}\n\n`;

    md += `---\n\n`;
  });

  return md;
}

/**
 * Export annotations as a beautifully formatted PDF document
 */
export function exportToPDF(notes: StickyNote[], options: ExportOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addNewPageIfNeeded = (requiredHeight: number) => {
    if (y + requiredHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeaderFooter();
    }
  };

  const drawHeaderFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text('Marginalia — Reader Annotations', margin, 12);
    const pageNumber = doc.getNumberOfPages();
    doc.text(`Page ${pageNumber}`, pageWidth - margin, 12, { align: 'right' });
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, 14, pageWidth - margin, 14);
  };

  // First page banner
  drawHeaderFooter();
  y = 24;

  // Title & Header Styling
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(28, 35, 33);
  doc.text(options.bookTitle, margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  const subtitle = `By ${options.bookAuthor}${options.bookChapter ? ` • ${options.bookChapter}` : ''}`;
  doc.text(subtitle, margin, y);
  y += 6;

  // Meta metadata bar
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.text(`Exported: ${dateStr}  |  Total Notes: ${notes.length}`, margin, y);
  y += 4;

  // Divider line
  doc.setDrawColor(67, 92, 82);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  if (notes.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text('No annotations match the selected export filter.', margin, y);
    doc.save(`marginalia-annotations-${sanitizeFilename(options.bookTitle)}.pdf`);
    return;
  }

  // Iterate over notes
  notes.forEach((note, index) => {
    // Estimate note height
    const quoteLines = note.quote && options.includeQuotes
      ? doc.splitTextToSize(`"${note.quote}"`, contentWidth - 8)
      : [];
    const contentLines = doc.splitTextToSize(note.content, contentWidth - 4);

    const estimatedHeight =
      12 + // title
      6 + // meta tags
      (quoteLines.length * 4.5 + (quoteLines.length > 0 ? 4 : 0)) +
      (contentLines.length * 5 + 4) +
      8; // padding and spacing

    addNewPageIfNeeded(estimatedHeight);

    // Note Card Background Box
    const cardTop = y;
    doc.setFillColor(250, 249, 246);
    doc.setDrawColor(210, 205, 195);
    doc.setLineWidth(0.3);

    // Note Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(28, 35, 33);
    const titleText = `${index + 1}. ${note.title}`;
    doc.text(titleText, margin + 3, y + 5);

    y += 9;

    // Meta line (Theme Tag, Author, Timestamp)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    const themeLabel = `Theme: ${themeName(note.themeId, options.themes)}  •  Author: ${note.author || 'Reader'}  •  ${note.timestamp}`;
    doc.text(themeLabel, margin + 3, y);
    y += 5;

    // Quote Block (if exists)
    if (note.quote && options.includeQuotes) {
      doc.setFillColor(235, 233, 227);
      doc.rect(margin + 2, y, contentWidth - 4, quoteLines.length * 4.5 + 2, 'F');

      doc.setDrawColor(67, 92, 82);
      doc.setLineWidth(1);
      doc.line(margin + 2, y, margin + 2, y + quoteLines.length * 4.5 + 2);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);
      doc.text(quoteLines, margin + 6, y + 3.5);
      y += quoteLines.length * 4.5 + 5;
    }

    // Annotation Content Text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(contentLines, margin + 3, y + 2);
    y += contentLines.length * 5 + 4;

    // Draw outline of box
    const cardHeight = y - cardTop;
    doc.rect(margin, cardTop, contentWidth, cardHeight, 'S');

    y += 6; // gap between notes
  });

  // Trigger browser download
  const filename = `marginalia-annotations-${sanitizeFilename(options.bookTitle)}.pdf`;
  doc.save(filename);
}

/**
 * Helper to download text / markdown file to disk
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').slice(0, 30);
}
