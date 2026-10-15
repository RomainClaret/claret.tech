import { describe, it, expect } from "vitest";
import {
  buildResearchGraph,
  filterGraph,
  parseMapConfig,
  parsePaperDate,
  parseProjectSpan,
  venueAcronym,
  type MapConfig,
  type ResearchGraph,
} from "./graph-algorithms";
import {
  STATIC_PUBLICATIONS,
  type Publication,
} from "@/lib/api/fetch-publications";
import { papersSection, type Paper } from "@/data/sections/papers";
import {
  isDisplayed,
  researchSection,
  type ResearchProject,
} from "@/data/sections/research";
import mapData from "@/data/research-map.json";

/**
 * The research map's graph: which items it shows, and why it joins them.
 * The site's own data first, then small made-up cases for each rule.
 */

const siteGraph = buildResearchGraph({
  publications: STATIC_PUBLICATIONS,
  papers: papersSection.papersCards,
  projects: researchSection.projects,
  config: parseMapConfig(mapData),
  now: 2026,
});

const config = (over: Partial<MapConfig> = {}): MapConfig => ({
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
      id: "named",
      label: "Named lane",
      color: "#0d9488",
      repos: [],
      members: ["chosen"],
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
  ...over,
});

const pub = (id: string, over: Partial<Publication> = {}): Publication => ({
  id,
  title: `Title of ${id}`,
  authors: ["Ada Owner"],
  year: "2024",
  source: "static",
  ...over,
});

const paper = (anchorId: string, over: Partial<Paper> = {}): Paper => ({
  title: `Title of ${anchorId}`,
  date: "2026",
  subtitle: "What it is about, at length.",
  anchorId,
  image: "",
  footerLink: [],
  ...over,
});

const project = (
  anchorId: string,
  over: Partial<ResearchProject> = {},
): ResearchProject => ({
  title: `Title of ${anchorId}`,
  subtitle: "PhD Thesis",
  description: "",
  tags: [],
  status: "completed",
  yearsSpent: 1,
  year: "2026",
  anchorId,
  ...over,
});

const build = (
  input: Partial<Parameters<typeof buildResearchGraph>[0]>,
): ResearchGraph =>
  buildResearchGraph({
    publications: [],
    papers: [],
    projects: [],
    config: config(),
    now: 2026,
    ...input,
  });

const edgeBetween = (graph: ResearchGraph, a: string, b: string) =>
  graph.edges.find(
    (edge) =>
      (edge.source === a && edge.target === b) ||
      (edge.source === b && edge.target === a),
  );

describe("buildResearchGraph, on the site's data", () => {
  it("keys every node by the deep link the page already uses", () => {
    const expected = [
      ...STATIC_PUBLICATIONS.map((pub) => pub.id),
      ...papersSection.papersCards.flatMap((card) =>
        card.anchorId ? [card.anchorId] : [],
      ),
      ...researchSection.projects
        .filter(isDisplayed)
        .flatMap((card) => (card.anchorId ? [card.anchorId] : [])),
    ];

    expect(siteGraph.nodes.map((node) => node.id).sort()).toEqual(
      [...expected].sort(),
    );
    expect(new Set(expected).size).toBe(expected.length);
  });

  it("takes no evidence from the co-authors on every neuroevolution paper", () => {
    // Michael O'Neill and Paul Cotofrei are on all eight: chained through
    // them, every one of those papers would link to the next, whatever its
    // subject. The co-authors on some of them do tell them apart.
    const texts = siteGraph.edges.flatMap((edge) =>
      edge.reasons.map((reason) => reason.text),
    );

    expect(texts.some((text) => text.includes("O'Neill"))).toBe(false);
    expect(texts.some((text) => text.includes("Cotofrei"))).toBe(false);
    expect(texts).toContain("Co-author: Kilian Stoffel");
    expect(texts).toContain("Co-author: Arthur Gygax");
    expect(texts).toContain("Co-author: Pascal Felber");
  });

  it("attaches the PhD thesis to the eight papers whose code its card links", () => {
    const linked = siteGraph.edges
      .filter(
        (edge) =>
          (edge.source === "phd-thesis" || edge.target === "phd-thesis") &&
          edge.reasons.some((reason) => reason.kind === "project-link"),
      )
      .map((edge) =>
        edge.source === "phd-thesis" ? edge.target : edge.source,
      );

    expect(linked.sort()).toEqual(
      [
        ...STATIC_PUBLICATIONS.map((pub) => pub.id),
        "claret2026quadtree",
      ].sort(),
    );
  });

  it("draws one edge per pair, with every reason it has", () => {
    const ids = siteGraph.edges.map((edge) =>
      [edge.source, edge.target].sort().join(" "),
    );
    expect(new Set(ids).size).toBe(ids.length);

    const shared = edgeBetween(
      siteGraph,
      "claret2026pruner",
      "claret2026partitioned",
    );
    expect(shared?.reasons.map((reason) => reason.text)).toEqual([
      "Same code repository: es-hyperneat-optimization-studies",
      "Co-author: Arthur Gygax",
      "Co-author: Pascal Felber",
    ]);
  });

  it("names documents and links as the cards do, and arXiv as arXiv", () => {
    // The quadtree card calls its arXiv page "Paper": next to its "Read
    // Paper" (the PDF), the map would have offered two papers.
    const quadtree = siteGraph.nodes.find(
      (node) => node.id === "claret2026quadtree",
    );
    expect(quadtree?.documents).toEqual([
      {
        name: "Read Paper",
        url: "/pdfs/preprint_ARXIV_2026_claret2026quadtree.pdf",
      },
    ]);
    expect(quadtree?.links.map((link) => link.label)).toEqual([
      "arXiv",
      "Code",
    ]);
  });
});

describe("buildResearchGraph, rule by rule", () => {
  it("dates Other Work by its own year, not today's", () => {
    // The old graph parsed a card's "2026" as a full date, failed, and fell
    // back to the current year.
    const graph = build({
      papers: [
        paper("plain", { date: "2016" }),
        paper("dated", { date: "07.2023" }),
      ],
      now: 2099,
    });

    expect(
      graph.nodes.map(({ id, year, month }) => ({ id, year, month })),
    ).toEqual([
      { id: "plain", year: 2016, month: undefined },
      { id: "dated", year: 2023, month: 7 },
    ]);
  });

  it("leaves a hidden research card out, and every link to it", () => {
    const graph = build({
      papers: [
        paper("item", {
          footerLink: [{ name: "Code", url: "https://github.com/ada/tool" }],
        }),
      ],
      projects: [
        project("hidden", {
          display: false,
          links: [{ name: "Code", url: "https://github.com/ada/tool" }],
        }),
      ],
    });

    expect(graph.nodes.map((node) => node.id)).toEqual(["item"]);
    expect(graph.edges).toEqual([]);
  });

  it("keeps the co-authors of a pair, who are all that joins it", () => {
    const graph = build({
      publications: [
        pub("first", { authors: ["Ada Owner", "Bea Co", "Cy Co"] }),
        pub("second", {
          authors: ["Bea Co", "Ada Owner", "Cy Co"],
          year: "2025",
        }),
      ],
    });

    expect(edgeBetween(graph, "first", "second")?.reasons).toEqual([
      {
        kind: "co-authors",
        origin: "derived",
        text: "Co-author: Bea Co",
        detail: "Bea Co",
      },
      {
        kind: "co-authors",
        origin: "derived",
        text: "Co-author: Cy Co",
        detail: "Cy Co",
      },
    ]);
  });

  it("chains a group in time rather than joining every pair", () => {
    const code = "https://github.com/ada/tool";
    const graph = build({
      publications: [
        pub("c", { year: "2025", codeUrl: code }),
        pub("a", { year: "2021", codeUrl: code }),
        pub("d", { year: "2025", month: 9, codeUrl: code }),
        pub("b", { year: "2023", codeUrl: `${code}/` }),
      ],
    });

    expect(graph.edges.map((edge) => `${edge.source} ${edge.target}`)).toEqual([
      "a b",
      "b c",
      "c d",
    ]);
  });

  it("lets a curated relation lead and point, with derived reasons after it", () => {
    const code = "https://github.com/ada/tool";
    const graph = build({
      publications: [
        pub("older", { year: "2021", codeUrl: code }),
        pub("newer", { year: "2023", codeUrl: code }),
      ],
      config: config({
        relations: [
          {
            from: "newer",
            to: "older",
            kind: "extends",
            note: "It adds a step.",
          },
          { from: "newer", to: "missing", kind: "extends", note: "Not shown." },
        ],
      }),
    });

    expect(graph.edges).toEqual([
      {
        id: "newer--older",
        source: "newer",
        target: "older",
        directed: true,
        reasons: [
          {
            kind: "extends",
            origin: "curated",
            text: "It adds a step.",
            detail: "It adds a step.",
            from: "newer",
          },
          {
            kind: "same-repository",
            origin: "derived",
            text: "Same code repository: tool",
            detail: "tool",
          },
        ],
      },
    ]);
  });

  it("puts an item in a lane by name first, then by its code, then in the fallback", () => {
    const graph = build({
      publications: [
        pub("chosen", { codeUrl: "https://github.com/ada/tool" }),
        pub("coded", { codeUrl: "https://github.com/ada/tool" }),
        pub("other"),
      ],
    });

    expect(
      Object.fromEntries(graph.nodes.map((node) => [node.id, node.lane])),
    ).toEqual({ chosen: "named", coded: "code", other: "rest" });
  });

  it("joins a project to an item whose PDF or code its card links", () => {
    const graph = build({
      papers: [paper("poster", { posterPdf: "/pdfs/poster_X_2020_a.pdf" })],
      projects: [
        project("card", {
          links: [
            { name: "Conference Poster", url: "/pdfs/poster_X_2020_a.pdf" },
          ],
        }),
      ],
    });

    expect(edgeBetween(graph, "card", "poster")?.reasons).toEqual([
      {
        kind: "project-link",
        origin: "derived",
        text: "Linked from the Title of card card: poster",
        detail: "poster",
      },
    ]);
  });
});

describe("parseMapConfig", () => {
  it("leaves out the entries it cannot use and keeps the rest", () => {
    const parsed = parseMapConfig({
      owner: "Ada Owner",
      lanes: [{ id: "a", label: "A" }, { label: "no id" }, "not a lane"],
      labels: { a: "Short", b: 3 },
      relations: [
        { from: "a", to: "b", kind: "extends" },
        { from: "a", to: "b", kind: "inspired" },
        { from: "a", to: "a", kind: "extends" },
        { from: "a", kind: "companion" },
      ],
    });

    expect(parsed).toEqual({
      owner: "Ada Owner",
      lanes: [
        {
          id: "a",
          label: "A",
          color: "#64748b",
          repos: [],
          members: [],
          fallback: false,
        },
      ],
      labels: { a: "Short" },
      relations: [{ from: "a", to: "b", kind: "extends", note: "" }],
    });
  });

  it("gives an empty map for anything that is not a map", () => {
    expect(parseMapConfig(null)).toEqual({
      owner: "",
      lanes: [],
      labels: {},
      relations: [],
    });
  });
});

describe("filterGraph", () => {
  const code = "https://github.com/ada/tool";
  const graph = build({
    publications: [
      pub("a", {
        year: "2021",
        codeUrl: code,
        authors: ["Ada Owner", "Bea Co"],
      }),
      pub("b", {
        year: "2022",
        codeUrl: code,
        authors: ["Ada Owner", "Bea Co"],
      }),
      pub("c", { year: "2023", authors: ["Ada Owner", "Dee Co"] }),
      pub("d", { year: "2024", authors: ["Ada Owner", "Dee Co"] }),
    ],
  });

  it("keeps the chosen lanes, and only the edges inside them", () => {
    const filtered = filterGraph(graph, { lanes: ["code"] });

    expect(filtered.lanes.map((lane) => lane.id)).toEqual(["code"]);
    expect(filtered.nodes.map((node) => node.id)).toEqual(["a", "b"]);
    expect(filtered.edges.map((edge) => edge.id)).toEqual(["a--b"]);
  });

  it("keeps an edge while one of its reasons is of a chosen kind", () => {
    const filtered = filterGraph(graph, { kinds: ["same-repository"] });

    expect(filtered.nodes).toHaveLength(4);
    expect(filtered.edges).toEqual([
      expect.objectContaining({
        id: "a--b",
        reasons: [expect.objectContaining({ kind: "same-repository" })],
      }),
    ]);
  });
});

describe("the dates and venues the cards give", () => {
  it.each([
    ["2026", { year: 2026, month: undefined }],
    ["07.2023", { year: 2023, month: 7 }],
    ["13.2023", { year: 2023, month: undefined }],
    ["soon", null],
  ])("reads an Other Work date of %j", (date, expected) => {
    expect(parsePaperDate(date)).toEqual(expected);
  });

  it.each([
    [
      { researchStart: "2026-07", year: "2026-Present" },
      { year: 2026, month: 7, until: 2026, ongoing: true },
    ],
    [
      { year: "2020-Present" },
      { year: 2020, month: undefined, until: 2026, ongoing: true },
    ],
    [
      { year: "2018 - 2020" },
      { year: 2018, month: undefined, until: 2020, ongoing: false },
    ],
    [
      { year: "2016" },
      { year: 2016, month: undefined, until: undefined, ongoing: false },
    ],
    [{ year: "" }, null],
  ])("reads a project's span from %j", (project, expected) => {
    expect(parseProjectSpan(project, 2026)).toEqual(expected);
  });

  it.each([
    ["Genetic and Evolutionary Computation Conference (GECCO)", "GECCO"],
    ["ICPR 2026 Workshops (BIOMAP)", "BIOMAP"],
    ["A venue without one", undefined],
    [undefined, undefined],
  ])("finds the acronym in %j", (venue, expected) => {
    expect(venueAcronym(venue)).toBe(expected);
  });
});
