"use client";

import { useState, useEffect, useMemo, useRef } from "react";
// Deep per-icon imports, NOT the "lucide-react" barrel: in LAZILY loaded
// components, Next's default lucide barrel optimization emits requires of
// __barrel_optimize__ proxy modules that no chunk defines, crashing the
// page in webpack dev (2026-07-20). Entry-graph files can keep the barrel.
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Download from "lucide-react/dist/esm/icons/download";
import ZoomIn from "lucide-react/dist/esm/icons/zoom-in";
import ZoomOut from "lucide-react/dist/esm/icons/zoom-out";
import Loader2 from "lucide-react/dist/esm/icons/loader-circle";
import AlertCircle from "lucide-react/dist/esm/icons/circle-alert";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import Check from "lucide-react/dist/esm/icons/check";

// Import from our PDF configuration module (worker pre-configured)
import { Document, Page } from "@/lib/pdf-config";
import { isSafePdfUrl } from "@/lib/utils/safe-pdf-url";
import { fitScale, widestPageWidth, MIN_SCALE } from "@/lib/utils/pdf-fit";
import { logError } from "@/lib/utils/dev-logger";
import { setupPDFConsoleFilter } from "@/lib/utils/pdf-console-filter";

/**
 * Text-layer errors worth surfacing.
 *
 * pdf.js cancels an in-flight text layer whenever its render is superseded (a
 * re-render, a scale change, an unmount) by rejecting with an AbortException,
 * see TextLayer.cancel(). That is a control signal, not a failure, and the
 * pages still render; react-pdf's default handler logs it to console.error,
 * which surfaces as a Next error overlay. Auto-fit changes the scale once per
 * document, so it fires once per page on open.
 *
 * Swallow only that, and let everything else through: muting the whole channel
 * would hide text layers that genuinely failed to build.
 */
export function handleTextLayerError(error: unknown): void {
  if (error instanceof Error && error.name === "AbortException") return;
  logError(
    error instanceof Error ? error : new Error(String(error)),
    "PDF Viewer - Text Layer",
  );
}

/** The bits of react-pdf's PDFDocumentProxy this component actually uses. */
interface PDFDocumentProxyLike {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (p: { scale: number }) => { width: number };
  }>;
}

interface PDFViewerProps {
  url: string;
  title?: string;
  downloadFileName?: string;
  /**
   * The document's own page, copied as `${origin}/pdf/<slug>` by the share
   * control. Resolved by usePDFViewer, or handed straight down by the
   * /pdf/[slug] route. Omitted when the document has no page, and the control
   * is then not rendered rather than offering a link that would 404.
   */
  shareSlug?: string;
  inModal?: boolean;
}

/**
 * Copies a link to the document's own page.
 *
 * Local rather than the shared CopyLinkButton: that one copies a homepage
 * anchor (`/#<id>`), uses a link icon, and imports from the lucide-react
 * barrel, which is what the note at the top of this file says breaks a lazily
 * loaded chunk.
 */
function ShareLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/pdf/${slug}`,
      );
    } catch {
      // Denied, or unavailable over plain http. Say nothing rather than show a
      // success state for a copy that did not happen.
      return;
    }
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
      title={copied ? "Link copied" : "Copy link to this document"}
      aria-label="Copy link to this document"
    >
      {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
    </button>
  );
}

export function PDFViewer({
  url,
  title,
  downloadFileName,
  shareSlug,
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

  // Width of the widest page in points, from the document metadata. Null
  // until measured; 0 means the document could not be measured.
  const [widestPage, setWidestPage] = useState<number | null>(null);

  const onDocumentLoadSuccess = (pdf: PDFDocumentProxyLike) => {
    setNumPages(pdf.numPages);
    setLoading(false);
    setError(null);

    // Page sizes come from the metadata rather than from rendered canvases,
    // so the fit does not depend on render timing. Deliberately not awaited:
    // the document paints immediately and the fit applies when this resolves.
    widestPageWidth(pdf)
      .then(setWidestPage)
      .catch(() => setWidestPage(0));
  };

  // Auto-fit so nothing needs sideways scrolling: scale 1.0 is the PDF's
  // native point size, which fits an A4 portrait page but overflows for 16:9
  // slides and for the landscape pages that turn up partway through an
  // otherwise portrait thesis.
  //
  // Fitting the WIDEST page, not the first. Measuring page one leaves a
  // document that opens portrait and turns landscape later overflowing on
  // exactly those later pages.
  //
  // Recomputed from the natural page width every time the viewer resizes,
  // rather than once from whatever the current scale happens to be. A one-shot
  // fit measured whatever width the container had at that instant, and the
  // metadata can resolve before the modal has finished laying out, which left
  // a document zoomed to 89% in a viewer it would have fitted at 100%.
  // Deriving from scale 1 each time also stops the correction compounding.
  //
  // Stops as soon as the reader zooms by hand; their choice wins after that.
  const [userZoomed, setUserZoomed] = useState(false);
  useEffect(() => {
    if (userZoomed || !widestPage || widestPage <= 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const applyFit = () => {
      const available = container.clientWidth - 32; // p-4 padding
      if (available <= 0) return;
      setScale(fitScale(widestPage, available, 1));
    };

    applyFit();
    const observer = new ResizeObserver(applyFit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [widestPage, userZoomed]);

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

  // Both flag userZoomed so the auto-fit stops overriding a deliberate choice
  // on the next resize.
  const zoomIn = () => {
    setUserZoomed(true);
    setScale((prevScale) => Math.min(prevScale + 0.2, 2.0));
  };
  const zoomOut = () => {
    setUserZoomed(true);
    setScale((prevScale) => Math.max(prevScale - 0.2, MIN_SCALE));
  };

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
          <div className="flex items-center gap-2 flex-shrink-0">
            {shareSlug && <ShareLinkButton slug={shareSlug} />}
            <button
              onClick={() => {
                // Defense in depth: never navigate a raw-DOM anchor to a
                // non-https, non-local URL (pdfUrl can come from external APIs).
                if (!isSafePdfUrl(url)) return;
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
            disabled={scale <= 0.25}
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
        {/* w-max + min-w-full: fills and centres while the page is
            narrower than the viewer, and grows with it once zoomed in so
            the overflow stays reachable. A plain centred flex item that
            outgrows its container puts its left edge out of scroll range. */}
        <div className="flex flex-col items-center p-4 w-max min-w-full">
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
            options={pdfOptions}
          >
            {/* Render all pages for natural scrolling */}
            {numPages &&
              Array.from(new Array(numPages), (el, index) => (
                <div
                  key={`page_${index + 1}`}
                  // justify-center, not just mb-4: the Document box is as wide
                  // as the widest page, so in a mixed-orientation document a
                  // block-level wrapper leaves every portrait page flush left
                  // with all the slack piled on the right.
                  // max-w-none overrides react-pdf's own
                  // .react-pdf__Page__canvas { max-width: 100% }, which
                  // otherwise caps a zoomed page at the viewer width and
                  // makes the zoom control stop having any effect.
                  className="mb-4 flex justify-center [&_.react-pdf__Page__canvas]:max-w-none"
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
                    onRenderTextLayerError={handleTextLayerError}
                    onGetTextError={handleTextLayerError}
                  />
                </div>
              ))}
          </Document>
        </div>
      </div>
    </div>
  );
}
