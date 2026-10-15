import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  LINK_ORDER,
  LINK_STYLES,
  connectionHeading,
  dateText,
  edgeKind,
  kindName,
  listNames,
} from "./map-styles";
import {
  DERIVED_KINDS,
  RELATION_KINDS,
  buildResearchGraph,
  parseMapConfig,
  type MapNode,
  type ReasonKind,
} from "@/lib/utils/graph-algorithms";
import { STATIC_PUBLICATIONS } from "@/lib/api/fetch-publications";
import { papersSection } from "@/data/sections/papers";
import { researchSection } from "@/data/sections/research";
import mapData from "@/data/research-map.json";

const graph = buildResearchGraph({
  publications: STATIC_PUBLICATIONS,
  papers: papersSection.papersCards,
  projects: researchSection.projects,
  config: parseMapConfig(mapData),
  now: 2026,
});
const node = (id: string): MapNode => {
  const found = graph.nodes.find((n) => n.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

describe("the research map's names", () => {
  it("names each kind of item as the site does", () => {
    expect(kindName(node("claret2026emr"))).toBe("Paper");
    expect(kindName(node("claret2023geenns"))).toBe("Poster");
    expect(kindName(node("claret2026quadtree"))).toBe("Preprint");
    expect(kindName(node("phd-thesis"))).toBe("PhD Thesis");
  });

  it("dates an item by month when it has one, and running work from its start", () => {
    expect(dateText(node("claret2026activations"))).toBe("August 2026");
    expect(dateText(node("claret2016blockchain"))).toBe("2016");
    expect(dateText(node("geenns"))).toBe("Since 2020");
    expect(dateText(node("emerging-behaviors"))).toBe("Since July 2026");
    expect(
      dateText({ ...node("graphqa"), year: 2018, until: 2020, ongoing: false }),
    ).toBe("2018 to 2020");
  });

  it("lists co-authors in plain English", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["Bea Co"])).toBe("Bea Co");
    expect(listNames(["Bea Co", "Cy Co", "Dee Co"])).toBe(
      "Bea Co, Cy Co and Dee Co",
    );
  });
});

describe("the research map's lines", () => {
  it("draws each derived kind its own way, and curated links heavier", () => {
    // Every line has one neutral colour, so looks must differ: derived
    // kinds by their dashes, curated links by weight (and an arrowhead
    // when they point). Which curated kind a line is, the details say.
    const look = (kind: ReasonKind) =>
      `${LINK_STYLES[kind].width} ${LINK_STYLES[kind].dash ?? "solid"}`;
    const width = (kind: ReasonKind) => LINK_STYLES[kind].width;

    expect(new Set(DERIVED_KINDS.map(look)).size).toBe(DERIVED_KINDS.length);
    expect(Math.min(...RELATION_KINDS.map(width))).toBeGreaterThan(
      Math.max(...DERIVED_KINDS.map(width)),
    );
    expect([...LINK_ORDER].sort()).toEqual(
      [...RELATION_KINDS, ...DERIVED_KINDS].sort(),
    );
  });

  it("heads a pointing link by which end the reader is on", () => {
    expect(connectionHeading("extends", true)).toBe("Built on by");
    expect(connectionHeading("extends", false)).toBe("Builds on");
    expect(connectionHeading("precursor", true)).toBe("Led to");
    expect(connectionHeading("precursor", false)).toBe("Grew out of");
    expect(connectionHeading("part-of", true)).toBe("Part of");
    expect(connectionHeading("part-of", false)).toBe("Includes");
    expect(connectionHeading("co-authors", true)).toBe("Shared co-authors");
  });

  it("draws a link with several reasons by its closest one", () => {
    expect(
      edgeKind({
        reasons: [
          { kind: "same-venue", origin: "derived", text: "", detail: "" },
          { kind: "co-authors", origin: "derived", text: "", detail: "" },
        ],
      }),
    ).toBe("co-authors");
    expect(
      edgeKind({
        reasons: [
          { kind: "same-repository", origin: "derived", text: "", detail: "" },
          { kind: "extends", origin: "curated", text: "", detail: "" },
        ],
      }),
    ).toBe("extends");
  });

  it("swaps the lane colours for the text colour in high contrast", () => {
    const css = (file: string) =>
      readFileSync(join(process.cwd(), file), "utf8").replace(/\s+/g, " ");

    expect(css("src/app/globals.css")).toContain(
      ".lane-ink { --ink: var(--lane); }",
    );
    expect(css("src/styles/high-contrast.css")).toContain(
      ".high-contrast .lane-ink { --ink: hsl(var(--foreground)); }",
    );
  });
});
