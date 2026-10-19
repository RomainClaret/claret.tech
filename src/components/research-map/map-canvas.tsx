"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import type { MapNode } from "@/lib/utils/graph-algorithms";
import type { ResearchMapState } from "@/lib/hooks/useResearchMap";
import {
  LAYOUT,
  navTarget,
  type MapLayout,
  type NavKey,
} from "@/lib/utils/research-map-layout";
import { MapNodeButton } from "./map-node";
import { MapEdgePath } from "./map-edge";

const NAV_KEYS: ReadonlySet<string> = new Set<NavKey>([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

interface MapCanvasProps {
  map: ResearchMapState;
  layout: MapLayout;
  items: ReadonlyMap<string, MapNode>;
}

/**
 * The research map's drawing. Lane titles stay in a column on the left;
 * the time axis scrolls sideways and opens at the newest work, on the
 * right. Lines, spans and ticks are an aria-hidden SVG; the items are
 * buttons over it, one Tab stop for the whole map (a roving tabindex):
 * the arrow keys move between items, Enter or Space opens one.
 */
export function MapCanvas({ map, layout, items }: MapCanvasProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const instructionsId = useId();
  const offset = LAYOUT.gutter;
  const width = Math.max(layout.width - offset, 0);
  const laneById = useMemo(
    () => new Map(layout.lanes.map((lane) => [lane.id, lane])),
    [layout.lanes],
  );
  const edgesById = useMemo(
    () => new Map(map.shown.edges.map((edge) => [edge.id, edge])),
    [map.shown.edges],
  );
  // Years with items get a label; the narrow empty ones only a tick.
  const labelled = useMemo(
    () => new Set(map.shown.nodes.map((node) => node.year)),
    [map.shown.nodes],
  );

  // Before paint, so the map never shows its oldest end first.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, []);

  // An item chosen elsewhere, from another item's connections, comes into
  // view.
  useEffect(() => {
    if (!map.selectedId) return;
    buttons.current
      .get(map.selectedId)
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [map.selectedId]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (!NAV_KEYS.has(event.key)) return;
    event.preventDefault();
    const next = navTarget(layout, map.shown.edges, id, event.key as NavKey);
    if (!next) return;
    map.setFocusId(next);
    const button = buttons.current.get(next);
    button?.focus({ preventScroll: true });
    button?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  const active = map.activeId;
  return (
    <div className="flex min-w-0">
      <div
        className="relative w-32 shrink-0 border-r border-border sm:w-44"
        style={{ height: layout.height }}
      >
        {layout.lanes.map((lane) => (
          <div
            key={lane.id}
            className="lane-ink absolute inset-x-0 flex items-center gap-2 px-3 text-xs font-semibold leading-tight text-foreground"
            style={
              {
                top: lane.y - LAYOUT.laneHeight / 2,
                height: LAYOUT.laneHeight,
                "--lane": lane.color,
              } as CSSProperties
            }
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-(--ink)"
            />
            {lane.label}
          </div>
        ))}
      </div>

      <div
        ref={scrollerRef}
        data-testid="research-map-scroller"
        className="relative min-w-0 flex-1 overflow-x-auto overscroll-x-contain"
      >
        <div className="relative" style={{ width, height: layout.height }}>
          <svg
            aria-hidden="true"
            width={width}
            height={layout.height}
            className="absolute inset-0"
          >
            <g transform={`translate(${-offset} 0)`}>
              {layout.years.map((tick) => (
                <line
                  key={tick.year}
                  x1={tick.x}
                  x2={tick.x}
                  y1={LAYOUT.top - 6}
                  y2={layout.height}
                  className="stroke-border"
                  strokeDasharray={labelled.has(tick.year) ? undefined : "2 4"}
                />
              ))}
              {layout.lanes.map((lane) => (
                <line
                  key={lane.id}
                  x1={offset}
                  x2={layout.width - LAYOUT.right / 2}
                  y1={lane.y}
                  y2={lane.y}
                  className="stroke-border"
                />
              ))}
              {layout.nodes.map((place) =>
                place.spanTo === undefined ? null : (
                  <line
                    key={place.id}
                    data-span={place.id}
                    x1={place.x}
                    x2={place.spanTo}
                    y1={place.y}
                    y2={place.y}
                    strokeWidth={4}
                    strokeLinecap="round"
                    className="lane-ink"
                    style={
                      {
                        "--lane": laneById.get(place.lane)?.color,
                        stroke: "var(--ink)",
                        strokeOpacity: 0.35,
                      } as CSSProperties
                    }
                  />
                ),
              )}
              {layout.edges.map((route) => {
                const edge = edgesById.get(route.id);
                if (!edge) return null;
                const touches =
                  active !== null &&
                  (edge.source === active || edge.target === active);
                return (
                  <MapEdgePath
                    key={route.id}
                    edge={edge}
                    route={route}
                    state={active === null ? "plain" : touches ? "lit" : "dim"}
                  />
                );
              })}
            </g>
          </svg>

          {layout.years
            .filter((tick) => labelled.has(tick.year))
            .map((tick) => (
              <span
                key={tick.year}
                aria-hidden="true"
                className="absolute top-2 -translate-x-1/2 text-xs font-medium text-muted-foreground"
                style={{ left: tick.x - offset }}
              >
                {tick.year}
              </span>
            ))}

          <p id={instructionsId} className="sr-only">
            Arrow keys move between items: left and right along a line of work,
            up and down to the next line. Enter or Space shows an item&apos;s
            details.
          </p>
          <div
            role="group"
            aria-label="Research map"
            aria-describedby={instructionsId}
          >
            {layout.nodes.map((place) => {
              const node = items.get(place.id);
              const lane = laneById.get(place.lane);
              if (!node || !lane) return null;
              return (
                <MapNodeButton
                  key={place.id}
                  ref={(element) => {
                    if (element) buttons.current.set(place.id, element);
                    else buttons.current.delete(place.id);
                  }}
                  node={node}
                  place={place}
                  laneLabel={lane.label}
                  color={lane.color}
                  offset={offset}
                  focusable={map.focusId === place.id}
                  selected={map.selectedId === place.id}
                  lit={map.lit.has(place.id)}
                  onSelect={(id) => {
                    map.setFocusId(id);
                    map.select(map.selectedId === id ? null : id);
                  }}
                  onKeyDown={onKeyDown}
                  onPoint={map.setPointed}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
