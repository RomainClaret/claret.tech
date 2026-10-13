"use client";

import { createPortal } from "react-dom";
// Deep per-icon import; see the note in pdf-viewer.tsx (lazy-chunk barrel bug).
import X from "lucide-react/dist/esm/icons/x";
import { PDFViewer } from "./pdf-viewer";
import { useModalDialog } from "@/lib/hooks/useModalDialog";
import { useOverlayLock } from "@/lib/hooks/useMotionGate";

interface PDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title?: string;
  downloadFileName?: string;
  /** The document's /pdf/<slug> page, if it has one. See usePDFViewer. */
  shareSlug?: string;
}

export function PDFModal({
  isOpen,
  onClose,
  pdfUrl,
  title,
  downloadFileName,
  shareSlug,
}: PDFModalProps) {
  // Covers the page: decorative motion behind it pauses until it closes.
  useOverlayLock(isOpen);
  // Focus, Tab, Escape, the page's scroll and its place, as the site's other
  // dialogs. Its own trap only wrapped at the first and last control, so
  // macOS WebKit's Tab, which skips buttons and links, left the reader at
  // the first press and walked the page behind it.
  const dialogRef = useModalDialog<HTMLDivElement>(isOpen, onClose, {
    lockScroll: true,
  });

  if (!isOpen) return null;

  // At the end of <body>, above everything but the terminal, as the other
  // dialogs: rendered in its section, it sat under the page's relative
  // z-10, and the cookie notice (z-50 at the page's root) painted over its
  // bottom and took its clicks, the bottom quarter of a phone's screen.
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full h-full max-w-6xl max-h-[90vh] m-4 bg-background rounded-lg shadow-2xl flex flex-col outline-none"
        role="dialog"
        aria-modal="true"
        aria-label={title || "PDF viewer"}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-background/80 hover:bg-muted transition-colors"
          aria-label="Close PDF viewer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* PDF Viewer */}
        <div id="pdf-viewer-content" className="flex-1 overflow-hidden">
          <PDFViewer
            url={pdfUrl}
            title={title}
            downloadFileName={downloadFileName}
            shareSlug={shareSlug}
            inModal={true}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
