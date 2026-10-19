"use client";

import { createPortal } from "react-dom";
import { usePerformanceMonitorContext } from "@/contexts/performance-monitor-context";
import { reloadPage } from "@/lib/utils/reload-page";
import { useModalDialog } from "@/lib/hooks/useModalDialog";

// Stand-ins for the terminal's performance tools while their code cannot be
// fetched (withLoadFallback in app-wrapper.tsx). The monitor (`fps`), the
// dashboard (`performance`) and the report load under the error boundary
// around the whole site, so a failed chunk replaced the page with its error
// screen until a reload. These say what failed and offer a retry instead.

export interface Fallback {
  retry: () => void;
  retrying: boolean;
}

function Actions({
  retry,
  retrying,
  onClose,
}: Fallback & { onClose: () => void }) {
  return (
    <div className="flex flex-wrap gap-4">
      <button
        type="button"
        onClick={retry}
        disabled={retrying}
        className="text-primary hover:underline disabled:opacity-60 disabled:no-underline"
      >
        {retrying ? "Trying again..." : "Try again"}
      </button>
      {/* Once a retry has failed too: a deploy may have replaced the chunk
          since this page loaded. */}
      {!retrying && (
        <button
          type="button"
          onClick={reloadPage}
          className="text-primary hover:underline"
        >
          Reload page
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="text-primary hover:underline"
      >
        Close
      </button>
    </div>
  );
}

/**
 * In the floating monitor's corner. Escape closes it, as it does the monitor.
 * At the end of <body>, as the monitor is: in place, at the PDF reader's
 * z-index, it painted under a reader already open.
 */
export function PerformanceMonitorUnavailable({ retry, retrying }: Fallback) {
  const { hidePerformanceMonitor } = usePerformanceMonitorContext();
  return createPortal(
    <div
      role="status"
      className="fixed top-4 right-4 z-9999 max-w-xs space-y-3 rounded-lg border border-border bg-background p-4 text-sm shadow-xl"
    >
      <p className="text-muted-foreground">
        Could not load the performance monitor.
      </p>
      <Actions
        retry={retry}
        retrying={retrying}
        onClose={hidePerformanceMonitor}
      />
    </div>,
    document.body,
  );
}

interface DialogProps extends Fallback {
  isOpen: boolean;
  onClose: () => void;
}

/** A terminal tool's stand-in dialog, named; the research map's too. */
export function ToolUnavailableDialog({
  name,
  isOpen,
  onClose,
  retry,
  retrying,
}: DialogProps & { name: string }) {
  const dialogRef = useModalDialog<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  return createPortal(
    // z-[9999], as PerformanceModal: at z-50 the cookie notice, also z-50
    // and later in the page, covered the backdrop and took clicks. And at
    // the end of <body>, as PerformanceModal too: in place, at the reader's
    // z-index, it painted under a PDF reader already open.
    <div className="fixed inset-0 z-9999 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={name.charAt(0).toUpperCase() + name.slice(1)}
        className="relative m-4 max-w-md space-y-4 rounded-lg bg-background p-6 shadow-2xl outline-hidden"
      >
        <p className="text-muted-foreground">
          Could not load the {name}. Check your connection and try again.
        </p>
        <Actions retry={retry} retrying={retrying} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}

/** In place of the performance dashboard (`performance`). */
export function PerformanceDashboardUnavailable(props: DialogProps) {
  return <ToolUnavailableDialog name="performance dashboard" {...props} />;
}

/** In place of the performance report. */
export function PerformanceReportUnavailable(props: DialogProps) {
  return <ToolUnavailableDialog name="performance report" {...props} />;
}
