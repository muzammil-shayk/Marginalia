/**
 * Document Exporter Utility
 * Calls the backend /api/download endpoint to export annotated documents.
 */

export interface UserAnnotation {
  id?: string;
  paragraphIndex: number;
  start?: number;
  end?: number;
  noteText: string;
  timestamp: string;
  color?: string;
}

export interface CustomFormat {
  paragraphIndex: number;
  start: number;
  end: number;
  type: 'bold' | 'highlight' | 'underline';
  color?: string;
}

export interface PreviewTheme {
  id: string;
  title: string;
  color: string;
  excerpts: string[];
  keyQuote?: string;
  mentionsCount?: number;
  confidenceLabel?: string;
}

export async function exportAnnotatedDocument(payload: {
  title: string;
  text?: string;
  themes?: PreviewTheme[];
  annotations: UserAnnotation[];
  customFormats?: CustomFormat[];
  format: 'pdf' | 'txt' | 'html' | 'docx';
}) {
  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    // Open in a new tab for preview
    // The browser's native PDF/HTML viewer will handle it and provide a download button
    window.open(url, '_blank');
    
    // Clean up the URL object after a short delay to ensure the new tab has time to load it
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.error('Download failed:', err);
    alert('Failed to generate download. Please try again later.');
  }
}
