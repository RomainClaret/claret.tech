"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  Loader2,
  AlertCircle,
} from "lucide-react";

// Import from our PDF configuration module (worker pre-configured)
import { Document, Page } from "@/lib/pdf-config";
import { logError } from "@/lib/utils/dev-logger";
import { setupPDFConsoleFilter } from "@/lib/utils/pdf-console-filter";

interface PDFViewerProps {
  url: string;
  title?: string;
  downloadFileName?: string;
  inModal?: boolean;
}

export function PDFViewer({
  url,
  title,
  downloadFileName,
  inModal = false,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fontWarning, setFontWarning] = useState(false);
  const [disableFontFace, setDisableFontFace] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement }>({});

  // Setup PDF console filter on mount
  useEffect(() => {
    setupPDFConsoleFilter();
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  // Monitor for font warnings
  useEffect(() => {
    if (loading) return;

    const originalWarn = console.warn;
    const originalError = console.error;

    const checkForFontWarning = (args: unknown[]) => {
      const message = args.join(" ");
      if (
        message.includes("Failed to load font") ||
        message.includes("OTS parsing error") ||
        message.includes("Unknown/unsupported post table") ||
        message.includes("Warning: TT:") ||
        message.includes("Warning: FormatError:")
      ) {
        setFontWarning(true);
      }
    };

    console.warn = (...args) => {
      checkForFontWarning(args);
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      checkForFontWarning(args);
      originalError.apply(console, args);
    };

    // Restore original console methods on cleanup
    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [loading]);

  const onDocumentLoadError = (error: Error) => {
    logError(error, "PDF Viewer - Document Load");
    setError("Failed to load PDF. Please try again later.");
    setLoading(false);
  };

  const zoomIn = () => setScale((prevScale) => Math.min(prevScale + 0.2, 2.0));
  const zoomOut = () => setScale((prevScale) => Math.max(prevScale - 0.2, 0.5));

  // Handle page navigation
  const scrollToPage = (page: number) => {
    const pageElement = pageRefs.current[page];
    if (pageElement && scrollContainerRef.current) {
      pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      setPageNumber(page);
    }
  };

  const previousPage = () => {
    if (pageNumber > 1) {
      scrollToPage(pageNumber - 1);
    }
  };

  const nextPage = () => {
    if (numPages && pageNumber < numPages) {
      scrollToPage(pageNumber + 1);
    }
  };

  // Update page number based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current || !numPages) return;

      const container = scrollContainerRef.current;
      const containerHeight = container.clientHeight;

      // Find which page is most visible
      let mostVisiblePage = 1;
      let maxVisibleHeight = 0;

      for (let i = 1; i <= numPages; i++) {
        const pageElement = pageRefs.current[i];
        if (!pageElement) continue;

        const rect = pageElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const pageTop = rect.top - containerRect.top;
        const pageBottom = rect.bottom - containerRect.top;

        const visibleTop = Math.max(0, pageTop);
        const visibleBottom = Math.min(containerHeight, pageBottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        if (visibleHeight > maxVisibleHeight) {
          maxVisibleHeight = visibleHeight;
          mostVisiblePage = i;
        }
      }

      setPageNumber(mostVisiblePage);
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [numPages]);

  // Memoize PDF options to prevent unnecessary re-renders
  const pdfOptions = useMemo(
    () => ({
      disableFontFace,
      isEvalSupported: false,
    }),
    [disableFontFace],
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className={`border-b border-border p-4 ${inModal ? "pr-16" : ""}`}>
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <h2 className="text-xl font-semibold truncate">
            {title || "PDF Viewer"}
          </h2>
          <button
            onClick={() => {
              // Create a temporary anchor element to trigger download
              const link = document.createElement("a");
              link.href = url;
              link.download = downloadFileName || "document.pdf";
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
            aria-label="Download PDF"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* PDF Controls */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={previousPage}
            disabled={pageNumber <= 1}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-sm">
            Page {pageNumber} of {numPages || "..."}
          </span>

          <button
            onClick={nextPage}
            disabled={!numPages || pageNumber >= numPages}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="h-4 w-px bg-border mx-2" />

          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>

          <span className="text-sm min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={zoomIn}
            disabled={scale >= 2.0}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Font Warning Banner */}
      {fontWarning && !disableFontFace && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
              <AlertCircle className="w-4 h-4" />
              <span>Some fonts in this PDF may not display correctly.</span>
            </div>
            <button
              onClick={() => setDisableFontFace(true)}
              className="text-xs text-yellow-700 dark:text-yellow-300 hover:underline"
              aria-label="Use fallback fonts for better compatibility"
            >
              Use fallback fonts
            </button>
          </div>
        </div>
      )}

      {/* PDF Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div className="flex flex-col items-center p-4">
          {loading && (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <p className="text-destructive mb-4">{error}</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Open PDF in new tab
              </a>
            </div>
          )}

          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading=""
            className="max-w-full"
            options={pdfOptions}
          >
            {/* Render all pages for natural scrolling */}
            {numPages &&
              Array.from(new Array(numPages), (el, index) => (
                <div
                  key={`page_${index + 1}`}
                  className="mb-4"
                  ref={(el) => {
                    if (el) pageRefs.current[index + 1] = el;
                  }}
                >
                  <Page
                    pageNumber={index + 1}
                    scale={scale}
                    className="shadow-lg"
                    renderTextLayer={!disableFontFace}
                    renderAnnotationLayer={true}
                  />
                </div>
              ))}
          </Document>
        </div>
      </div>
    </div>
  );
}
