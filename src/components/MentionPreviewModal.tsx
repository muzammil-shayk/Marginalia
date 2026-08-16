import React from 'react';
import { DocumentInspectionPanel } from './DocumentInspectionPanel';

interface MentionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  themeTitle: string;
  themeColor: string;
  confidenceLabel: string;
  mentionsCount: number;
  excerpts: string[];
  keyQuote?: string;
  documentTitle?: string;
  documentText?: string;
}

export const MentionPreviewModal: React.FC<MentionPreviewModalProps> = ({
  isOpen,
  onClose,
  isDark = false,
  themeTitle,
  themeColor,
  confidenceLabel,
  mentionsCount,
  excerpts = [],
  keyQuote,
  documentTitle = 'The Architecture of Complexity',
  documentText
}) => {
  // Lock body scroll only on mobile where the modal is actually visible
  React.useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    
    const updateScrollLock = () => {
      if (window.innerWidth < 1024) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = ''; // Always clear on desktop to prevent stuck state
      }
    };

    updateScrollLock();
    window.addEventListener('resize', updateScrollLock);
    
    return () => {
      // On unmount, we want to clear it if it was our lock
      document.body.style.overflow = '';
      window.removeEventListener('resize', updateScrollLock);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 lg:hidden overflow-hidden select-text"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity z-0 cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl h-[85vh] max-h-[90vh] z-10 animate-in zoom-in-95 duration-200 flex flex-col min-h-0 touch-auto">
        <DocumentInspectionPanel
          themeTitle={themeTitle}
          themeColor={themeColor}
          confidenceLabel={confidenceLabel}
          mentionsCount={mentionsCount}
          excerpts={excerpts}
          keyQuote={keyQuote}
          documentTitle={documentTitle}
          documentText={documentText}
          isDark={isDark}
          onClose={onClose}
          isDesktopSplit={false}
        />
      </div>
    </div>
  );
};
