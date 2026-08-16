import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Quote,
  Sparkles,
  MessageSquarePlus,
  Trash2,
  Check,
  FileText,
  FileCode,
  Bookmark,
  Pin,
  StickyNote,
  Highlighter,
  Bold,
  Eraser,
  ChevronDown,
  Palette,
  Underline
} from 'lucide-react';

import { exportAnnotatedDocument, UserAnnotation, CustomFormat, PreviewTheme } from '../utils/documentExporter';

export interface DocumentInspectionPanelProps {
  themes: PreviewTheme[];
  activeThemeId?: string;
  documentTitle?: string;
  documentText?: string;
  isDark?: boolean;
  onClose: () => void;
  isDesktopSplit?: boolean;
}

function renderHighlightedText(
  paraText: string,
  themes: PreviewTheme[],
  defaultColor: string,
  customFormats: CustomFormat[] = [],
  annotations: UserAnnotation[] = [],
  hoveredAnnotationId: string | null = null,
  onFormatClick?: (start: number, end: number) => void
): React.ReactNode {
  type FormatInterval = { start: number; end: number; type: 'ai' | 'bold' | 'highlight' | 'underline'; color?: string };
  const intervals: FormatInterval[] = [];
  const lowerPara = paraText.toLowerCase();

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
        intervals.push({ start: pos, end: pos + phrase.length, type: 'ai', color: theme.color });
        pos += Math.max(1, phrase.length);
        foundAny = true;
      }
    });
  });

  customFormats.forEach((cf) => {
    intervals.push({ start: cf.start, end: cf.end, type: cf.type, color: cf.color });
  });

  const charStyles: { type: Set<string>; color?: string; ai?: boolean; annoIds: Set<string> }[] = Array.from(
    { length: paraText.length },
    () => ({ type: new Set(), annoIds: new Set() })
  );

  intervals.forEach((inter) => {
    for (let i = Math.max(0, inter.start); i < inter.end && i < paraText.length; i++) {
      if (inter.type === 'ai') {
        charStyles[i].ai = true;
        charStyles[i].color = inter.color;
      } else if (inter.type === 'bold') {
        charStyles[i].type.add('bold');
      } else if (inter.type === 'highlight') {
        charStyles[i].type.add('highlight');
        charStyles[i].color = inter.color;
      } else if (inter.type === 'underline') {
        charStyles[i].type.add('underline');
        charStyles[i].color = inter.color;
      }
    }
  });

  annotations.forEach(a => {
    if (a.id && a.start !== undefined && a.end !== undefined) {
      for (let i = Math.max(0, a.start); i < a.end && i < paraText.length; i++) {
        charStyles[i].annoIds.add(a.id);
      }
    }
  });

  const nodes: React.ReactNode[] = [];
  let currentGroup = '';

  const getStyleStr = (cs: typeof charStyles[0]) => {
    return `${cs.ai ? 'ai' : ''}-${cs.type.has('bold') ? 'b' : ''}-${cs.type.has('highlight') ? cs.color : ''}-${cs.type.has('underline') ? 'u' : ''}-${Array.from(cs.annoIds).join(',')}-${cs.color || ''}`;
  };

  const renderSpan = (text: string, styleInfo: typeof charStyles[0], key: number, start: number, end: number) => {
    if (!styleInfo.ai && styleInfo.type.size === 0 && styleInfo.annoIds.size === 0) return text;
    
    let bg = 'transparent';
    let fw = styleInfo.type.has('bold') ? 'bold' : 'inherit';
    let bb = 'none';

    if (styleInfo.ai) {
      bg = `${styleInfo.color || defaultColor}40`;
      bb = 'none';
      if (fw === 'inherit') fw = 'bold';
    }
    if (styleInfo.type.has('highlight')) {
      bg = `${styleInfo.color || defaultColor}50`;
    }

    const isHoveredAnno = hoveredAnnotationId && styleInfo.annoIds.has(hoveredAnnotationId);
    if (isHoveredAnno) {
      bg = '#fde047'; // Bright yellow cross-highlight
      fw = 'bold';
    }

    const cls = (styleInfo.ai || isHoveredAnno) ? 'px-1.5 py-0.5 rounded shadow-2xs' : 'px-0.5 rounded-sm';
    
    let adjustedBg = bg;
    if (bg && bg === '#fef3c7') {
      adjustedBg = '#fde68a';
    }

    const firstAnnoId = Array.from(styleInfo.annoIds)[0];
    const matchingAnno = firstAnnoId ? annotations.find(a => a.id === firstAnnoId) : null;
    const isAnchor = matchingAnno && start <= matchingAnno.start! && end > matchingAnno.start!;
    const spanId = isAnchor ? `anno-span-${firstAnnoId}` : undefined;

    return (
      <mark
        id={spanId}
        key={`span-${key}`}
        className={`transition-all inline select-text ${cls} ${styleInfo.type.size > 0 && !styleInfo.ai ? 'cursor-pointer hover:opacity-80' : ''}`}
        style={{
          backgroundColor: adjustedBg,
          borderBottom: bb,
          textDecoration: (styleInfo.type.has('underline') || styleInfo.ai) ? 'underline' : 'none',
          textDecorationColor: (styleInfo.type.has('underline') || styleInfo.ai) ? (styleInfo.color || defaultColor) : 'transparent',
          textDecorationThickness: '2px',
          textUnderlineOffset: '5px',
          color: 'inherit',
          fontWeight: fw
        }}
        onClick={(e) => {
          if (styleInfo.type.size > 0 && !styleInfo.ai && onFormatClick) {
            e.preventDefault();
            e.stopPropagation();
            onFormatClick(start, end);
          }
        }}
      >
        {text}
      </mark>
    );
  };

  let currentStyleStr = charStyles.length > 0 ? getStyleStr(charStyles[0]) : '';

  charStyles.forEach((cs, i) => {
    const sStr = getStyleStr(cs);
    if (i === 0) {
      currentGroup += paraText[i];
    } else {
      if (sStr === currentStyleStr) {
        currentGroup += paraText[i];
      } else {
        const groupStart = i - currentGroup.length;
        nodes.push(renderSpan(currentGroup, charStyles[i - 1], nodes.length, groupStart, i));
        currentGroup = paraText[i];
        currentStyleStr = sStr;
      }
    }
  });

  if (currentGroup.length > 0) {
    const groupStart = paraText.length - currentGroup.length;
    nodes.push(renderSpan(currentGroup, charStyles[charStyles.length - 1], nodes.length, groupStart, paraText.length));
  }

  return nodes.length > 0 ? nodes : paraText;
}

function getSelectionCharacterOffsetWithin(element: HTMLElement) {
  let start = 0;
  let end = 0;
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  let sel;
  if (typeof win.getSelection !== "undefined") {
    sel = win.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      start = preCaretRange.toString().length;
      end = start + range.toString().length;
    }
  }
  return { start, end };
}

function restoreSelectionCharacterOffset(element: HTMLElement, start: number, end: number) {
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  if (typeof win.getSelection === "undefined") return;
  const sel = win.getSelection();
  if (!sel) return;

  let charCount = 0;
  let startNode: Node | null = null;
  let endNode: Node | null = null;
  let startOffset = 0;
  let endOffset = 0;

  function traverseNodes(node: Node) {
    if (node.nodeType === 3) {
      const nextCharCount = charCount + (node.nodeValue?.length || 0);
      if (!startNode && start >= charCount && start <= nextCharCount) {
        startNode = node;
        startOffset = start - charCount;
      }
      if (!endNode && end >= charCount && end <= nextCharCount) {
        endNode = node;
        endOffset = end - charCount;
      }
      charCount = nextCharCount;
    } else {
      if (node.nodeType === 1 && node.childNodes) {
        for (let i = 0; i < node.childNodes.length; i++) {
          traverseNodes(node.childNodes[i]);
        }
      }
    }
  }

  traverseNodes(element);

  if (startNode && endNode) {
    const range = doc.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export function getThemeMentionNodes(
  excerpts: string[],
  keyQuote: string | undefined,
  paragraphs: string[],
  themeTitle: string
) {
  const nodes: { id: number; paragraphIndex: number; matchedTerm: string; quoteText: string }[] = [];
  const terms = [...excerpts];
  if (keyQuote && !terms.includes(keyQuote)) {
    terms.unshift(keyQuote);
  }

  const validTerms = terms.filter((t) => t && t.trim().length > 2);

  validTerms.forEach((quote, qIdx) => {
    const lowerQuote = quote.toLowerCase();
    let foundIdx = paragraphs.findIndex((p) => p.toLowerCase().includes(lowerQuote));
    if (foundIdx === -1) {
      const words = quote.split(/\s+/).filter((w) => w.length > 3);
      foundIdx = paragraphs.findIndex((p) => {
        const lowerP = p.toLowerCase();
        return words.filter((w) => lowerP.includes(w.toLowerCase())).length >= Math.min(2, words.length);
      });
    }
    if (foundIdx === -1) {
      foundIdx = Math.min(qIdx, paragraphs.length - 1);
    }
    nodes.push({
      id: qIdx,
      paragraphIndex: Math.max(0, foundIdx),
      matchedTerm: quote,
      quoteText: quote
    });
  });

  if (nodes.length === 0 && paragraphs.length > 0) {
    paragraphs.forEach((p, idx) => {
      nodes.push({
        id: idx,
        paragraphIndex: idx,
        matchedTerm: themeTitle,
        quoteText: p.substring(0, 120)
      });
    });
  }

  return nodes;
}

export const DocumentInspectionPanel: React.FC<DocumentInspectionPanelProps> = ({
  themes = [],
  activeThemeId,
  documentTitle = 'The Architecture of Complexity',
  documentText,
  isDark = false,
  onClose,
  isDesktopSplit = false
}) => {
  const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0];
  const themeTitle = activeTheme?.title || 'Document Preview';
  const themeColor = activeTheme?.color || '#8b5cf6';
  const confidenceLabel = activeTheme?.confidenceLabel || '';
  const excerpts = activeTheme?.excerpts || [];
  const keyQuote = activeTheme?.keyQuote;

  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [annotations, setAnnotations] = useState<UserAnnotation[]>([]);
  const [customFormats, setCustomFormats] = useState<CustomFormat[]>([]);
  const [editingParagraphIndex, setEditingParagraphIndex] = useState<number | null>(null);
  const [noteInputText, setNoteInputText] = useState('');
  const [editingNoteRange, setEditingNoteRange] = useState<{start: number, end: number} | null>(null);
  const [editingNoteOffset, setEditingNoteOffset] = useState<number>(0);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [annotationOffsets, setAnnotationOffsets] = useState<Record<string, number>>({});
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<string>(themeColor || '#8b5cf6');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [lastFormattedRange, setLastFormattedRange] = useState<{ paragraphIndex: number; start: number; end: number } | null>(null);

  useEffect(() => {
    if (lastFormattedRange) {
      const timer = setTimeout(() => {
        const paraEl = document.getElementById(`inspection-paragraph-text-${lastFormattedRange.paragraphIndex}`);
        if (paraEl) {
          restoreSelectionCharacterOffset(paraEl, lastFormattedRange.start, lastFormattedRange.end);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [customFormats, lastFormattedRange]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const newOffsets: Record<string, number> = {};
      annotations.forEach(anno => {
        if (anno.id) {
          const el = document.getElementById(`anno-span-${anno.id}`);
          if (el) {
            let current: HTMLElement | null = el;
            let offsetTop = 0;
            while (current && !current.id.startsWith('inspection-paragraph-text-')) {
              offsetTop += current.offsetTop;
              current = current.offsetParent as HTMLElement;
            }
            newOffsets[anno.id] = Math.max(0, offsetTop - 10);
          }
        }
      });
      setAnnotationOffsets(newOffsets);
    }, 100);
    return () => clearTimeout(timer);
  }, [annotations, documentText]);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (themeColor) {
      setSelectedHighlightColor(themeColor);
    }
  }, [themeColor]);

  const handleFormatText = (type: 'bold' | 'highlight' | 'underline', color?: string) => {
    const sel = window.getSelection();

    if (!sel || sel.isCollapsed) return;
    
    let node: Node | null = sel.anchorNode;
    let paraEl: HTMLElement | null = null;
    let pIdx = -1;
    
    while (node && node !== document.body) {
      if (node instanceof HTMLElement && node.id && node.id.startsWith('inspection-paragraph-text-')) {
        paraEl = node;
        pIdx = parseInt(node.id.replace('inspection-paragraph-text-', ''), 10);
        break;
      }
      node = node.parentNode;
    }

    if (paraEl && pIdx !== -1) {
      const { start, end } = getSelectionCharacterOffsetWithin(paraEl);
      if (start !== end) {
        setCustomFormats((prev) => {
          const existing = prev.find(cf => 
            cf.paragraphIndex === pIdx && 
            cf.type === type && 
            Math.max(cf.start, start) < Math.min(cf.end, end)
          );
          
          if (existing) {
            return prev.filter(cf => cf !== existing);
          } else {
            return [...prev, { paragraphIndex: pIdx, start, end, type, color }];
          }
        });
        setLastFormattedRange({ paragraphIndex: pIdx, start, end });
      }
    }
  };

  const handleRemoveFormatAt = (pIdx: number, spanStart: number, spanEnd: number) => {
    setCustomFormats((prev) => 
      prev.filter((cf) => {
        if (cf.paragraphIndex !== pIdx) return true;
        const overlaps = Math.max(cf.start, spanStart) < Math.min(cf.end, spanEnd);
        return !overlaps;
      })
    );
  };

  const paragraphs = React.useMemo(() => {
    if (documentText && documentText.trim()) {
      return documentText
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }
    return [];
  }, [documentText]);

  const mentionNodes = React.useMemo(() => {
    return getThemeMentionNodes(excerpts, keyQuote, paragraphs, themeTitle);
  }, [paragraphs, excerpts, keyQuote, themeTitle]);

  const totalMentions = mentionNodes.length || 1;
  const activeMentionNode = mentionNodes[activeMentionIndex] || mentionNodes[0];

  const scrollToMention = React.useCallback((mentionIdx: number) => {
    const node = mentionNodes[mentionIdx];
    if (!node) return;
    const targetParaIdx = node.paragraphIndex;
    
    setTimeout(() => {
      const panelContainer = containerRef.current;
      const activeEl = panelContainer?.querySelector(`#inspection-paragraph-node-${targetParaIdx}`) as HTMLElement | null;
      const scrollParent = scrollContainerRef.current || (panelContainer?.querySelector('#document-inspection-scroll-container') as HTMLElement | null);
      
      if (activeEl && scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const elRect = activeEl.getBoundingClientRect();
        const relativeTop = elRect.top - parentRect.top + scrollParent.scrollTop;
        const targetTop = Math.max(0, relativeTop - 16);

        scrollParent.scrollTop = targetTop;

        try {
          scrollParent.scrollTo({ top: targetTop, behavior: 'smooth' });
        } catch (e) {
          
        }
      }
    }, 40);
  }, [mentionNodes]);

  useEffect(() => {
    scrollToMention(activeMentionIndex);
  }, [activeMentionIndex, scrollToMention]);

  const handlePrev = () => {
    setActiveMentionIndex((prev) => {
      const next = prev > 0 ? prev - 1 : totalMentions - 1;
      scrollToMention(next);
      return next;
    });
  };

  const handleNext = () => {
    setActiveMentionIndex((prev) => {
      const next = prev < totalMentions - 1 ? prev + 1 : 0;
      scrollToMention(next);
      return next;
    });
  };

  const handleAddAnnotation = (pIdx: number) => {
    if (!noteInputText.trim()) return;
    const newAnnotation: UserAnnotation = {
      id: Math.random().toString(36).substr(2, 9),
      paragraphIndex: pIdx,
      start: editingNoteRange?.start,
      end: editingNoteRange?.end,
      noteText: noteInputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    setNoteInputText('');
    setEditingParagraphIndex(null);
    setEditingNoteRange(null);
  };

  const handleDeleteAnnotation = (indexToDelete: number) => {
    setAnnotations((prev) => prev.filter((_, idx) => idx !== indexToDelete));
  };

  const handleExport = (format: 'pdf' | 'txt' | 'html' | 'docx') => {
    exportAnnotatedDocument({
      title: documentTitle,
      text: documentText,
      themes,
      annotations,
      customFormats,
      format
    });
    setIsDownloadMenuOpen(false);
  };

  const activeBorderColor = themeColor || '#8b5cf6';

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded-3xl border shadow-xl flex flex-col overflow-hidden transition-all duration-300 select-text ${
        isDark ? 'bg-[#161a18] border-stone-800 text-stone-100' : 'bg-[#fdfcf9] border-stone-200/90 text-stone-900'
      }`}
    >
      <header className="p-3.5 sm:p-4 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-stone-50/90 dark:bg-[#121513]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
            style={{ backgroundColor: activeBorderColor }}
          />
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-serif text-[15px] sm:text-[16px] font-bold truncate text-stone-900 dark:text-white">
              {themeTitle}
            </h3>
            <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 shrink-0">
              {confidenceLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-stone-200/60 dark:bg-stone-800/60 p-0.5 rounded-full border border-stone-300/50 dark:border-stone-700/50 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="p-1 rounded-full hover:bg-white dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-all active:scale-95 cursor-pointer"
              title="Previous Mention"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-1.5 text-[10px] font-bold text-stone-700 dark:text-stone-300 font-mono shrink-0">
              {activeMentionIndex + 1} / {totalMentions}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="p-1 rounded-full hover:bg-white dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-all active:scale-95 cursor-pointer"
              title="Next Mention"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDownloadMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-[12px] font-medium hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            {isDownloadMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-40 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-xl overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in">
                <button onClick={() => handleExport('html')} className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center gap-2 cursor-pointer transition-colors">
                  <FileCode className="w-4 h-4 text-orange-500" /> HTML Export
                </button>
                <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center gap-2 cursor-pointer transition-colors">
                  <FileText className="w-4 h-4 text-red-500" /> PDF Format
                </button>
                <button onClick={() => handleExport('docx')} className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center gap-2 cursor-pointer transition-colors">
                  <Bookmark className="w-4 h-4 text-blue-500" /> DOCX Format
                </button>
                <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center gap-2 cursor-pointer transition-colors">
                  <FileText className="w-4 h-4 text-stone-500" /> Plain Text
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-stone-200/50 dark:bg-stone-800/50 hover:bg-stone-300/50 dark:hover:bg-stone-700/50 text-stone-500 hover:text-stone-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div
        id="document-inspection-scroll-container"
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 scroll-smooth"
      >
        {paragraphs.map((paraText, pIdx) => {
          const paraAnnotations = annotations.filter((a) => a.paragraphIndex === pIdx);
          
          return (
            <div
              key={pIdx}
              id={`inspection-paragraph-node-${pIdx}`}
              className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white/60 dark:bg-stone-900/30 hover:border-stone-300 dark:hover:border-stone-700 transition-all"
            >
              <div className="flex items-center justify-between gap-x-2 mb-3 pb-2 border-b border-stone-200/50 dark:border-stone-800/50">
                <div className="flex items-center gap-2 shrink-0 overflow-hidden text-[11px] text-stone-500 dark:text-stone-400">
                  <span className="font-medium tracking-tight">Paragraph {pIdx + 1} of {paragraphs.length}</span>
                </div>
                
                <div className="flex items-center gap-3 shrink-0 relative">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteRange(null);
                      setEditingParagraphIndex(editingParagraphIndex === pIdx ? null : pIdx);
                    }}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white cursor-pointer bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-lg transition-colors"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5 text-stone-500" />
                    <span className="hidden sm:inline">Add Note</span>
                  </button>

                  {/* Tooltip removed - textarea relocated to margin */}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start relative">
                <div className="lg:col-span-8 relative">
                  <p id={`inspection-paragraph-text-${pIdx}`} className="font-serif text-[15px] leading-relaxed text-stone-600 dark:text-stone-400 select-text touch-auto relative z-10">
                    {renderHighlightedText(
                      paraText, themes, activeBorderColor, 
                      customFormats.filter(cf => cf.paragraphIndex === pIdx),
                      paraAnnotations,
                      hoveredAnnotationId,
                      (start, end) => handleRemoveFormatAt(pIdx, start, end)
                    )}
                  </p>
                </div>

                <div className="hidden lg:block lg:col-span-4 relative z-10 min-h-full min-h-[40px]">
                  {paraAnnotations.length > 0 && (
                    <div className="w-full h-full relative opacity-90 hover:opacity-100 transition-opacity">
                      {paraAnnotations.map((anno, aIdx) => (
                        <div
                          key={aIdx}
                          className="absolute p-2.5 rounded-xl shadow-lg hover:rotate-0 transition-all duration-300 border pointer-events-auto backdrop-blur-md w-full group"
                          onMouseEnter={() => setHoveredAnnotationId(anno.id || null)}
                          onMouseLeave={() => setHoveredAnnotationId(null)}
                          style={{
                            top: (anno.id && annotationOffsets[anno.id]) ? `${annotationOffsets[anno.id]}px` : `${aIdx * 40}px`,
                            zIndex: hoveredAnnotationId === anno.id ? 50 : (10 + aIdx),
                            backgroundColor: hoveredAnnotationId === anno.id ? '#fef08a' : `${activeBorderColor}10`,
                            borderColor: hoveredAnnotationId === anno.id ? '#eab308' : `${activeBorderColor}30`,
                            transform: hoveredAnnotationId === anno.id ? 'scale(1.05) rotate(0deg) translateX(-10px)' : 'rotate(-2deg)'
                          }}
                        >
                          <button
                            onClick={() => handleDeleteAnnotation(annotations.indexOf(anno))}
                            className="absolute -top-2 -right-2 p-1 bg-white dark:bg-stone-800 text-stone-400 hover:text-red-500 rounded-full shadow-sm border border-stone-200 dark:border-stone-700 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Delete Note"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <p className="font-handwriting text-[15px] leading-tight font-bold text-stone-900 dark:text-stone-100">
                            &ldquo;{anno.noteText}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {editingParagraphIndex === pIdx && (
                    <div 
                      className="absolute w-full p-3 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-right-4 transform -rotate-1"
                      style={{ 
                        top: `${editingNoteOffset}px`,
                        backgroundColor: `${activeBorderColor}20`,
                        borderColor: `${activeBorderColor}50`,
                        borderWidth: '1px'
                      }}
                    >
                      <textarea
                        autoFocus
                        value={noteInputText}
                        onChange={(e) => setNoteInputText(e.target.value)}
                        placeholder="Type your marginalia..."
                        className="w-full bg-transparent border-b p-2 text-[15px] leading-tight font-bold font-handwriting min-h-20 focus:outline-none resize-none text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500"
                        style={{ borderBottomColor: `${activeBorderColor}40` }}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingParagraphIndex(null);
                            setEditingNoteRange(null);
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-stone-600 dark:text-stone-300 hover:opacity-70 transition-opacity cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddAnnotation(pIdx)}
                          className="px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-md hover:brightness-110 transition-all cursor-pointer"
                          style={{ backgroundColor: activeBorderColor }}
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {(paraAnnotations.length > 0 || editingParagraphIndex === pIdx) && (
                  <div className="lg:hidden md:col-span-12 space-y-3 pt-3 border-t border-stone-200/60 dark:border-stone-800 mt-4">
                    {paraAnnotations.length > 0 && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block mb-1 font-mono">
                        MARGINALIA NOTE
                      </span>
                    )}
                    {paraAnnotations.map((anno, aIdx) => (
                      <div
                        key={aIdx}
                        className="relative p-3.5 rounded-2xl shadow-md -rotate-1 hover:rotate-0 transition-all duration-200 border"
                        style={{
                          backgroundColor: `${activeBorderColor}18`,
                          borderColor: `${activeBorderColor}60`
                        }}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5 opacity-60">
                            <Pin className="w-3.5 h-3.5 -rotate-45" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">
                              {anno.timestamp}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteAnnotation(annotations.indexOf(anno))}
                            className="p-1 text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Delete Note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="font-handwriting text-[18px] leading-snug font-bold text-stone-900 dark:text-stone-100">
                          &ldquo;{anno.noteText}&rdquo;
                        </p>
                      </div>
                    ))}
                    
                    {editingParagraphIndex === pIdx && (
                      <div 
                        className="relative p-3.5 rounded-2xl shadow-xl"
                        style={{
                          backgroundColor: `${activeBorderColor}20`,
                          borderColor: `${activeBorderColor}50`,
                          borderWidth: '1px'
                        }}
                      >
                        <textarea
                          autoFocus
                          value={noteInputText}
                          onChange={(e) => setNoteInputText(e.target.value)}
                          placeholder="Type your marginalia..."
                          className="w-full bg-transparent border-b p-2 text-[18px] leading-snug font-bold font-handwriting min-h-20 focus:outline-none resize-none text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500"
                          style={{ borderBottomColor: `${activeBorderColor}40` }}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingParagraphIndex(null);
                              setEditingNoteRange(null);
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-stone-600 dark:text-stone-300 hover:opacity-70 transition-opacity cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddAnnotation(pIdx)}
                            className="px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-md hover:brightness-110 transition-all cursor-pointer"
                            style={{ backgroundColor: activeBorderColor }}
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40">
        <div className="relative flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-stone-900/90 dark:bg-stone-800/90 backdrop-blur-md border border-stone-700/80 text-white shadow-2xl transition-all active:scale-[0.98]">
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); handleFormatText('bold'); }}
            className="p-1.5 rounded-full hover:bg-stone-700/80 text-stone-300 hover:text-white transition-all cursor-pointer"
            title="Format Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); handleFormatText('underline'); }}
            className="p-1.5 rounded-full hover:bg-stone-700/80 text-stone-300 hover:text-white transition-all cursor-pointer"
            title="Underline"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-3.5 bg-stone-700 mx-0.5" />

          <div className="relative flex items-center color-picker-container">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                const sel = window.getSelection();
                if (sel && !sel.isCollapsed) {
                  handleFormatText('highlight', selectedHighlightColor);
                } else {
                  setIsColorPickerOpen((prev) => !prev);
                }
              }}
              className="flex items-center gap-1.5 p-1.5 rounded-full hover:bg-stone-700/80 text-stone-300 hover:text-white transition-all cursor-pointer"
              title="Highlight Text"
            >
              <Highlighter className="w-3.5 h-3.5" style={{ color: selectedHighlightColor }} />
              <span
                className="w-2.5 h-2.5 rounded-full ring-1 ring-black/30 shrink-0"
                style={{ backgroundColor: selectedHighlightColor }}
              />
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setIsColorPickerOpen((prev) => !prev);
              }}
              className="p-1 rounded-full hover:bg-stone-700/80 text-stone-400 hover:text-white transition-all cursor-pointer"
              title="Choose Highlight Color"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isColorPickerOpen ? 'rotate-180' : ''}`} />
            </button>

            {isColorPickerOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 p-2 rounded-2xl bg-stone-900/95 dark:bg-stone-800/95 border border-stone-700 shadow-2xl z-50 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150 shrink-0">
                {[
                  { label: 'Theme Default', value: activeBorderColor },
                  { label: 'Yellow', value: '#fef08a' },
                  { label: 'Amber', value: '#fed7aa' },
                  { label: 'Emerald', value: '#a7f3d0' },
                  { label: 'Sky Blue', value: '#bae6fd' },
                  { label: 'Purple', value: '#ddd6fe' },
                  { label: 'Rose', value: '#fbcfe8' }
                ].map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    title={swatch.label}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setSelectedHighlightColor(swatch.value);
                      const sel = window.getSelection();
                      if (sel && !sel.isCollapsed) {
                        handleFormatText('highlight', swatch.value);
                      }
                      setIsColorPickerOpen(false);
                    }}
                    className={`w-6 h-6 rounded-full transition-transform active:scale-90 hover:scale-110 flex items-center justify-center border ${
                      selectedHighlightColor === swatch.value
                        ? 'ring-2 ring-offset-1 ring-white scale-105'
                        : 'border-stone-600'
                    }`}
                    style={{ backgroundColor: swatch.value }}
                  >
                    {swatch.value === activeBorderColor && (
                      <Palette className="w-3 h-3 text-stone-700 mix-blend-difference" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="w-px h-3.5 bg-stone-700 mx-0.5" />

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              const sel = window.getSelection();
              if (!sel || sel.isCollapsed) return;
              
              let node = sel.anchorNode;
              let pIdx = -1;
              while (node && node !== document.body) {
                if (node instanceof HTMLElement && node.id && node.id.startsWith('inspection-paragraph-text-')) {
                  pIdx = parseInt(node.id.replace('inspection-paragraph-text-', ''), 10);
                  break;
                }
                node = node.parentNode;
              }
              if (pIdx !== -1) {
                const { start, end } = getSelectionCharacterOffsetWithin(node as HTMLElement);
                if (start !== end) {
                  setEditingNoteRange({start, end});
                } else {
                  setEditingNoteRange(null);
                }
                
                const selRange = sel.getRangeAt(0);
                const rect = selRange.getBoundingClientRect();
                const textEl = document.getElementById(`inspection-paragraph-text-${pIdx}`);
                if (textEl && rect) {
                  const textRect = textEl.getBoundingClientRect();
                  setEditingNoteOffset(Math.max(0, rect.top - textRect.top - 10));
                } else {
                  setEditingNoteOffset(0);
                }
                
                setEditingParagraphIndex(pIdx);
              }
            }}
            className="p-1.5 rounded-full hover:bg-stone-700/80 text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer"
            title="Add Note to Selection"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <footer className="p-3.5 border-t border-stone-200 dark:border-stone-800 text-center bg-stone-50/60 dark:bg-[#121513]/60 shrink-0 flex items-center justify-between px-5 text-[12px] text-stone-500 dark:text-stone-400">
        <span>{paragraphs.length} total paragraphs</span>
        <span>{annotations.length} user annotations added</span>
      </footer>
    </div>
  );
};
