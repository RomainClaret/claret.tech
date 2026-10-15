"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DERIVED_KINDS,
  RELATION_KINDS,
  filterGraph,
  type ReasonKind,
  type ResearchGraph,
} from "@/lib/utils/graph-algorithms";

export type MapView = "map" | "list";

export interface ResearchMapState {
  /** The graph without the hidden lanes and link kinds. */
  shown: ResearchGraph;
  /** The link kinds the whole graph has, curated first. */
  kinds: ReasonKind[];
  hiddenLanes: ReadonlySet<string>;
  hiddenKinds: ReadonlySet<ReasonKind>;
  toggleLane: (id: string) => void;
  toggleKind: (kind: ReasonKind) => void;
  view: MapView;
  setView: (view: MapView) => void;
  /** The shown item whose details are open. */
  selectedId: string | null;
  select: (id: string | null) => void;
  /**
   * The shown item that holds the map's one Tab stop: the one last
   * focused, else the newest, where the map opens.
   */
  focusId: string | null;
  setFocusId: (id: string) => void;
  /** The item under the pointer or the keyboard focus. */
  setPointed: (id: string | null) => void;
  /** The pointed item, else the selected one: its links light up. */
  activeId: string | null;
  /** The active item and the items it links to. */
  lit: ReadonlySet<string>;
  isFiltered: boolean;
  /** Shows everything again and closes the details. */
  reset: () => void;
  /** What the map shows, for a polite live region. */
  summary: string;
}

const KIND_ORDER: readonly ReasonKind[] = [...RELATION_KINDS, ...DERIVED_KINDS];

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

const toggled = <T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> => {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
};

/**
 * The research map's state: what is shown, opened, focused and lit. It
 * listens to no keys itself; the dialog and the map's nodes do, so a
 * shortcut here can never take Ctrl+F or Ctrl+V from the browser, as the
 * network view this replaces did.
 */
export function useResearchMap(
  graph: ResearchGraph,
  initialView: MapView = "map",
): ResearchMapState {
  const [hiddenLanes, setHiddenLanes] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<ReasonKind>>(
    () => new Set(),
  );
  const [view, setView] = useState<MapView>(initialView);
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [pointed, setPointed] = useState<string | null>(null);

  const kinds = useMemo(() => {
    const present = new Set(
      graph.edges.flatMap((edge) => edge.reasons.map((reason) => reason.kind)),
    );
    return KIND_ORDER.filter((kind) => present.has(kind));
  }, [graph]);

  const isFiltered = hiddenLanes.size > 0 || hiddenKinds.size > 0;
  const shown = useMemo(
    () =>
      isFiltered
        ? filterGraph(graph, {
            lanes: graph.lanes
              .map((lane) => lane.id)
              .filter((id) => !hiddenLanes.has(id)),
            kinds: kinds.filter((kind) => !hiddenKinds.has(kind)),
          })
        : graph,
    [graph, kinds, hiddenLanes, hiddenKinds, isFiltered],
  );

  // Kept only while shown: a filter that hides an item closes its details
  // and moves the Tab stop, rather than leaving either on nothing.
  const has = (id: string | null) =>
    id !== null && shown.nodes.some((node) => node.id === id);
  const selectedId = has(selected) ? selected : null;
  const focusId = has(focused)
    ? focused
    : (shown.nodes[shown.nodes.length - 1]?.id ?? null);
  const active = has(pointed) ? pointed : selectedId;

  const lit = useMemo(() => {
    if (!active) return new Set<string>();
    const ids = new Set([active]);
    for (const edge of shown.edges) {
      if (edge.source === active) ids.add(edge.target);
      if (edge.target === active) ids.add(edge.source);
    }
    return ids;
  }, [shown, active]);

  const toggleLane = useCallback(
    (id: string) => setHiddenLanes((lanes) => toggled(lanes, id)),
    [],
  );
  const toggleKind = useCallback(
    (kind: ReasonKind) => setHiddenKinds((hidden) => toggled(hidden, kind)),
    [],
  );
  const reset = useCallback(() => {
    setHiddenLanes(new Set());
    setHiddenKinds(new Set());
    setSelected(null);
  }, []);

  const items = count(graph.nodes.length, "item", "items");
  const links = count(graph.edges.length, "link", "links");
  const summary = isFiltered
    ? `Showing ${shown.nodes.length} of ${items} and ${shown.edges.length} of ${links}.`
    : `${items} and ${links}.`;

  return {
    shown,
    kinds,
    hiddenLanes,
    hiddenKinds,
    toggleLane,
    toggleKind,
    view,
    setView,
    selectedId,
    select: setSelected,
    focusId,
    setFocusId: setFocused,
    setPointed,
    activeId: active,
    lit,
    isFiltered,
    reset,
    summary,
  };
}
