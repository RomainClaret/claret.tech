"use client";

import { useEffect, useState } from "react";
import { m, AnimatePresence, LazyMotion, domMax } from "framer-motion";
// Deep per-icon imports; see the note in pdf-viewer.tsx (lazy-chunk barrel bug).
import X from "lucide-react/dist/esm/icons/x";
import Minimize2 from "lucide-react/dist/esm/icons/minimize-2";
import Maximize2 from "lucide-react/dist/esm/icons/maximize-2";
import { PerformanceDashboard } from "./PerformanceDashboard";
import { cn } from "@/lib/utils";

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

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
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

  return (
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
          />

          {/* Modal */}
          <m.div
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
                {/* Minimize/Maximize Button */}
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 hover:bg-muted rounded-md transition-colors"
                  title={isMinimized ? "Maximize" : "Minimize"}
                >
                  {isMinimized ? (
                    <Maximize2 className="w-4 h-4" />
                  ) : (
                    <Minimize2 className="w-4 h-4" />
                  )}
                </button>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded-md transition-colors"
                  title="Close (ESC)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <AnimatePresence>
              {!isMinimized && (
                <m.div
                  className="flex-1 overflow-auto"
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

          {/* Instructions overlay (when open) */}
          {!isMinimized && (
            <m.div
              className="absolute top-4 right-4 bg-black/80 text-white px-3 py-2 rounded-md text-sm"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              Press <kbd className="px-1 py-0.5 bg-white/20 rounded">ESC</kbd>{" "}
              to close
            </m.div>
          )}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
