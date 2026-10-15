"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import X from "lucide-react/dist/esm/icons/x";
import { useModalDialog } from "@/lib/hooks/useModalDialog";
import { useOverlayLock } from "@/lib/hooks/useMotionGate";
import { usePDFViewer } from "@/lib/hooks/usePDFViewer";
import { useResearchMap, type MapView } from "@/lib/hooks/useResearchMap";
import { layoutResearchGraph } from "@/lib/utils/research-map-layout";
import type { MapDocument, MapNode } from "@/lib/utils/graph-algorithms";
import { loadPdfModal } from "@/components/ui/pdf-modal-loader";
import { MapToolbar } from "./map-toolbar";
import { MapCanvas } from "./map-canvas";
import { MapList } from "./map-list";
import { MapDetails, connectionsOf } from "./map-details";
import { KindMark } from "./map-node";
import { siteResearchGraph } from "./site-graph";

// The site's own reader, over the map: mounted later, so it paints above it
// at the same z-index, and useModalDialog gives it the keys while it is open.
const PDFModal = dynamic(loadPdfModal, { ssr: false, loading: () => null });

/** Why the map closed: dismissed, or left for an item's card on the page. */
export type CloseReason = "dismiss" | "navigate";

interface ResearchMapDialogProps {
  onClose: (reason: CloseReason) => void;
  /** Where focus goes back on close; defaults to what had it on open. */
  returnFocus?: HTMLElement | null;
}

const matches = (query: string) =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(query).matches;

/** Phones start in the list: the drawing needs more room than they have. */
const startView = (): MapView =>
  matches("(max-width: 639px)") ? "list" : "map";

/**
 * The research map: the owner's papers and research cards by line of work,
 * over time, and the reasons they belong together. A modal dialog in a
 * portal, mounted only while open, as the project details dialog is: no
 * framer (it opens when framer's chunk failed), no backdrop blur, one
 * entrance under motion-safe and nothing that loops. On a phone it is a
 * bottom sheet that starts in the list.
 */
export function ResearchMapDialog({
  onClose,
  returnFocus,
}: ResearchMapDialogProps) {
  useOverlayLock(true);
  const dialogRef = useModalDialog<HTMLDivElement>(
    true,
    () => onClose("dismiss"),
    { lockScroll: true, returnFocus },
  );
  const titleId = useId();
  const descriptionId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const detailsRef = useRef<HTMLElement>(null);

  const graph = useMemo(() => siteResearchGraph(), []);
  const items = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph],
  );
  const lanes = useMemo(
    () => new Map(graph.lanes.map((lane) => [lane.id, lane])),
    [graph],
  );
  const toggleLanes = useMemo(
    () =>
      graph.lanes.filter((lane) =>
        graph.nodes.some((node) => node.lane === lane.id),
      ),
    [graph],
  );
  const [initialView] = useState(startView);
  const map = useResearchMap(graph, initialView);
  const layout = useMemo(() => layoutResearchGraph(map.shown), [map.shown]);
  const pdf = usePDFViewer();

  const selected = map.selectedId ? (items.get(map.selectedId) ?? null) : null;

  // Under the map on narrower screens: chosen there, the details would
  // change below the fold, out of sight.
  useEffect(() => {
    if (map.view !== "map" || !map.selectedId || matches("(min-width: 1024px)"))
      return;
    detailsRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [map.view, map.selectedId]);

  const jumpTo = (id: string) => {
    map.select(id);
    map.setFocusId(id);
    // Where the reader is now: the item's title beside the map, its own
    // button in the list.
    requestAnimationFrame(() => {
      if (map.view === "map")
        headingRef.current?.focus({ preventScroll: false });
      else
        [
          ...(dialogRef.current?.querySelectorAll<HTMLButtonElement>(
            "[data-item]",
          ) ?? []),
        ]
          .find((button) => button.dataset.item === id)
          ?.focus();
    });
  };

  const openDocument = (document: MapDocument, node: MapNode) =>
    pdf.openPDF(
      document.url,
      node.title,
      document.url.split("/").pop() || "document.pdf",
    );

  const showOnPage = (id: string) => {
    onClose("navigate");
    // After the dialog is gone and the page's scroll is back: then the
    // card's deep link scrolls to it and lights it.
    requestAnimationFrame(() => {
      if (!document.getElementById(id)) {
        window.location.href = `/#${id}`;
      } else if (window.location.hash === `#${id}`) {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } else {
        window.location.hash = id;
      }
    });
  };

  const details = (node: MapNode | null, level: 3 | 4) => (
    <MapDetails
      ref={headingRef}
      node={node}
      lane={node ? lanes.get(node.lane) : undefined}
      connections={node ? connectionsOf(node.id, map.shown, items) : []}
      onSelect={jumpTo}
      onOpenDocument={openDocument}
      onShowOnPage={showOnPage}
      level={level}
    />
  );

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4">
          <div
            aria-hidden="true"
            data-testid="research-map-backdrop"
            onClick={() => onClose("dismiss")}
            className="absolute inset-0 bg-background/90"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            data-testid="research-map"
            // On a phone the sheet is the one scroller, its header sticky:
            // a fixed toolbar left the list a third of the screen. Wider,
            // the toolbar stays and the map and details scroll inside.
            className="relative flex max-h-[90vh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-background shadow-2xl outline-none supports-[height:100dvh]:max-h-[90dvh] sm:max-w-7xl sm:overflow-hidden sm:rounded-xl motion-safe:animate-[slideUp_200ms_ease-out]"
          >
            <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-background p-4 sm:static sm:px-6">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-lg font-bold sm:text-xl">
                  Research map
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1 text-sm text-muted-foreground"
                >
                  Papers and research projects by line of work, over time. Each
                  line joins two items and says why: shared code, co-authors, a
                  venue, or a research card that links them.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onClose("dismiss")}
                aria-label="Close research map"
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <MapToolbar
              view={map.view}
              onView={map.setView}
              lanes={toggleLanes}
              hiddenLanes={map.hiddenLanes}
              onToggleLane={map.toggleLane}
              kinds={map.kinds}
              hiddenKinds={map.hiddenKinds}
              onToggleKind={map.toggleKind}
              isFiltered={map.isFiltered}
              onReset={map.reset}
              summary={map.summary}
            />

            {map.view === "map" ? (
              <div className="flex flex-col sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:overscroll-contain lg:flex-row lg:overflow-hidden">
                <div className="min-w-0 lg:flex-1 lg:overflow-y-auto">
                  {layout.nodes.length > 0 ? (
                    <MapCanvas map={map} layout={layout} items={items} />
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground sm:px-6">
                      Nothing to show: every line of work is hidden.
                    </p>
                  )}
                  <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-6">
                    <span className="inline-flex items-center gap-1.5">
                      <KindMark kind="publication" /> Paper
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <KindMark kind="other-work" /> Other work
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <KindMark kind="project" /> Research card
                    </span>
                  </p>
                </div>
                <aside
                  ref={detailsRef}
                  aria-label="Details"
                  className="border-t border-border p-4 sm:px-6 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0"
                >
                  {details(selected, 3)}
                </aside>
              </div>
            ) : (
              <div className="sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:overscroll-contain">
                <MapList map={map} renderDetails={(node) => details(node, 4)} />
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
      {pdf.isOpen && (
        <PDFModal
          isOpen={pdf.isOpen}
          onClose={pdf.closePDF}
          pdfUrl={pdf.pdfUrl}
          title={pdf.title}
          downloadFileName={pdf.downloadFileName}
          shareSlug={pdf.shareSlug}
        />
      )}
    </>
  );
}
