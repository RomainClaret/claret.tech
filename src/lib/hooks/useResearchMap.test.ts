import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useResearchMap } from "./useResearchMap";
import {
  buildResearchGraph,
  type MapConfig,
} from "@/lib/utils/graph-algorithms";
import type { Publication } from "@/lib/api/fetch-publications";

/**
 * The research map's state, on a small graph built the real way: two
 * lanes, four items, two kinds of link.
 *
 *   lane "code": a (2021) --same repository-- b (2022)
 *   lane "rest": c (2023) --co-author-------- d (2024)
 *   and b --co-author-- c, through Bea Co (on b and c only)
 */

const config: MapConfig = {
  owner: "Ada Owner",
  lanes: [
    {
      id: "code",
      label: "Code lane",
      color: "#3b82f6",
      repos: ["https://github.com/ada/tool"],
      members: [],
      fallback: false,
    },
    {
      id: "rest",
      label: "Everything else",
      color: "#64748b",
      repos: [],
      members: [],
      fallback: true,
    },
  ],
  labels: {},
  relations: [],
};

const pub = (id: string, year: string, over: Partial<Publication> = {}) => ({
  id,
  title: `Title of ${id}`,
  authors: ["Ada Owner"],
  year,
  source: "static" as const,
  ...over,
});
const code = "https://github.com/ada/tool";
const graph = buildResearchGraph({
  publications: [
    pub("a", "2021", { codeUrl: code }),
    pub("b", "2022", { codeUrl: code, authors: ["Ada Owner", "Bea Co"] }),
    pub("c", "2023", { authors: ["Ada Owner", "Bea Co", "Cy Co"] }),
    pub("d", "2024", { authors: ["Ada Owner", "Cy Co"] }),
  ],
  papers: [],
  projects: [],
  config,
  now: 2026,
});

const ids = (nodes: { id: string }[]) => nodes.map((node) => node.id);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useResearchMap", () => {
  it("shows everything at first, and says how much", () => {
    const { result } = renderHook(() => useResearchMap(graph));

    expect(ids(result.current.shown.nodes)).toEqual(["a", "b", "c", "d"]);
    expect(result.current.shown.edges).toHaveLength(3);
    expect(result.current.isFiltered).toBe(false);
    expect(result.current.summary).toBe("4 items and 3 links.");
    expect(result.current.view).toBe("map");
  });

  it("offers only the link kinds the graph has", () => {
    const { result } = renderHook(() => useResearchMap(graph));

    expect(result.current.kinds).toEqual(["same-repository", "co-authors"]);
  });

  it("hides a lane with its items and their links, and brings them back", () => {
    const { result } = renderHook(() => useResearchMap(graph));

    act(() => result.current.toggleLane("code"));
    expect(ids(result.current.shown.nodes)).toEqual(["c", "d"]);
    expect(result.current.shown.edges.map((edge) => edge.id)).toEqual(["c--d"]);
    expect(result.current.summary).toBe(
      "Showing 2 of 4 items and 1 of 3 links.",
    );

    act(() => result.current.toggleLane("code"));
    expect(ids(result.current.shown.nodes)).toEqual(["a", "b", "c", "d"]);
    expect(result.current.isFiltered).toBe(false);
  });

  it("hides a kind of link and keeps every item", () => {
    const { result } = renderHook(() => useResearchMap(graph));

    act(() => result.current.toggleKind("co-authors"));

    expect(ids(result.current.shown.nodes)).toEqual(["a", "b", "c", "d"]);
    expect(result.current.shown.edges.map((edge) => edge.id)).toEqual(["a--b"]);
  });

  it("lights the pointed item and the items it links to, else the selected one's", () => {
    const { result } = renderHook(() => useResearchMap(graph));
    expect(result.current.lit.size).toBe(0);

    act(() => result.current.select("a"));
    expect([...result.current.lit].sort()).toEqual(["a", "b"]);

    act(() => result.current.setPointed("c"));
    expect([...result.current.lit].sort()).toEqual(["b", "c", "d"]);
    expect(result.current.activeId).toBe("c");

    act(() => result.current.setPointed(null));
    expect([...result.current.lit].sort()).toEqual(["a", "b"]);
  });

  it("closes the details of an item a filter hides", () => {
    const { result } = renderHook(() => useResearchMap(graph));
    act(() => result.current.select("a"));

    act(() => result.current.toggleLane("code"));
    expect(result.current.selectedId).toBeNull();
  });

  it("keeps the Tab stop on a shown item: the newest, until one is focused", () => {
    const { result } = renderHook(() => useResearchMap(graph));
    expect(result.current.focusId).toBe("d");

    act(() => result.current.setFocusId("b"));
    expect(result.current.focusId).toBe("b");

    act(() => result.current.toggleLane("code"));
    expect(result.current.focusId).toBe("d");
  });

  it("resets the filters and closes the details, keeping the view", () => {
    const { result } = renderHook(() => useResearchMap(graph, "list"));
    act(() => {
      result.current.toggleLane("rest");
      result.current.toggleKind("same-repository");
      result.current.select("a");
    });

    act(() => result.current.reset());

    expect(result.current.isFiltered).toBe(false);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.view).toBe("list");
  });

  it("listens to no keys of its own", () => {
    // The network view it replaces took Ctrl+F and Ctrl+V on window, the
    // browser's find and paste, while it was on the page.
    const listen = vi.spyOn(window, "addEventListener");
    const listenOnDocument = vi.spyOn(document, "addEventListener");

    renderHook(() => useResearchMap(graph));

    const keys = [...listen.mock.calls, ...listenOnDocument.mock.calls].filter(
      ([type]) => String(type).startsWith("key"),
    );
    expect(keys).toEqual([]);
  });
});
