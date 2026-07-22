"use client";

import { useEffect, useRef } from "react";
// Deep per-icon import; see the note in pdf-viewer.tsx (lazy-chunk barrel bug).
import X from "lucide-react/dist/esm/icons/x";
import { PDFViewer } from "./pdf-viewer";

interface PDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title?: string;
  downloadFileName?: string;
}

export function PDFModal({
  isOpen,
  onClose,
  pdfUrl,
  title,
  downloadFileName,
}: PDFModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key and focus management
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    // Scroll position at open time; null when this effect run never opened
    // the modal (so its cleanup must not touch scroll or focus).
    let scrollY: number | null = null;

    if (isOpen) {
      // Store the currently focused element and where the page was scrolled.
      previousActiveElement.current = document.activeElement as HTMLElement;
      scrollY = window.scrollY;

      document.addEventListener("keydown", handleEscape);
      document.addEventListener("keydown", handleFocusTrap);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";

      // Focus the close button when modal opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleFocusTrap);
      if (scrollY === null) return;

      // Back to the stylesheet default rather than forcing "auto".
      document.body.style.overflow = "";

      // Restore focus WITHOUT letting the browser scroll the focused element
      // into view: clicks do not reliably set focus (Safari never focuses
      // clicked buttons), so this element can be far from where the user was.
      previousActiveElement.current?.focus({ preventScroll: true });

      // Pin the page back exactly where it was when the reader opened;
      // instant so the global smooth scroll-behavior cannot animate it.
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full h-full max-w-6xl max-h-[90vh] m-4 bg-background rounded-lg shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={title || "PDF viewer"}
        aria-describedby="pdf-viewer-content"
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
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
            inModal={true}
          />
        </div>
      </div>
    </div>
  );
}
