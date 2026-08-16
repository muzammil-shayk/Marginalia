/**
 * Document Exporter Utility
 * Exports annotated document files (PDF default, HTML, TXT, DOCX) containing
 * exact text quote highlights, theme badges, and color-matched sticky notes.
 */

export interface UserAnnotation {
  paragraphIndex: number;
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

export function exportAnnotatedDocument({
  title,
  text,
  themeTitle,
  themeColor,
  confidenceLabel,
  excerpts = [],
  annotations = [],
  customFormats = [],
  format = 'pdf'
}: {
  title: string;
  text?: string;
  themeTitle: string;
  themeColor: string;
  confidenceLabel: string;
  excerpts: string[];
  annotations: UserAnnotation[];
  customFormats?: CustomFormat[];
  format: 'pdf' | 'txt' | 'html' | 'docx';
}) {
  const documentTitle = title || 'Document Analysis';
  const cleanText = text || '';
  const paragraphs = cleanText.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const activeColor = themeColor || '#8b5cf6';

  if (format === 'txt') {
    let content = `========================================================================\n`;
    content += `MARGINALIA ANNOTATED DOCUMENT EXPORT\n`;
    content += `Title: ${documentTitle}\n`;
    content += `Active Theme: ${themeTitle} (${confidenceLabel})\n`;
    content += `Export Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
    content += `========================================================================\n\n`;

    content += `--- KEY THEME EXCERPTS ---\n`;
    excerpts.forEach((ex, idx) => {
      content += `${idx + 1}. "${ex}"\n`;
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

    downloadBlob(content, `${sanitizeFilename(documentTitle)}_${sanitizeFilename(themeTitle)}_annotated.txt`, 'text/plain;charset=utf-8');
  } else {
    // Generate Rich HTML Document with Exact Text Highlights & Color-Matched Sticky Notes
    const buildHighlightedParaText = (paraStr: string, pIdx: number) => {
      const rawPhrases = [...excerpts, themeTitle];
      const phrasesToFind: string[] = [];

      rawPhrases.forEach((phrase) => {
        if (!phrase) return;
        const clean = phrase.replace(/["'“”‘’]/g, '').trim();
        if (clean.length >= 3) {
          phrasesToFind.push(clean);
        }
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

      const lowerPara = paraStr.toLowerCase();
      const intervals: { start: number; end: number }[] = [];

      uniquePhrases.forEach((phrase) => {
        const lowerPhrase = phrase.toLowerCase();
        let pos = 0;
        while ((pos = lowerPara.indexOf(lowerPhrase, pos)) !== -1) {
          intervals.push({ start: pos, end: pos + phrase.length });
          pos += Math.max(1, phrase.length);
        }
      });

      if (intervals.length === 0 && themeTitle) {
        const words = themeTitle.split(/\s+/).filter((w) => w.length >= 4);
        words.forEach((w) => {
          const lowerW = w.toLowerCase();
          let pos = 0;
          while ((pos = lowerPara.indexOf(lowerW, pos)) !== -1) {
            intervals.push({ start: pos, end: pos + w.length });
            pos += Math.max(1, w.length);
          }
        });
      }

      if (intervals.length === 0) {
        return escapeHtml(paraStr);
      }

      intervals.sort((a, b) => a.start - b.start);
      const merged: { start: number; end: number }[] = [];
      intervals.forEach((curr) => {
        if (merged.length === 0) {
          merged.push(curr);
        } else {
          const last = merged[merged.length - 1];
          if (curr.start <= last.end) {
            last.end = Math.max(last.end, curr.end);
          } else {
            merged.push(curr);
          }
        }
      });

      let resultHtml = '';
      let currentIndex = 0;

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
          charStyles[i].bg = `${activeColor}40`;
          charStyles[i].bb = `3px solid ${activeColor}`;
          charStyles[i].fw = 'bold';
          charStyles[i].ai = true;
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
        `${s.bg}|${s.fw}|${s.bb}|${s.ai}|${s.userFormats.join(',')}`;

      let currentGroup = '';
      let currentStyleStr = charStyles.length > 0 ? getStyleStr(charStyles[0]) : '';
      let nodes: string[] = [];

      const renderNode = (text: string, style: typeof charStyles[0]) => {
        let styleAttr = '';
        if (style.bg) styleAttr += `background-color: ${style.bg}; `;
        if (style.bb !== 'none') styleAttr += `border-bottom: ${style.bb}; `;
        if (style.fw !== 'normal') styleAttr += `font-weight: ${style.fw}; `;
        if (style.userFormats.includes('underline')) {
          styleAttr += `text-decoration: underline; text-decoration-color: ${style.color || '#10b981'}; text-decoration-thickness: 4px; text-underline-offset: 4px; `;
        }
        
        if (style.ai) {
           styleAttr += `padding: 2px 6px; border-radius: 4px; color: inherit;`;
        }

        if (styleAttr) {
          return `<mark style="${styleAttr}">${escapeHtml(text)}</mark>`;
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
    body { font-family: 'Georgia', serif; line-height: 1.6; color: #1c1917; max-width: 850px; margin: 30px auto; padding: 0 20px; background: #fafaf9; }
    h1 { font-size: 26px; border-bottom: 2px solid #e7e5e4; padding-bottom: 10px; margin-bottom: 6px; }
    .badge { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: bold; background: ${activeColor}; color: white; margin-bottom: 20px; }
    .excerpt-box { background: #f5f5f4; border-left: 4px solid ${activeColor}; padding: 14px 18px; border-radius: 8px; margin-bottom: 30px; }
    .excerpt-box ul { margin: 6px 0 0 0; padding-left: 20px; }
    .para { background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); position: relative; }
    .sticky-note-box { background: ${activeColor}18; border: 1px solid ${activeColor}60; border-left: 4px solid ${activeColor}; border-radius: 10px; padding: 12px 16px; margin-top: 14px; color: #1c1917; transform: rotate(-1.5deg); box-shadow: 2px 3px 8px rgba(0,0,0,0.08); }
    .sticky-note-header { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: ${activeColor}; margin-bottom: 4px; border-bottom: 1px solid ${activeColor}30; padding-bottom: 3px; font-family: sans-serif; }
    .sticky-note-text { font-family: 'Caveat', cursive; font-size: 19px; font-weight: 700; margin: 0; line-height: 1.3; color: #1c1917; }
    .meta { font-size: 11px; color: #78716c; margin-bottom: 6px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    @media print {
      body { background: white; margin: 0; max-width: 100%; }
      .para { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(documentTitle)}</h1>
  <div class="badge">Theme: ${escapeHtml(themeTitle)} &bull; ${escapeHtml(confidenceLabel)}</div>

  <div class="excerpt-box">
    <strong>Key Document Excerpts:</strong>
    <ul>
      ${excerpts.map((ex) => `<li>&ldquo;${escapeHtml(ex)}&rdquo;</li>`).join('')}
    </ul>
  </div>

  <h2 style="font-size: 18px; border-bottom: 1px solid #e7e5e4; padding-bottom: 6px; margin-bottom: 16px;">Document Text & Annotations</h2>
  ${paragraphs
    .map((para, pIdx) => {
      const paraNotes = annotations.filter((a) => a.paragraphIndex === pIdx);
      // Rough page number estimation (assuming ~3-4 paragraphs per page for standard reading)
      const estimatedPageNumber = Math.max(1, Math.ceil((pIdx + 1) / 3));
      
      return `
      <div class="para">
        <div class="meta">Page ${estimatedPageNumber}</div>
        <p>${buildHighlightedParaText(para, pIdx)}</p>
        ${paraNotes
          .map(
            (n) => `
          <div class="sticky-note-box">
            <div class="sticky-note-header">📌 STICKY NOTE (${escapeHtml(n.timestamp)})</div>
            <p class="sticky-note-text">&ldquo;${escapeHtml(n.noteText)}&rdquo;</p>
          </div>
        `
          )
          .join('')}
      </div>
    `;
    })
    .join('')}
</body>
</html>`;

    if (format === 'pdf') {
      // Trigger browser print to PDF stream
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      } else {
        // Fallback to html blob if popups blocked
        downloadBlob(html, `${sanitizeFilename(documentTitle)}_${sanitizeFilename(themeTitle)}_annotated.html`, 'text/html;charset=utf-8');
      }
    } else {
      const ext = format === 'docx' ? 'doc' : 'html';
      downloadBlob(html, `${sanitizeFilename(documentTitle)}_${sanitizeFilename(themeTitle)}_annotated.${ext}`, 'text/html;charset=utf-8');
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
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
