import {
  byTime,
  type MapEdge,
  type MapNode,
  type ResearchGraph,
} from "./graph-algorithms";

/**
 * Where everything on the research map goes: one lane per line of work,
 * time running left to right. Deterministic: the same graph, in any order,
 * gives the same picture, and nothing here is random.
 */

export const LAYOUT = {
  /** Height of one lane. */
  laneHeight: 88,
  /** Room for the lane titles, left of the first year. */
  gutter: 152,
  /** Width given to one node in a month column. */
  slot: 56,
  /** Narrowest year that holds items. */
  minYear: 64,
  /** A year without items. */
  emptyYear: 16,
  /** Space above the first lane, for the year ticks. */
  top: 36,
  /** Space after the last year. */
  right: 48,
  radius: { item: 7, project: 14 },
  /** Hit areas: larger than the dots, as fingers are. */
  hit: { item: 32, project: 40 },
  /** Labels are cut to this width. */
  labelWidth: 104,
} as const;

export interface LaidOutLane {
  id: string;
  label: string;
  color: string;
  y: number;
}

export interface LaidOutNode {
  id: string;
  lane: string;
  x: number;
  y: number;
  r: number;
  hit: number;
  labelSide: "below" | "above";
  /** End of an ongoing project's span, when it runs past its dot. */
  spanTo?: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LaidOutEdge {
  id: string;
  source: string;
  target: string;
  path: string;
  /** Where the arrowhead sits, and its direction in degrees. */
  arrow?: Point & { angle: number };
}

export interface MapLayout {
  width: number;
  height: number;
  lanes: LaidOutLane[];
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  years: { year: number; x: number }[];
}

/** The tangent (derivative) at t on a cubic Bezier. */
export function cubicTangent(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const u = 1 - t;
  return {
    x:
      3 * u * u * (p1.x - p0.x) +
      6 * u * t * (p2.x - p1.x) +
      3 * t * t * (p3.x - p2.x),
    y:
      3 * u * u * (p1.y - p0.y) +
      6 * u * t * (p2.y - p1.y) +
      3 * t * t * (p3.y - p2.y),
  };
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * A month for ordering within a year, for an item that gives none: the
 * year's start, except a project given as a single year, such as a thesis,
 * which goes at its end, after the year's papers it gathers. Read from the
 * item alone, so hiding a kind of link never moves anything.
 */
function monthKey(node: MapNode): number {
  if (node.month) return node.month;
  return node.kind === "project" && node.until === undefined ? 13 : 0;
}

/**
 * The map's geometry. Years run left to right, narrow when empty; within a
 * year, month columns line up across lanes, as wide as their most crowded
 * lane, so two items of a lane never share a place.
 */
export function layoutResearchGraph(graph: ResearchGraph): MapLayout {
  const lanes = graph.lanes.filter((lane) =>
    graph.nodes.some((node) => node.lane === lane.id),
  );
  const laneIndex = new Map(lanes.map((lane, i) => [lane.id, i]));
  const laneY = (id: string) =>
    LAYOUT.top +
    (laneIndex.get(id) ?? 0) * LAYOUT.laneHeight +
    LAYOUT.laneHeight / 2;

  const nodes = [...graph.nodes].sort(byTime);
  if (nodes.length === 0) {
    return {
      width: LAYOUT.gutter,
      height: LAYOUT.top,
      lanes: [],
      nodes: [],
      edges: [],
      years: [],
    };
  }
  const keyed = nodes.map((node) => ({ node, month: monthKey(node) }));
  const firstYear = Math.min(...nodes.map((node) => node.year));
  const lastYear = Math.max(
    ...nodes.map((node) => Math.max(node.year, node.until ?? node.year)),
    firstYear,
  );

  // Per year, the month columns in use and how many nodes each lane puts in
  // each: a column is as wide as its most crowded lane.
  const columns = new Map<number, Map<number, Map<string, number>>>();
  for (const { node, month } of keyed) {
    const months =
      columns.get(node.year) ?? new Map<number, Map<string, number>>();
    const lanesInMonth = months.get(month) ?? new Map<string, number>();
    lanesInMonth.set(node.lane, (lanesInMonth.get(node.lane) ?? 0) + 1);
    months.set(month, lanesInMonth);
    columns.set(node.year, months);
  }

  const years: { year: number; x: number }[] = [];
  const columnX = new Map<string, number>();
  let x: number = LAYOUT.gutter;
  for (let year = firstYear; year <= lastYear; year++) {
    years.push({ year, x: round(x) });
    const months = columns.get(year);
    if (!months) {
      x += LAYOUT.emptyYear;
      continue;
    }
    const start = x;
    for (const month of [...months.keys()].sort((a, b) => a - b)) {
      columnX.set(`${year}:${month}`, x);
      const crowd = Math.max(...months.get(month)!.values());
      x += crowd * LAYOUT.slot;
    }
    x = Math.max(x, start + LAYOUT.minYear);
  }
  const yearEnd = x;
  /** Where a year ends: the next one's start, or the axis's end. */
  const endOf = (year: number) =>
    years.find((tick) => tick.year === year + 1)?.x ?? yearEnd;

  const placed: LaidOutNode[] = [];
  const used = new Map<string, number>();
  for (const { node, month } of keyed) {
    const key = `${node.year}:${month}`;
    const lanePos = `${key}:${node.lane}`;
    const index = used.get(lanePos) ?? 0;
    used.set(lanePos, index + 1);
    const project = node.kind === "project";
    const nodeX =
      (columnX.get(key) ?? LAYOUT.gutter) + (index + 0.5) * LAYOUT.slot;
    // Work still running, or that ran for years, draws on to its end.
    const spanTo =
      node.until && node.until > node.year ? endOf(node.until) : undefined;
    placed.push({
      id: node.id,
      lane: node.lane,
      x: round(nodeX),
      y: round(laneY(node.lane)),
      r: project ? LAYOUT.radius.project : LAYOUT.radius.item,
      hit: project ? LAYOUT.hit.project : LAYOUT.hit.item,
      labelSide: "below",
      spanTo:
        spanTo !== undefined && spanTo > nodeX ? round(spanTo) : undefined,
    });
  }

  // A label goes above when the previous node of its lane is close enough
  // for the two labels below to run into each other.
  const lastInLane = new Map<string, LaidOutNode>();
  for (const node of [...placed].sort((a, b) => a.x - b.x)) {
    const previous = lastInLane.get(node.lane);
    if (
      previous &&
      previous.labelSide === "below" &&
      node.x - previous.x < LAYOUT.labelWidth
    ) {
      node.labelSide = "above";
    }
    lastInLane.set(node.lane, node);
  }

  const at = new Map(placed.map((node) => [node.id, node]));
  const edges = graph.edges
    .map((edge) => routeEdge(edge, at))
    .filter((edge): edge is LaidOutEdge => edge !== null)
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    width: round(yearEnd + LAYOUT.right),
    height: LAYOUT.top + lanes.length * LAYOUT.laneHeight,
    lanes: lanes.map((lane) => ({
      id: lane.id,
      label: lane.label,
      color: lane.color,
      y: round(laneY(lane.id)),
    })),
    nodes: placed.sort(
      (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id),
    ),
    edges,
    years,
  };
}

function routeEdge(
  edge: MapEdge,
  at: Map<string, LaidOutNode>,
): LaidOutEdge | null {
  const a = at.get(edge.source);
  const b = at.get(edge.target);
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let c1: Point;
  let c2: Point;
  if (Math.abs(dy) < 1) {
    // Same lane: an arc, above for a curated link, below for a derived one.
    const curated = edge.reasons.some((reason) => reason.origin === "curated");
    const h = Math.min(36, 10 + 0.15 * Math.abs(dx)) * (curated ? -1 : 1);
    c1 = { x: a.x + dx * 0.25, y: a.y + h };
    c2 = { x: b.x - dx * 0.25, y: b.y + h };
  } else if (Math.abs(dx) < 24) {
    c1 = { x: a.x, y: a.y + dy * 0.5 };
    c2 = { x: b.x, y: b.y - dy * 0.5 };
  } else {
    c1 = { x: a.x + dx * 0.5, y: a.y };
    c2 = { x: b.x - dx * 0.5, y: b.y };
  }
  // Pulled back to the dots' edges.
  const start = pullBack({ x: a.x, y: a.y }, c1, a.r + 2);
  const end = pullBack({ x: b.x, y: b.y }, c2, b.r + (edge.directed ? 6 : 2));
  const path = `M ${round(start.x)} ${round(start.y)} C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(end.x)} ${round(end.y)}`;
  let arrow: LaidOutEdge["arrow"];
  if (edge.directed) {
    const tangent = cubicTangent(start, c1, c2, end, 1);
    arrow = {
      x: round(end.x),
      y: round(end.y),
      angle: round((Math.atan2(tangent.y, tangent.x) * 180) / Math.PI),
    };
  }
  return { id: edge.id, source: edge.source, target: edge.target, path, arrow };
}

/** A point moved from `from` toward `toward` by `distance`. */
function pullBack(from: Point, toward: Point, distance: number): Point {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: from.x + (dx / length) * distance,
    y: from.y + (dy / length) * distance,
  };
}

export type NavKey =
  "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

/**
 * Where an arrow key goes from a node: along its lane left and right (Home
 * and End to the lane's ends), and up or down to the next lane, to a node
 * it links to when there is one, else the nearest in time.
 */
export function navTarget(
  layout: MapLayout,
  edges: { source: string; target: string }[],
  from: string,
  key: NavKey,
): string | null {
  const current = layout.nodes.find((node) => node.id === from);
  if (!current) return layout.nodes[0]?.id ?? null;
  const lane = layout.nodes
    .filter((node) => node.lane === current.lane)
    .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const index = lane.findIndex((node) => node.id === from);
  if (key === "ArrowLeft") return lane[index - 1]?.id ?? null;
  if (key === "ArrowRight") return lane[index + 1]?.id ?? null;
  if (key === "Home") return lane[0]?.id ?? null;
  if (key === "End") return lane[lane.length - 1]?.id ?? null;
  const laneOrder = layout.lanes.map((l) => l.id);
  const step = key === "ArrowDown" ? 1 : -1;
  const next = laneOrder[laneOrder.indexOf(current.lane) + step];
  if (!next) return null;
  const candidates = layout.nodes.filter((node) => node.lane === next);
  const linked = new Set(
    edges
      .filter((edge) => edge.source === from || edge.target === from)
      .map((edge) => (edge.source === from ? edge.target : edge.source)),
  );
  const pool = candidates.some((node) => linked.has(node.id))
    ? candidates.filter((node) => linked.has(node.id))
    : candidates;
  const nearest = [...pool].sort(
    (a, b) =>
      Math.abs(a.x - current.x) - Math.abs(b.x - current.x) ||
      a.id.localeCompare(b.id),
  )[0];
  return nearest?.id ?? null;
}
