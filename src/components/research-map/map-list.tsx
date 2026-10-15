"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { cn } from "@/lib/utils";
import type { MapNode } from "@/lib/utils/graph-algorithms";
import type { ResearchMapState } from "@/lib/hooks/useResearchMap";
import { KindMark } from "./map-node";
import { dateText, kindName } from "./map-styles";

/**
 * The research map as a list: one group per line of work, newest first,
 * each item a disclosure that opens its details in place. The view phones
 * start in, and the one for anyone who would rather read than scan a
 * drawing. It shares the map's filters and its open item.
 */
export function MapList({
  map,
  renderDetails,
}: {
  map: ResearchMapState;
  renderDetails: (node: MapNode) => ReactNode;
}) {
  const baseId = useId();
  const lanes = map.shown.lanes
    .map((lane) => ({
      lane,
      nodes: map.shown.nodes.filter((node) => node.lane === lane.id).reverse(),
    }))
    .filter(({ nodes }) => nodes.length > 0);

  if (lanes.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground sm:px-6">
        Nothing to show: every line of work is hidden.
      </p>
    );
  }
  return (
    <div className="space-y-6 p-4 sm:px-6">
      {lanes.map(({ lane, nodes }) => (
        <section key={lane.id} aria-labelledby={`${baseId}-${lane.id}`}>
          <h3
            id={`${baseId}-${lane.id}`}
            className="lane-ink mb-2 flex items-center gap-2 text-sm font-semibold"
            style={{ "--lane": lane.color } as CSSProperties}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full bg-[var(--ink)]"
            />
            {lane.label}
            <span className="font-normal text-muted-foreground">
              {nodes.length} {nodes.length === 1 ? "item" : "items"}
            </span>
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {nodes.map((node) => {
              const open = map.selectedId === node.id;
              const panelId = `${baseId}-${node.id}-details`;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    data-item={node.id}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => {
                      map.setFocusId(node.id);
                      map.select(open ? null : node.id);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <KindMark kind={node.kind} color={lane.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {node.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {kindName(node)}, {dateText(node)}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                  {open && (
                    <div
                      id={panelId}
                      className="border-t border-border bg-muted/30 px-3 py-3"
                    >
                      {renderDetails(node)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
