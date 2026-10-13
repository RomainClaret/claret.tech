"use client";

import { type ComponentProps } from "react";
import { createPortal } from "react-dom";
import type { PDFModal } from "./pdf-modal";
import { loadPdfReader, loadedPdfReader } from "@/lib/pdf-reader-preload";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { useOverlayLock } from "@/lib/hooks/useMotionGate";
import { useModalDialog } from "@/lib/hooks/useModalDialog";
import { logError } from "@/lib/utils/dev-logger";
import { reloadPage } from "@/lib/utils/reload-page";

type PDFModalProps = ComponentProps<typeof PDFModal>;

/**
 * Shown in place of the reader when its chunk cannot be fetched, so a
 * failed download is a message in a dialog rather than an error that takes
 * the page down. The PDF itself can still be opened in the browser's own
 * viewer.
 */
function PdfReaderUnavailable({
  isOpen,
  onClose,
  pdfUrl,
  title,
  retry,
  retrying,
}: PDFModalProps & { retry: () => void; retrying: boolean }) {
  // A modal like the reader it stands in for (pdf-modal.tsx): the page
  // behind pauses and does not scroll, focus moves into the dialog and
  // stays there, and both come back on close. Without it, keyboard and
  // screen reader users were left behind an aria-modal dialog. The dialog
  // itself takes focus: "Try again" is disabled while its first try runs.
  useOverlayLock(isOpen);
  const dialogRef = useModalDialog<HTMLDivElement>(isOpen, onClose, {
    lockScroll: true,
  });

  // At the end of <body>, as the reader it stands in for: in place, the
  // cookie notice painted over it.
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title || "PDF viewer"}
        className="relative m-4 max-w-md space-y-4 rounded-lg bg-background p-6 shadow-2xl outline-none"
      >
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        <p className="text-muted-foreground">
          Could not load the PDF reader. Check your connection and try again.
        </p>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="text-primary hover:underline disabled:opacity-60 disabled:no-underline"
          >
            {retrying ? "Trying again..." : "Try again"}
          </button>
          {/* Once a retry has failed too: a deploy may have replaced the
              reader's chunk since this page loaded. */}
          {!retrying && (
            <button
              type="button"
              onClick={reloadPage}
              className="text-primary hover:underline"
            >
              Reload page
            </button>
          )}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Open the PDF
          </a>
          <button
            type="button"
            onClick={onClose}
            className="text-primary hover:underline"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The loader for every section's next/dynamic PDFModal. */
export const loadPdfModal = withLoadFallback<PDFModalProps>(
  () => loadPdfReader().then((mod) => mod.PDFModal),
  PdfReaderUnavailable,
  {
    onError: (error) => logError(error, "PDF reader chunk"),
    peek: () => loadedPdfReader()?.PDFModal,
  },
);
