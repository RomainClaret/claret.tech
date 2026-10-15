import {
  RELATION_KINDS,
  type MapEdge,
  type MapNode,
  type ReasonKind,
} from "@/lib/utils/graph-algorithms";

/**
 * How the research map names and draws things. A link's kind shows in its
 * line (weight, dashes, an arrowhead), never in colour alone: the lines are
 * all one neutral colour, and the lane colours mark the items.
 */

export interface LinkStyle {
  /** The toggle's and the legend's name. */
  label: string;
  /** The heading over these links in an item's details. */
  heading: string;
  width: number;
  dash?: string;
}

export const LINK_STYLES: Record<ReasonKind, LinkStyle> = {
  extends: { label: "Extends", heading: "Builds on or leads to", width: 2.25 },
  companion: { label: "Companion", heading: "Companion work", width: 2.25 },
  precursor: { label: "Precursor", heading: "Came before", width: 2.25 },
  "part-of": { label: "Part of", heading: "Part of, or holds", width: 2.25 },
  "same-repository": {
    label: "Same code",
    heading: "Same code repository",
    width: 1.5,
  },
  "project-link": {
    label: "Card links",
    heading: "Linked from a research card",
    width: 1.5,
    dash: "8 3 2 3",
  },
  "co-authors": {
    label: "Co-authors",
    heading: "Shared co-authors",
    width: 1.5,
    dash: "6 4",
  },
  "same-venue": {
    label: "Same venue",
    heading: "Same venue",
    width: 1.5,
    dash: "1 4",
  },
};

/** Which reason draws an edge that has several: curated, then the closest. */
export const LINK_ORDER: readonly ReasonKind[] = [
  ...RELATION_KINDS,
  "same-repository",
  "project-link",
  "co-authors",
  "same-venue",
];

export function edgeKind(edge: Pick<MapEdge, "reasons">): ReasonKind {
  return (
    LINK_ORDER.find((kind) =>
      edge.reasons.some((reason) => reason.kind === kind),
    ) ?? edge.reasons[0].kind
  );
}

/**
 * A connection's heading in one item's details, read from that item. The
 * data file's relations point forward: "extends" from the earlier work to
 * the one that builds on it, "precursor" from what came first to what it
 * led to, "part-of" from the part to the whole.
 */
export function connectionHeading(kind: ReasonKind, outgoing: boolean): string {
  if (kind === "extends") return outgoing ? "Built on by" : "Builds on";
  if (kind === "precursor") return outgoing ? "Led to" : "Grew out of";
  if (kind === "part-of") return outgoing ? "Part of" : "Includes";
  return LINK_STYLES[kind].heading;
}

/** "Paper", "Poster", "Preprint", or a project's own kind ("PhD Thesis"). */
export function kindName(node: MapNode): string {
  if (node.kind === "publication") return "Paper";
  if (node.kind === "project") return node.subtitle || "Research project";
  if (node.documents.some((document) => /poster/i.test(document.name))) {
    return "Poster";
  }
  return node.status === "preprint" ? "Preprint" : "Other work";
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "August 2026", "2016", or "Since 2020" for work still running. */
export function dateText(node: MapNode): string {
  const start = node.month
    ? `${MONTHS[node.month - 1]} ${node.year}`
    : String(node.year);
  if (node.ongoing) return `Since ${start}`;
  if (node.until && node.until > node.year) return `${start} to ${node.until}`;
  return start;
}

/** "Michael O'Neill, Paul Cotofrei and Kilian Stoffel". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const STATUS_NAMES: Record<NonNullable<MapNode["status"]>, string> = {
  "to-appear": "To appear",
  presented: "Presented",
  preprint: "Preprint",
};

export function statusName(node: MapNode): string | undefined {
  return node.status ? STATUS_NAMES[node.status] : undefined;
}
