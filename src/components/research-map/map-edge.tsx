import { cn } from "@/lib/utils";
import type { MapEdge as GraphEdge } from "@/lib/utils/graph-algorithms";
import type { LaidOutEdge } from "@/lib/utils/research-map-layout";
import { LINK_STYLES, edgeKind } from "./map-styles";

/**
 * One link on the research map, inside its aria-hidden drawing: the items'
 * buttons and their details say what the lines show. Drawn in one neutral
 * colour; its kind is in its weight, its dashes and, when it points, an
 * arrowhead at the item it points to.
 */
export function MapEdgePath({
  edge,
  route,
  state,
}: {
  edge: GraphEdge;
  route: LaidOutEdge;
  /** Lit: it touches the active item. Dim: another item is active. */
  state: "lit" | "dim" | "plain";
}) {
  const kind = edgeKind(edge);
  const style = LINK_STYLES[kind];
  return (
    <g
      data-edge={edge.id}
      data-kind={kind}
      className={cn(
        "motion-safe:transition-opacity",
        state === "lit" ? "text-foreground" : "text-muted-foreground",
        state === "dim" && "opacity-20",
      )}
    >
      <path
        d={route.path}
        fill="none"
        stroke="currentColor"
        strokeWidth={state === "lit" ? style.width + 0.75 : style.width}
        strokeDasharray={style.dash}
        strokeLinecap="round"
      />
      {route.arrow && (
        <path
          d="M 5 0 L -2 -4 L -2 4 Z"
          fill="currentColor"
          transform={`translate(${route.arrow.x} ${route.arrow.y}) rotate(${route.arrow.angle})`}
        />
      )}
    </g>
  );
}
