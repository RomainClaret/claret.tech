import { describe, it, expect } from "vitest";
import {
  LAYOUT,
  layoutResearchGraph,
  navTarget,
  type MapLayout,
} from "./research-map-layout";
import {
  buildResearchGraph,
  filterGraph,
  parseMapConfig,
  type MapConfig,
  type ResearchGraph,
} from "./graph-algorithms";
import { STATIC_PUBLICATIONS } from "@/lib/api/fetch-publications";
import { papersSection } from "@/data/sections/papers";
import { researchSection } from "@/data/sections/research";
import mapData from "@/data/research-map.json";

/**
 * Where the research map puts things: lanes down, time across, nothing on
 * top of anything else, and the same picture every time.
 */

const siteGraph = buildResearchGraph({
  publications: STATIC_PUBLICATIONS,
  papers: papersSection.papersCards,
  projects: researchSection.projects,
  config: parseMapConfig(mapData),
  now: 2026,
});
const site = layoutResearchGraph(siteGraph);
const at = (layout: MapLayout, id: string) => {
  const node = layout.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`${id} is not on the map`);
  return node;
};

// A small graph: lane "one" has a, b, c in 2021, 2022, 2024; lane "two"
// has d in 2022 and e in 2024. c points to e (curated); a and b share code.
const config: MapConfig = {
  owner: "Ada Owner",
  lanes: [
    {
      id: "one",
      label: "One",
      color: "#3b82f6",
      repos: ["https://github.com/ada/tool"],
      members: ["c"],
      fallback: false,
    },
    {
      id: "two",
      label: "Two",
      color: "#64748b",
      repos: [],
      members: [],
      fallback: true,
    },
  ],
  labels: {},
  relations: [{ from: "c", to: "e", kind: "extends", note: "Goes on." }],
};
const pub = (id: string, year: string, codeUrl?: string) => ({
  id,
  title: `Title of ${id}`,
  authors: ["Ada Owner"],
  year,
  codeUrl,
  source: "static" as const,
});
const small = buildResearchGraph({
  publications: [
    pub("a", "2021", "https://github.com/ada/tool"),
    pub("b", "2022", "https://github.com/ada/tool"),
    pub("c", "2024"),
    pub("d", "2022"),
    pub("e", "2024"),
  ],
  papers: [],
  projects: [],
  config,
  now: 2026,
});
const smallLayout = layoutResearchGraph(small);

describe("layoutResearchGraph", () => {
  it("draws the same map from the same graph, in any order", () => {
    const shuffled: ResearchGraph = {
      lanes: siteGraph.lanes,
      nodes: [...siteGraph.nodes].reverse(),
      edges: [...siteGraph.edges].reverse(),
    };

    expect(layoutResearchGraph(shuffled)).toEqual(site);
  });

  it("never puts two items of a lane closer than a slot", () => {
    const gaps = site.lanes.flatMap((lane) => {
      const xs = site.nodes
        .filter((node) => node.lane === lane.id)
        .map((node) => node.x)
        .sort((a, b) => a - b);
      return xs.slice(1).map((x, i) => x - xs[i]);
    });

    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(LAYOUT.slot);
  });

  it("runs time left to right: years, then months within a year", () => {
    const placed = siteGraph.nodes.map((node) => ({
      ...node,
      x: at(site, node.id).x,
    }));
    const backwards = placed.flatMap((a) =>
      placed
        .filter(
          (b) =>
            a.year < b.year ||
            (a.year === b.year && a.month && b.month && a.month < b.month),
        )
        .filter((b) => a.x >= b.x)
        .map((b) => `${a.id} is not left of ${b.id}`),
    );

    expect(backwards).toEqual([]);
  });

  it("lines a month up across lanes, and keeps empty years narrow", () => {
    // EMR-HyperNEAT and Emerging Behaviors both start in July 2026.
    expect(at(site, "claret2026emr").x).toBe(at(site, "emerging-behaviors").x);
    expect(at(site, "claret2026emr").lane).not.toBe(
      at(site, "emerging-behaviors").lane,
    );

    const tick = (year: number) =>
      site.years.find((entry) => entry.year === year)?.x ?? NaN;
    for (let year = 2011; year < 2015; year++) {
      expect(tick(year + 1) - tick(year)).toBe(LAYOUT.emptyYear);
    }
  });

  it("puts the PhD thesis after the 2026 papers it gathers", () => {
    const papers2026 = siteGraph.nodes.filter(
      (node) => node.year === 2026 && node.kind !== "project",
    );
    const thesis = at(site, "phd-thesis");

    expect(
      papers2026.filter((node) => at(site, node.id).x >= thesis.x),
    ).toEqual([]);
  });

  it("keeps every item in place when a kind of link is hidden", () => {
    // Placed by its card's links to that year's papers, the PhD thesis
    // would jump to the start of 2026 whenever those links are hidden.
    const withoutCardLinks = filterGraph(siteGraph, {
      kinds: ["same-repository", "co-authors", "same-venue"],
    });

    expect(layoutResearchGraph(withoutCardLinks).nodes).toEqual(site.nodes);
  });

  it("draws work still running on to the end of the time axis", () => {
    const geenns = at(site, "geenns");

    expect(geenns.spanTo).toBe(site.width - LAYOUT.right);
    expect(at(site, "phd-thesis").spanTo).toBeUndefined();
  });

  it("lifts a label above its dot when the one before it is too close", () => {
    // In August 2026, Activations and Neuromodulation sit one slot apart
    // in the same lane: two labels below would run into each other.
    const lane = site.nodes
      .filter((node) => node.lane === "emr")
      .sort((a, b) => a.x - b.x);
    const clashes = lane
      .slice(1)
      .filter(
        (node, i) =>
          node.x - lane[i].x < LAYOUT.labelWidth &&
          node.labelSide === lane[i].labelSide,
      )
      .map((node) => node.id);

    expect(lane.map((node) => node.labelSide)).toContain("above");
    expect(clashes).toEqual([]);
  });

  it("places an item dated after today in its own year, last", () => {
    // A time axis that stops at the current year leaves a paper to appear
    // next year without a column, at the far left.
    const ahead = layoutResearchGraph(
      buildResearchGraph({
        publications: [pub("a", "2021"), pub("next", "2099")],
        papers: [],
        projects: [],
        config,
        now: 2026,
      }),
    );

    expect(at(ahead, "next").x).toBeGreaterThan(at(ahead, "a").x);
    expect(ahead.years.at(-1)?.year).toBe(2099);
  });

  it("runs an edge from dot to dot, with an arrowhead on one that points", () => {
    const pointing = smallLayout.edges.find((edge) => edge.id === "c--e");
    const plain = smallLayout.edges.find((edge) => edge.id === "a--b");
    const start = (path: string) => {
      const [, x, y] = /^M ([\d.-]+) ([\d.-]+)/.exec(path) ?? [];
      return { x: Number(x), y: Number(y) };
    };
    const c = at(smallLayout, "c");
    const a = at(smallLayout, "a");

    expect(pointing?.source).toBe("c");
    expect(pointing?.arrow).toBeDefined();
    expect(plain?.arrow).toBeUndefined();
    // Starts at the dot's rim (radius plus a gap), not its center.
    const from = start(pointing!.path);
    expect(Math.hypot(from.x - c.x, from.y - c.y)).toBeCloseTo(c.r + 2, 0);
    const fromA = start(plain!.path);
    expect(Math.hypot(fromA.x - a.x, fromA.y - a.y)).toBeCloseTo(a.r + 2, 0);
  });

  it("leaves out lanes without items, and has nothing to draw without any", () => {
    expect(smallLayout.lanes.map((lane) => lane.id)).toEqual(["one", "two"]);
    expect(
      layoutResearchGraph({ lanes: small.lanes, nodes: [], edges: [] }),
    ).toEqual({
      width: LAYOUT.gutter,
      height: LAYOUT.top,
      lanes: [],
      nodes: [],
      edges: [],
      years: [],
    });
  });
});

describe("navTarget", () => {
  const go = (from: string, key: Parameters<typeof navTarget>[3]) =>
    navTarget(smallLayout, small.edges, from, key);

  it("moves along a lane, and stops at its ends", () => {
    expect(go("a", "ArrowRight")).toBe("b");
    expect(go("b", "ArrowLeft")).toBe("a");
    expect(go("a", "ArrowLeft")).toBeNull();
    expect(go("c", "ArrowRight")).toBeNull();
    expect(go("b", "Home")).toBe("a");
    expect(go("a", "End")).toBe("c");
  });

  it("moves to the next lane along a link, else to the nearest in time", () => {
    // c links to e; b links to nothing in lane two, and d is nearest.
    expect(go("c", "ArrowDown")).toBe("e");
    expect(go("b", "ArrowDown")).toBe("d");
    expect(go("e", "ArrowUp")).toBe("c");
    expect(go("a", "ArrowUp")).toBeNull();
    expect(go("d", "ArrowDown")).toBeNull();
  });

  it("starts from the first item when the one it is given is gone", () => {
    expect(go("gone", "ArrowRight")).toBe(smallLayout.nodes[0].id);
  });
});
