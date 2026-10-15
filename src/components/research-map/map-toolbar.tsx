"use client";

import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { MapLane, ReasonKind } from "@/lib/utils/graph-algorithms";
import type { MapView } from "@/lib/hooks/useResearchMap";
import { LINK_STYLES } from "./map-styles";

interface MapToolbarProps {
  view: MapView;
  onView: (view: MapView) => void;
  /** The lanes that have items. */
  lanes: MapLane[];
  hiddenLanes: ReadonlySet<string>;
  onToggleLane: (id: string) => void;
  /** The kinds of link the map has. */
  kinds: ReasonKind[];
  hiddenKinds: ReadonlySet<ReasonKind>;
  onToggleKind: (kind: ReasonKind) => void;
  isFiltered: boolean;
  onReset: () => void;
  /** What the map shows, said politely after each change. */
  summary: string;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const chip = cn(
  "inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
  focusRing,
);

/**
 * The research map's controls: Map or List, which lines of work and which
 * kinds of link to show, and Show all. Toggles say their state with
 * aria-pressed and, on screen, with a filled or hollow mark, not colour
 * alone. No shortcuts: every control is a button in the Tab order.
 */
export function MapToolbar({
  view,
  onView,
  lanes,
  hiddenLanes,
  onToggleLane,
  kinds,
  hiddenKinds,
  onToggleKind,
  isFiltered,
  onReset,
  summary,
}: MapToolbarProps) {
  const lanesId = useId();
  const linksId = useId();
  return (
    <div className="space-y-2 border-b border-border px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          role="group"
          aria-label="View"
          className="inline-flex rounded-lg border border-border p-0.5"
        >
          {(["map", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => onView(mode)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                focusRing,
                view === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {mode === "map" ? "Map" : "List"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={!isFiltered}
          className={cn(
            "rounded-lg border border-border px-3 py-1 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
            focusRing,
          )}
        >
          Show all
        </button>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {summary}
        </p>
      </div>

      <div
        role="group"
        aria-labelledby={lanesId}
        className="flex flex-wrap items-center gap-2"
      >
        <span
          id={lanesId}
          className="text-xs font-semibold text-muted-foreground"
        >
          Lines of work
        </span>
        {lanes.map((lane) => {
          const shown = !hiddenLanes.has(lane.id);
          return (
            <button
              key={lane.id}
              type="button"
              aria-pressed={shown}
              onClick={() => onToggleLane(lane.id)}
              className={cn(
                chip,
                "lane-ink",
                shown
                  ? "border-[color:var(--ink)] text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              style={{ "--lane": lane.color } as CSSProperties}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2.5 w-2.5 rounded-full border-2 border-[color:var(--ink)]",
                  shown && "bg-[var(--ink)]",
                )}
              />
              {lane.label}
            </button>
          );
        })}
      </div>

      {kinds.length > 0 && (
        <div
          role="group"
          aria-labelledby={linksId}
          className="flex flex-wrap items-center gap-2"
        >
          <span
            id={linksId}
            className="text-xs font-semibold text-muted-foreground"
          >
            Links
          </span>
          {kinds.map((kind) => {
            const shown = !hiddenKinds.has(kind);
            const style = LINK_STYLES[kind];
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={shown}
                onClick={() => onToggleKind(kind)}
                className={cn(
                  chip,
                  shown
                    ? "border-foreground/60 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <svg
                  aria-hidden="true"
                  width="24"
                  height="8"
                  className={cn(!shown && "opacity-50")}
                >
                  <line
                    x1="2"
                    y1="4"
                    x2="22"
                    y2="4"
                    stroke="currentColor"
                    strokeWidth={style.width}
                    strokeDasharray={style.dash}
                    strokeLinecap="round"
                  />
                </svg>
                {style.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
