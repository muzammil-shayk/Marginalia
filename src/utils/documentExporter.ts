/**
 * Document Exporter Utility
 * Exports annotated document files (PDF default, HTML, TXT, DOCX) containing
 * exact text quote highlights, theme badges, and color-matched sticky notes.
 */

export interface UserAnnotation {
  id?: string;
  paragraphIndex: number;
  start?: number;
  end?: number;
  noteText: string;
  timestamp: string;
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

export function exportAnnotatedDocument({
  title,
  text,
  themes = [],
  annotations = [],
  customFormats = [],
  format = 'pdf'
}: {
  title: string;
  text?: string;
  themes?: PreviewTheme[];
  annotations: UserAnnotation[];
  customFormats?: CustomFormat[];
  format: 'pdf' | 'txt' | 'html' | 'docx';
}) {
  const documentTitle = title || 'Document Analysis';
  const cleanText = text || '';
  const paragraphs = cleanText.split(/\n\n+/).filter((p) => p.trim().length > 0);

  if (format === 'txt') {
    let content = `========================================================================\n`;
    content += `MARGINALIA ANNOTATED DOCUMENT EXPORT\n`;
    content += `Title: ${documentTitle}\n`;
    content += `Export Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
    content += `========================================================================\n\n`;

    content += `--- KEY THEMES ---\n`;
    themes.forEach((theme, idx) => {
      content += `${idx + 1}. ${theme.title}\n`;
    });
    content += `\n========================================================================\n`;
    content += `FULL DOCUMENT TEXT & STICKY NOTES\n`;
    content += `========================================================================\n\n`;

    paragraphs.forEach((para, pIdx) => {
      content += `[Paragraph ${pIdx + 1}]\n${para}\n`;

      const paraNotes = annotations.filter((a) => a.paragraphIndex === pIdx);
      if (paraNotes.length > 0) {
        paraNotes.forEach((n) => {
          content += `  [📌 STICKY NOTE - ${n.timestamp}]: "${n.noteText}"\n`;
        });
      }
      content += `\n`;
    });

    downloadBlob(content, `${sanitizeFilename(documentTitle)}_annotated.txt`, 'text/plain;charset=utf-8');
  } else {
    // Generate Rich HTML Document with Exact Text Highlights & Color-Matched Sticky Notes
    const buildHighlightedParaText = (paraStr: string, pIdx: number) => {
      const lowerPara = paraStr.toLowerCase();
      const intervals: { start: number; end: number; color?: string }[] = [];

      themes.forEach(theme => {
        const rawPhrases = [...(theme.excerpts || [])];
        if (theme.keyQuote) rawPhrases.push(theme.keyQuote);
        if (theme.title) rawPhrases.push(theme.title);

        const phrasesToFind: string[] = [];
        rawPhrases.forEach((phrase) => {
          if (!phrase) return;
          const clean = phrase.replace(/["'“”‘’]/g, '').trim();
          if (clean.length >= 3) phrasesToFind.push(clean);
          const matches = phrase.match(/['"“]([^'"”]+)['"”]/g);
          if (matches) {
            matches.forEach((m) => {
              const sub = m.replace(/["'“”‘’]/g, '').trim();
              if (sub.length >= 3) phrasesToFind.push(sub);
            });
          }
        });

        const uniquePhrases = Array.from(new Set(phrasesToFind))
          .filter((p) => p.length >= 3)
          .sort((a, b) => b.length - a.length);

        let foundAny = false;
        uniquePhrases.forEach((phrase) => {
          const lowerPhrase = phrase.toLowerCase();
          let pos = 0;
          while ((pos = lowerPara.indexOf(lowerPhrase, pos)) !== -1) {
            intervals.push({ start: pos, end: pos + phrase.length, color: theme.color });
            pos += Math.max(1, phrase.length);
            foundAny = true;
          }
        });

        if (!foundAny && theme.title) {
          const words = theme.title.split(/\s+/).filter((w) => w.length >= 4);
          words.forEach((w) => {
            const lowerW = w.toLowerCase();
            let pos = 0;
            while ((pos = lowerPara.indexOf(lowerW, pos)) !== -1) {
              intervals.push({ start: pos, end: pos + w.length, color: theme.color });
              pos += Math.max(1, w.length);
            }
          });
        }
      });

      if (intervals.length === 0) {
        return escapeHtml(paraStr);
      }

      intervals.sort((a, b) => a.start - b.start);
      const merged: { start: number; end: number; color?: string }[] = [];
      intervals.forEach((curr) => {
        if (merged.length === 0) {
          merged.push(curr);
        } else {
          const last = merged[merged.length - 1];
          if (curr.start <= last.end) {
            last.end = Math.max(last.end, curr.end);
            // Optionally merge colors if needed, but we'll just keep the first one
          } else {
            merged.push(curr);
          }
        }
      });

      // Filter custom formats for this paragraph
      const customFs = (customFormats || []).filter(cf => cf.paragraphIndex === pIdx);

      // Create an array of character properties for this paragraph
      const charStyles = new Array(paraStr.length).fill(null).map(() => ({
        bg: '',
        fw: 'normal',
        bb: 'none',
        ai: false,
        userFormats: [] as string[],
        color: ''
      }));

      // 1. Apply AI/Theme Phrase matches
      merged.forEach((inter) => {
        for (let i = inter.start; i < inter.end && i < paraStr.length; i++) {
          // Adjust background color to be subtle (e.g. 30% opacity)
          // We can't use 8-digit hex directly in all browsers for print, but in HTML it's fine
          charStyles[i].bg = 'transparent';
          charStyles[i].bb = `none`;
          charStyles[i].fw = 'bold';
          charStyles[i].ai = true;
          charStyles[i].color = inter.color || '#8b5cf6';
        }
      });

      // 2. Apply Custom User Formats
      customFs.forEach(cf => {
        for (let i = cf.start; i < cf.end && i < paraStr.length; i++) {
          if (cf.type === 'bold') {
            charStyles[i].fw = 'bold';
            charStyles[i].userFormats.push('bold');
          } else if (cf.type === 'highlight') {
            const adjustedBg = (cf.color === '#fef3c7') ? '#fde68a' : (cf.color || '#fef08a');
            charStyles[i].bg = adjustedBg;
            charStyles[i].userFormats.push('highlight');
          } else if (cf.type === 'underline') {
            charStyles[i].userFormats.push('underline');
            charStyles[i].color = cf.color || '#10b981';
          }
        }
      });

      const getStyleStr = (s: typeof charStyles[0]) => 
        `${s.bg}|${s.fw}|${s.bb}|${s.ai}|${s.userFormats.join(',')}|${s.color}`;

      let currentGroup = '';
      let currentStyleStr = charStyles.length > 0 ? getStyleStr(charStyles[0]) : '';
      let nodes: string[] = [];

      const renderNode = (text: string, style: typeof charStyles[0]) => {
        let styleAttr = '';
        if (style.bg && style.bg !== 'transparent') styleAttr += `background-color: ${style.bg}; `;
        if (style.fw !== 'normal') styleAttr += `font-weight: ${style.fw}; `;
        if (style.userFormats.includes('underline') || style.ai) {
          styleAttr += `text-decoration: underline; text-decoration-color: ${style.color || '#10b981'}; text-decoration-thickness: 2px; text-underline-offset: 4px; `;
        }
        
        if (styleAttr) {
          return `<mark style="${styleAttr} padding: 0; border-radius: 2px; color: inherit;">${escapeHtml(text)}</mark>`;
        }
        return escapeHtml(text);
      };

      charStyles.forEach((cs, i) => {
        const sStr = getStyleStr(cs);
        if (i === 0) {
          currentGroup += paraStr[i];
        } else {
          if (sStr === currentStyleStr) {
            currentGroup += paraStr[i];
          } else {
            nodes.push(renderNode(currentGroup, charStyles[i - 1]));
            currentGroup = paraStr[i];
            currentStyleStr = sStr;
          }
        }
      });

      if (currentGroup.length > 0) {
        nodes.push(renderNode(currentGroup, charStyles[charStyles.length - 1]));
      }

      return nodes.join('');
    };

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(documentTitle)} - Marginalia Analysis</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap" rel="stylesheet">
  <style>
    @page { margin: 20mm; size: auto; }
    body { 
      font-family: 'Georgia', serif; 
      line-height: 1.7; 
      color: #1c1917; 
      max-width: 1200px; 
      margin: 40px auto; 
      padding: 0 40px; 
      background: #fafaf9; 
    }
    h1 { font-size: 32px; border-bottom: 2px solid #e7e5e4; padding-bottom: 12px; margin-bottom: 30px; font-weight: normal; }
    
    .theme-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 40px; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: bold; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    
    .document-grid {
      display: grid;
      grid-template-columns: 3fr 1fr;
      gap: 40px;
      align-items: start;
      page-break-inside: avoid;
    }
    
    .para-container { position: relative; }
    .meta { font-size: 12px; color: #a8a29e; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; font-family: sans-serif; }
    .para-text { font-size: 16px; margin: 0; background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); border: 1px solid #f5f5f4; }
    
    .marginalia-column {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-top: 24px;
    }
    
    .sticky-note-box { 
      border-radius: 4px; 
      padding: 16px; 
      color: #1c1917; 
      transform: rotate(-1.5deg); 
      position: relative;
      border: 1px solid;
    }
    .sticky-note-box::before {
      content: '';
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 15px;
      background: rgba(255,255,255,0.6);
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .sticky-note-header { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #b45309; margin-bottom: 6px; font-family: sans-serif; opacity: 0.8; }
    .sticky-note-text { font-family: 'Caveat', cursive; font-size: 22px; font-weight: 700; margin: 0; line-height: 1.3; color: #1c1917; }
    
    @media print {
      body { background: white; margin: 0; padding: 0; max-width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .document-grid { grid-template-columns: 3fr 1fr; gap: 20px; page-break-inside: avoid; }
      .para-container, .sticky-note-box { page-break-inside: avoid; }
      .para-text { border: none; padding: 0; box-shadow: none; margin-bottom: 20px; }
      .sticky-note-box { box-shadow: none; }
    }
    
    @media (max-width: 768px) {
      .document-grid { grid-template-columns: 1fr; gap: 16px; }
      .marginalia-column { padding-top: 0; padding-left: 20px; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(documentTitle)}</h1>
  
  <div class="theme-badges">
    ${themes.map(t => `<div class="badge" style="background-color: ${t.color}">${escapeHtml(t.title)}</div>`).join('')}
  </div>

  <div class="document-container">
    ${paragraphs.map((para, pIdx) => {
      const paraNotes = annotations.filter((a) => a.paragraphIndex === pIdx);
      const estimatedPageNumber = Math.max(1, Math.ceil((pIdx + 1) / 3));
      const themeColor = themes.length > 0 ? themes[0].color : '#8b5cf6';
      
      return `
        <div class="document-grid">
          <div class="main-column">
            <div class="para-container">
              <div class="meta">Page ${estimatedPageNumber} &bull; Paragraph ${pIdx + 1}</div>
              <p class="para-text">${buildHighlightedParaText(para, pIdx)}</p>
            </div>
          </div>
          
          <div class="marginalia-column">
            ${paraNotes.length > 0 ? `
              <div style="font-size: 11px; color: #a8a29e; font-family: sans-serif; font-weight: bold; margin-bottom: 8px;">NOTES</div>
              ${paraNotes.map(n => `
                <div class="sticky-note-box" style="background-color: ${themeColor}15; border-color: ${themeColor}30;">
                  <div class="sticky-note-header">${escapeHtml(n.timestamp)}</div>
                  <p class="sticky-note-text">&ldquo;${escapeHtml(n.noteText)}&rdquo;</p>
                </div>
              `).join('<div style="height: 16px;"></div>')}
            ` : ''}
          </div>
        </div>
      `;
    }).join('')}
  </div>
</body>
</html>`;

    if (format === 'pdf') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        downloadBlob(html, `${sanitizeFilename(documentTitle)}_annotated.html`, 'text/html;charset=utf-8');
      }
    } else {
      const ext = format === 'docx' ? 'doc' : 'html';
      downloadBlob(html, `${sanitizeFilename(documentTitle)}_annotated.${ext}`, 'text/html;charset=utf-8');
    }
  }
}

function downloadBlob(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^$!()|[\]\\]/g, '\\$&');
}
