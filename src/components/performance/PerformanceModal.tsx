"use client";

import { useEffect, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/lib/hooks/useIsomorphicLayoutEffect";
import { createPortal } from "react-dom";
import { m, AnimatePresence, LazyMotion, domMax } from "framer-motion";
// Deep per-icon imports; see the note in pdf-viewer.tsx (lazy-chunk barrel bug).
import X from "lucide-react/dist/esm/icons/x";
import Minimize2 from "lucide-react/dist/esm/icons/minimize-2";
import Maximize2 from "lucide-react/dist/esm/icons/maximize-2";
import { PerformanceDashboard } from "./PerformanceDashboard";
import { cn } from "@/lib/utils";
import { lockPageScroll } from "@/lib/utils/scroll-lock";

interface PerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PerformanceModal({ isOpen, onClose }: PerformanceModalProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  // No overlay lock, unlike the content modals: this dashboard samples the
  // page's frame rate and CPU while it is open, and pausing the decorative
  // motion behind it would make it report an idle page.
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Escape, and the scroll lock, in place before the browser paints the
  // dashboard: loaded lazily, a passive effect ran later, and an Escape
  // pressed in between reached the performance monitor and closed it.
  useIsomorphicLayoutEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isOpen) return;
      // Typed inside a modal dialog (the PDF reader), it is that dialog's:
      // this panel, opened before it, listens first and closed with it.
      if (
        e.target instanceof Element &&
        e.target.closest('[aria-modal="true"]')
      ) {
        return;
      }
      // Used: the performance monitor, listening on window, leaves it.
      e.preventDefault();
      onClose();
    };

    // The page's scroll stays locked while the dashboard is open, counted
    // with the dialogs': closing it over the PDF reader keeps the reader's.
    const release = isOpen ? lockPageScroll() : null;
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      release?.();
    };
  }, [isOpen, onClose]);

  // Reset position when opening
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
      setIsMinimized(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // At the end of <body>, as the site's dialogs are: rendered in place, at
  // the same z-index, it painted under a PDF reader already open, which a
  // portal puts later in the document.
  return createPortal(
    // The one draggable element on the site: drag is in domMax, which the
    // app-wide LazyMotion (domAnimation) leaves out of the first load.
    <LazyMotion features={domMax}>
      <AnimatePresence>
        <m.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <m.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* A dialog, but not a modal one: it opens from the terminal, which
              stays above it and keeps the focus, and aria-modal would hide a
              terminal that is still there. */}
          <m.div
            role="dialog"
            aria-label="Performance dashboard"
            className={cn(
              "relative bg-background border border-border shadow-2xl",
              "flex flex-col overflow-hidden",
              isMinimized
                ? "w-80 h-16"
                : "w-[95vw] h-[95vh] max-w-7xl max-h-[95vh]",
            )}
            style={{
              borderRadius: "12px",
              x: position.x,
              y: position.y,
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag={!isMinimized}
            dragElastic={0.1}
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(_, info) => {
              setIsDragging(false);
              setPosition((prev) => ({
                x: prev.x + info.offset.x,
                y: prev.y + info.offset.y,
              }));
            }}
          >
            {/* Header */}
            <div
              className={cn(
                "flex items-center justify-between px-6 py-4 border-b border-border",
                "bg-gradient-to-r from-primary/5 to-purple-500/5",
                isDragging ? "cursor-grabbing" : "cursor-grab",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <h2 className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Performance Dashboard
                </h2>
                <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                  Terminal Access Only
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* In the header, beside the buttons: floated at the window's
                    top right, below 1920 px wide it lay over them, and at
                    1280 it took a click at the close button's centre. */}
                {!isMinimized && (
                  <span className="mr-2 text-xs text-muted-foreground">
                    Press{" "}
                    <kbd className="rounded bg-muted px-1 py-0.5">ESC</kbd> to
                    close
                  </span>
                )}

                {/* Minimize/Maximize Button */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 hover:bg-muted rounded-md transition-colors"
                  title={isMinimized ? "Maximize" : "Minimize"}
                  aria-label={
                    isMinimized
                      ? "Maximize performance dashboard"
                      : "Minimize performance dashboard"
                  }
                >
                  {isMinimized ? (
                    <Maximize2 className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Minimize2 className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded-md transition-colors"
                  title="Close (ESC)"
                  aria-label="Close performance dashboard"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Content */}
            <AnimatePresence>
              {!isMinimized && (
                // A Tab stop of its own: nothing in the dashboard takes
                // focus, so the keyboard could not scroll it.
                <m.div
                  tabIndex={0}
                  role="region"
                  aria-label="Dashboard metrics"
                  className="flex-1 overflow-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="p-6">
                    <PerformanceDashboard />
                  </div>
                </m.div>
              )}
            </AnimatePresence>

            {/* Minimized state content */}
            {isMinimized && (
              <div className="flex-1 flex items-center px-6">
                <span className="text-sm text-muted-foreground">
                  Performance Dashboard (minimized) - Click maximize to expand
                </span>
              </div>
            )}
          </m.div>
        </m.div>
      </AnimatePresence>
    </LazyMotion>,
    document.body,
  );
}
