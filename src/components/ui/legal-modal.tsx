"use client";

import { X } from "lucide-react";
import { useModalDialog } from "@/lib/hooks/useModalDialog";
import { useOverlayLock } from "@/lib/hooks/useMotionGate";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function LegalModal({
  isOpen,
  onClose,
  title,
  children,
}: LegalModalProps) {
  // Covers the page: decorative motion behind it pauses until it closes.
  useOverlayLock(isOpen);
  // Focus, Tab, Escape, the page's scroll and its place, as the site's other
  // dialogs. Its own trap only wrapped at the first and last control, so
  // macOS WebKit's Tab left it from anywhere in between; and its cleanup ran
  // for every instance on each render of the provider (inline closers), so
  // a closed one sent focus, and the page, back to the opener it remembered
  // from an earlier visit.
  const dialogRef = useModalDialog<HTMLDivElement>(isOpen, onClose, {
    lockScroll: true,
  });

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
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full h-full max-w-4xl max-h-[90vh] m-4 bg-background rounded-lg shadow-2xl flex flex-col border border-border outline-none"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label={`Close ${title}`}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content: a Tab stop of its own, so the keyboard can scroll a text
            with no links in it (the License). */}
        <div
          id="legal-content"
          tabIndex={0}
          role="region"
          aria-label={`${title} text`}
          className="flex-1 overflow-y-auto p-6 text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
