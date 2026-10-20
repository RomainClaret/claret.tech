"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
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
import {
  fitScale,
  pageSizes,
  widestOf,
  MIN_SCALE,
  MAX_SCALE,
  type PageSize,
} from "@/lib/utils/pdf-fit";
import { logError } from "@/lib/utils/dev-logger";
import {
  fixLinkAnnotations,
  watchLinkAnnotations,
} from "@/lib/utils/pdf-links";
import { createLinkNameBook } from "@/lib/utils/pdf-link-names";
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
    getViewport: (p: { scale: number }) => { width: number; height?: number };
  }>;
}

/**
 * How far beyond the reader's own height a page still gets its canvas: two
 * screens above and two below. A canvas holds the page's pixels at the
 * screen's density, about 22 MB for an A4 page fitted to a 1100 px reader at
 * DPR 2, and drawing all 368 pages of the PhD thesis asked for 7.8 GB.
 */
const DRAW_MARGIN = "200% 0px";

/** Pages drawn before their sizes are known: the first screen. */
const FIRST_PAGES = 2;
const firstScreenPages = (): ReadonlySet<number> =>
  new Set(Array.from({ length: FIRST_PAGES }, (_, i) => i + 1));

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
      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
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

  // Links within the document are named by the text printed under them,
  // page by page, once per document (pdf-link-names.ts); a page's names
  // that arrive after its links are on screen go to the links in its box.
  const [linkNames] = useState(() => createLinkNameBook());
  useEffect(
    () =>
      linkNames.listen((page, nameOf) => {
        const box = pageRefs.current[page];
        if (box) fixLinkAnnotations(box, nameOf);
      }),
    [linkNames],
  );

  // pdf.js leaves each link unnamed, announced as "link" and nothing else:
  // each gets a name (pdf-links.ts).
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;
    return watchLinkAnnotations(root, linkNames.nameOf);
  }, [linkNames]);

  // Setup PDF console filter on mount
  useEffect(() => {
    setupPDFConsoleFilter();
  }, []);

  // Every page's size at scale 1, from the document metadata. Null until
  // measured; empty when the document could not be measured.
  const [sizes, setSizes] = useState<PageSize[] | null>(null);
  // Width of the widest page in points. Null until measured; 0 means the
  // document could not be measured.
  const widestPage = useMemo(() => (sizes ? widestOf(sizes) : null), [sizes]);

  // The pages near the viewport, which get a canvas; the rest keep only
  // their text and link layers (renderMode "none"), so find-in-page,
  // selection and links still reach every page. Each page's box is sized
  // from `sizes`, so swapping a canvas in or out moves nothing.
  // Starts with the first screen's pages, which are already drawn, so they
  // stay drawn until the observer's first report replaces this.
  const [nearPages, setNearPages] =
    useState<ReadonlySet<number>>(firstScreenPages);

  // Which document load is current. Measuring takes a getPage per page (368
  // for the thesis); if the fallback fonts reload the document meanwhile,
  // the old proxy is destroyed, its getPage calls reject, and pageSizes
  // turns those into zero sizes: landing after the reload, they collapsed
  // every page box until the new measuring finished. Bumped on unmount too,
  // so nothing lands on a closed reader.
  const loadIdRef = useRef(0);
  useEffect(
    () => () => {
      loadIdRef.current++;
    },
    [],
  );

  // The document the page boxes are laid out for.
  const laidOutUrlRef = useRef<string | null>(null);

  // The column's size while react-pdf loads the document again (the
  // fallback fonts). Since 10.5 it unmounts every page box until the new
  // document arrives: the column collapsed, the browser clamped the scroll
  // to the top, and a reader on page 200 was on page 1 when the boxes came
  // back. Held at its size, the column keeps the scroll where it was.
  const [heldSize, setHeldSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Which load the page boxes on screen belong to: react-pdf 10.5 mounts
  // new boxes for each, which the page observer below must watch.
  const [boxesLoad, setBoxesLoad] = useState(0);

  const onDocumentLoadSuccess = (pdf: PDFDocumentProxyLike) => {
    // "Use fallback fonts" changes only the Document's options: react-pdf
    // loads the same document again and mounts new page boxes for it, which
    // get the same sizes, so the sizes stay, and so do the pages near the
    // view. The column held its size meanwhile, so the reader is where
    // they were, and it lets go now that the boxes are back. 632715b reset
    // the sizes here, which dropped every box past the first screen until
    // they were measured again, and WebKit then clamped a reader on page
    // 200 to page 1. A different document starts over.
    const load = ++loadIdRef.current;
    if (laidOutUrlRef.current !== url) {
      laidOutUrlRef.current = url;
      linkNames.reset();
      setSizes(null);
      setNearPages(firstScreenPages());
    }
    setHeldSize(null);
    setBoxesLoad(load);
    setNumPages(pdf.numPages);
    setLoading(false);
    setError(null);

    // Page sizes come from the metadata rather than from rendered canvases,
    // so the fit and the page boxes do not depend on render timing.
    // Deliberately not awaited: the first pages paint immediately, and the
    // fit and the rest of the pages follow when this resolves.
    pageSizes(pdf)
      .then((measured) => {
        if (load === loadIdRef.current) setSizes(measured);
      })
      .catch(() => {
        if (load === loadIdRef.current) setSizes([]);
      });
  };

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || !numPages || !sizes) return;
    const near = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          // A box react-pdf unmounted for a reload, reported out of view:
          // taken, it left the reader's page undrawn when its new box came
          // back, until every size was measured again.
          if (!entry.target.isConnected) continue;
          const page = Number((entry.target as HTMLElement).dataset.page);
          if (entry.isIntersecting === near.has(page)) continue;
          if (entry.isIntersecting) near.add(page);
          else near.delete(page);
          changed = true;
        }
        if (changed) setNearPages(new Set(near));
      },
      { root, rootMargin: DRAW_MARGIN },
    );
    for (let page = 1; page <= numPages; page++) {
      const element = pageRefs.current[page];
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [numPages, sizes, boxesLoad]);

  // The reader's place through a change of scale. A zoom or a fit rescales
  // every page box under the same scroll offset, which moved the reader:
  // zooming out on page 100 of the thesis showed page 115, and narrowing
  // the window refitted it to page 170, in Chromium and WebKit alike. So
  // every change of scale goes through rescale(), which notes the page most
  // in view (the counter's page), how far into it the view's top is, and
  // the horizontal centre; the layout effect below scrolls back to that
  // place once the boxes have their new size, before the frame is painted.
  const scaleRef = useRef(scale);
  const placeRef = useRef<{
    page: number;
    /** Where the view's top is in the page, as a share of its height. */
    into: number;
    /** The view's horizontal centre, as a share of the column's width. */
    centre: number;
  } | null>(null);

  const rescale = (next: number) => {
    if (next === scaleRef.current) return;
    const container = scrollContainerRef.current;
    // A reader at the very top stays there. Anchored on page 1 from above
    // the column's padding, the first fit at open left the view a few
    // pixels down the first page.
    placeRef.current = null;
    if (container && container.scrollTop > 0) {
      const view = container.getBoundingClientRect();
      let best: { page: number; into: number } | null = null;
      let most = 0;
      for (const [page, element] of Object.entries(pageRefs.current)) {
        if (!element.isConnected) continue;
        const box = element.getBoundingClientRect();
        const seen =
          Math.min(view.top + container.clientHeight, box.bottom) -
          Math.max(view.top, box.top);
        if (seen > most && box.height > 0) {
          most = seen;
          best = {
            page: Number(page),
            into: (view.top - box.top) / box.height,
          };
        }
      }
      placeRef.current = best && {
        ...best,
        centre:
          container.scrollWidth > container.clientWidth
            ? (container.scrollLeft + container.clientWidth / 2) /
              container.scrollWidth
            : 0.5,
      };
    }
    scaleRef.current = next;
    setScale(next);
  };

  useLayoutEffect(() => {
    const place = placeRef.current;
    placeRef.current = null;
    const container = scrollContainerRef.current;
    const element = place && pageRefs.current[place.page];
    if (!place || !container || !element?.isConnected) return;
    const view = container.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    container.scrollTop += box.top - view.top + place.into * box.height;
    if (container.scrollWidth > container.clientWidth) {
      container.scrollLeft =
        place.centre * container.scrollWidth - container.clientWidth / 2;
    }
  }, [scale]);

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
      rescale(fitScale(widestPage, available, 1));
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
    // A failed reload leaves no pages on screen, as a failed first load
    // does, so the counter and its buttons go back to that state. They kept
    // the old document's page count, and "next" counted up over page boxes
    // no longer in the page.
    setNumPages(null);
    setPageNumber(1);
    setHeldSize(null);
  };

  // Both flag userZoomed so the auto-fit stops overriding a deliberate choice
  // on the next resize.
  const zoomIn = () => {
    setUserZoomed(true);
    rescale(Math.min(scaleRef.current + 0.2, MAX_SCALE));
  };
  const zoomOut = () => {
    setUserZoomed(true);
    rescale(Math.max(scaleRef.current - 0.2, MIN_SCALE));
  };

  // Pages that have a box to scroll to: every page once the sizes are known,
  // the first screen's until then. Measuring takes a getPage per page (368
  // for the thesis), and "next" past the first screen meanwhile scrolled to
  // a page that did not exist yet: it did nothing, while the counter read
  // "of 368". It stays disabled there until the sizes arrive.
  const pagesInPlace = numPages
    ? sizes
      ? numPages
      : Math.min(numPages, FIRST_PAGES)
    : 0;

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
    if (pageNumber < pagesInPlace) {
      scrollToPage(pageNumber + 1);
    }
  };

  // Update the page number from the page most in view: on every scroll, and
  // on every layout that moves the pages without one. A zoom or a fit
  // rescales every page box under the same scroll offset (zooming out on
  // page 100 of the thesis showed page 120 under a counter still at 100, in
  // Chromium and WebKit alike), and a new document lays the boxes out
  // again.
  useEffect(() => {
    const updatePageNumber = () => {
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

      // No page in view: react-pdf has unmounted the boxes while it loads
      // the document again (each measures zero). The counter keeps its page
      // rather than naming page 1.
      if (maxVisibleHeight === 0) return;
      setPageNumber(mostVisiblePage);
    };

    const container = scrollContainerRef.current;
    if (!container || !numPages) return;
    container.addEventListener("scroll", updatePageNumber);
    // The viewer and the column of pages inside it: between them, a resize,
    // a zoom, a fit and a reload each change a size this reports.
    const observer = new ResizeObserver(updatePageNumber);
    observer.observe(container);
    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    }
    return () => {
      container.removeEventListener("scroll", updatePageNumber);
      observer.disconnect();
    };
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
          <div className="flex items-center gap-2 shrink-0">
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
              <Download className="w-4 h-4 shrink-0" />
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
            disabled={pageNumber >= pagesInPlace}
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
            disabled={scale >= MAX_SCALE}
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
              onClick={() => {
                // react-pdf destroys the current document as soon as the
                // options change, long before the new one loads: the
                // measuring in flight then rejects into zero sizes, which
                // landed while their load still looked current and
                // collapsed every page box. A new load id drops them.
                loadIdRef.current++;
                const column = scrollContainerRef.current?.firstElementChild;
                if (column instanceof HTMLElement) {
                  setHeldSize({
                    width: column.offsetWidth,
                    height: column.offsetHeight,
                  });
                }
                setDisableFontFace(true);
              }}
              className="text-xs text-yellow-700 dark:text-yellow-300 hover:underline"
              aria-label="Use fallback fonts for better compatibility"
            >
              Use fallback fonts
            </button>
          </div>
        </div>
      )}

      {/* PDF Content: a Tab stop of its own, so the keyboard can scroll a
          PDF with nothing to focus in it (posters, slides: no links). */}
      <div
        ref={scrollContainerRef}
        tabIndex={0}
        role="region"
        aria-label="Pages"
        className="flex-1 overflow-auto focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        {/* w-max + min-w-full: fills and centres while the page is
            narrower than the viewer, and grows with it once zoomed in so
            the overflow stays reachable. A plain centred flex item that
            outgrows its container puts its left edge out of scroll range. */}
        <div
          className="flex flex-col items-center p-4 w-max min-w-full"
          style={
            heldSize
              ? { minWidth: heldSize.width, minHeight: heldSize.height }
              : undefined
          }
        >
          {/* In words too: the icon alone said nothing to a screen reader,
              and it stands still in Safari and with motion off, where a
              load looked like a hang. */}
          {loading && (
            <div
              role="status"
              className="flex flex-col items-center justify-center gap-3 h-96"
            >
              <Loader2
                aria-hidden="true"
                className="w-8 h-8 animate-spin text-primary"
              />
              <p className="text-sm text-muted-foreground">
                Loading the PDF...
              </p>
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

          {/* No message of react-pdf's own: the viewer shows its spinner and
              its error above, and react-pdf's default "Failed to load PDF
              file." repeated the error under it. */}
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading=""
            error=""
            options={pdfOptions}
          >
            {/* Every page for natural scrolling, each in a box of its own
                size; only those near the viewport draw a canvas. Until the
                sizes are known, only the first screen's pages render. */}
            {numPages &&
              Array.from({ length: pagesInPlace }, (_, index) => {
                const page = index + 1;
                const size = sizes?.[index];
                const drawn = sizes ? nearPages.has(page) : true;
                const linkCallbacks = linkNames.pageCallbacks(page);
                return (
                  <div
                    key={`page_${page}`}
                    data-page={page}
                    // justify-center, not just mb-4: the Document box is as
                    // wide as the widest page, so in a mixed-orientation
                    // document a block-level wrapper leaves every portrait
                    // page flush left with all the slack piled on the right.
                    // globals.css caps the canvas at 100% of its box, and the
                    // box is sized from the page, so a zoom still goes past
                    // the viewer's width (pdf-reader.spec's zoom test).
                    className="mb-4 flex justify-center"
                    ref={(el) => {
                      if (el) pageRefs.current[page] = el;
                    }}
                  >
                    {/* The page's box: white, with the page's shadow, at
                          the canvas's own size (react-pdf floors it). It holds
                          the page's place whether or not it is drawn. */}
                    <div
                      className="bg-white shadow-lg"
                      style={
                        size && size.width > 0
                          ? {
                              width: Math.floor(size.width * scale),
                              height: Math.floor(size.height * scale),
                            }
                          : undefined
                      }
                    >
                      <Page
                        pageNumber={page}
                        scale={scale}
                        renderMode={drawn ? "canvas" : "none"}
                        renderTextLayer={!disableFontFace}
                        renderAnnotationLayer={true}
                        onRenderTextLayerError={handleTextLayerError}
                        onGetTextError={handleTextLayerError}
                        onGetAnnotationsSuccess={
                          linkCallbacks.onGetAnnotationsSuccess
                        }
                        onGetTextSuccess={linkCallbacks.onGetTextSuccess}
                        // The text layer is off with fallback fonts: a page
                        // not yet named fetches its text itself.
                        onLoadSuccess={
                          disableFontFace
                            ? linkCallbacks.onLoadSuccess
                            : undefined
                        }
                      />
                    </div>
                  </div>
                );
              })}
          </Document>
        </div>
      </div>
    </div>
  );
}
