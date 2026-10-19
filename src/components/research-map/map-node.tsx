"use client";

import { forwardRef, type CSSProperties, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { MapNode as MapItem } from "@/lib/utils/graph-algorithms";
import type { LaidOutNode } from "@/lib/utils/research-map-layout";
import { dateText, kindName } from "./map-styles";

interface MapNodeProps {
  node: MapItem;
  place: LaidOutNode;
  laneLabel: string;
  color: string;
  /** Subtracted from x: the lane titles' column, drawn outside the map. */
  offset: number;
  /** Holds the map's one Tab stop. */
  focusable: boolean;
  selected: boolean;
  /** The active item, or one it links to. */
  lit: boolean;
  onSelect: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, id: string) => void;
  onPoint: (id: string | null) => void;
}

/**
 * One item on the research map: a real button laid over the drawing, so it
 * takes focus, clicks and a name like any control. Its shape gives the kind
 * (a dot for a paper, a ring for other work, a disc with a hole for a
 * research card) and its colour the line of work. The label is part of the
 * button: clicking the words works too. Its name starts with the label, so
 * "click Activations" works with voice control.
 */
export const MapNodeButton = forwardRef<HTMLButtonElement, MapNodeProps>(
  function MapNodeButton(
    {
      node,
      place,
      laneLabel,
      color,
      offset,
      focusable,
      selected,
      lit,
      onSelect,
      onKeyDown,
      onPoint,
    },
    ref,
  ) {
    const half = place.hit / 2;
    const gap = half + place.r + 3;
    return (
      <button
        ref={ref}
        type="button"
        data-node={node.id}
        tabIndex={focusable ? 0 : -1}
        aria-pressed={selected}
        aria-label={`${node.label}, ${kindName(node)}, ${dateText(node)}, ${laneLabel}`}
        onClick={() => onSelect(node.id)}
        onKeyDown={(event) => onKeyDown(event, node.id)}
        onPointerEnter={() => onPoint(node.id)}
        onPointerLeave={() => onPoint(null)}
        onFocus={() => onPoint(node.id)}
        onBlur={() => onPoint(null)}
        className="lane-ink absolute flex items-center justify-center rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        style={
          {
            left: place.x - offset - half,
            top: place.y - half,
            width: place.hit,
            height: place.hit,
            "--lane": color,
          } as CSSProperties
        }
      >
        <Shape kind={node.kind} selected={selected} lit={lit} />
        <span
          aria-hidden="true"
          // On the page's background, hugging the words: lines pass
          // behind a label, not through it.
          className="absolute left-1/2 line-clamp-2 w-max max-w-[104px] -translate-x-1/2 rounded-xs bg-background/90 px-1 text-center text-[11px] font-medium leading-tight text-foreground"
          style={place.labelSide === "below" ? { top: gap } : { bottom: gap }}
        >
          {node.label}
        </span>
      </button>
    );
  },
);

function Shape({
  kind,
  selected,
  lit,
}: {
  kind: MapItem["kind"];
  selected: boolean;
  lit: boolean;
}) {
  const state = cn(
    "motion-safe:transition-transform",
    selected &&
      "scale-110 ring-2 ring-(--ink) ring-offset-2 ring-offset-background",
    lit && !selected && "scale-125",
  );
  if (kind === "project") {
    return (
      <span
        aria-hidden="true"
        data-shape="disc"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full bg-(--ink)",
          state,
        )}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-background" />
      </span>
    );
  }
  if (kind === "other-work") {
    return (
      <span
        aria-hidden="true"
        data-shape="ring"
        className={cn(
          "h-3.5 w-3.5 rounded-full border-[3px] border-(--ink) bg-background",
          state,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-shape="dot"
      className={cn("h-3.5 w-3.5 rounded-full bg-(--ink)", state)}
    />
  );
}

/** The kind's shape at text size, for the list and the legend. */
export function KindMark({
  kind,
  color,
}: {
  kind: MapItem["kind"];
  color?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-mark={kind}
      className={cn(
        "lane-ink inline-block shrink-0 rounded-full",
        kind === "project" &&
          "h-3.5 w-3.5 border-4 border-(--ink) bg-background",
        kind === "other-work" &&
          "h-2.5 w-2.5 border-2 border-(--ink) bg-background",
        kind === "publication" && "h-2.5 w-2.5 bg-(--ink)",
      )}
      style={
        { "--lane": color ?? "hsl(var(--muted-foreground))" } as CSSProperties
      }
    />
  );
}
