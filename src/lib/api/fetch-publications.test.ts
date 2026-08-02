import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchAllPublications,
  comparePublications,
  publicationToBibTeX,
  type Publication,
} from "./fetch-publications";

// A Semantic Scholar paper with abbreviated author names (as the real API returns
// them) and an open-access PDF, used to exercise the runtime normalization path.
const ssPaper = {
  paperId: "p1",
  title: "Test GECCO Paper On Neuroevolution",
  authors: [
    { authorId: "a1", name: "Romain Claret" },
    { authorId: "a2", name: "K. Stoffel" },
    { authorId: "a3", name: "M. O'Neill" },
    { authorId: "a4", name: "Someone Else" },
  ],
  year: 2024,
  venue: "GECCO Companion",
  citationCount: 3,
  abstract: "abstract",
  externalIds: { DOI: "10.0/test" },
  openAccessPdf: { url: "https://example.com/paper.pdf" },
  url: "https://www.semanticscholar.org/paper/p1",
};

describe("fetchAllPublications - author normalization & curated fields", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [ssPaper] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function run() {
    // rateLimitedFetch awaits a setTimeout; advance fake timers to resolve it.
    const promise = fetchAllPublications({ semanticScholarId: "test-id" });
    await vi.runAllTimersAsync();
    return promise;
  }

  it("normalizes abbreviated author names using the shared config", async () => {
    const pubs = await run();
    const fetched = pubs.find((p) => p.id === "p1");

    expect(fetched).toBeDefined();
    // "K. Stoffel" -> "Kilian Stoffel", "M. O'Neill" -> "Michael O'Neill";
    // already-full and unmapped names pass through unchanged.
    expect(fetched!.authors).toEqual([
      "Romain Claret",
      "Kilian Stoffel",
      "Michael O'Neill",
      "Someone Else",
    ]);
  });

  it("defaults openAccessUrl to '' for fetched papers so curated values survive", async () => {
    const pubs = await run();
    const fetched = pubs.find((p) => p.id === "p1");

    expect(fetched!.openAccessUrl).toBe("");
    // The PDF link is still derived from the API's openAccessPdf.
    expect(fetched!.pdfUrl).toBe("https://example.com/paper.pdf");
  });

  it("leaves static publications' author names untouched", async () => {
    const pubs = await run();
    const staticPub = pubs.find((p) => p.id === "claret2026partitioned");

    expect(staticPub).toBeDefined();
    expect(staticPub!.authors).toContain("Romain Claret");
    expect(staticPub!.authors).toContain("Michael O'Neill");
  });
});

describe("comparePublications", () => {
  const make = (over: Partial<Publication>): Publication => ({
    id: "x",
    title: "t",
    authors: [],
    year: "2026",
    source: "static",
    ...over,
  });

  it("sorts starred papers first, even when older", () => {
    const order = [
      make({ id: "plain", year: "2026" }),
      make({ id: "star", year: "2020", starred: true }),
    ]
      .sort(comparePublications)
      .map((p) => p.id);
    expect(order).toEqual(["star", "plain"]);
  });

  it("sorts by year, newest first", () => {
    const order = [
      make({ id: "old", year: "2024" }),
      make({ id: "new", year: "2026" }),
    ]
      .sort(comparePublications)
      .map((p) => p.id);
    expect(order).toEqual(["new", "old"]);
  });

  it("breaks a year tie by month, newest first", () => {
    const order = [
      make({ id: "jun", year: "2026", month: 6 }),
      make({ id: "sep", year: "2026", month: 9 }),
    ]
      .sort(comparePublications)
      .map((p) => p.id);
    expect(order).toEqual(["sep", "jun"]);
  });

  it("breaks a year and month tie by citations", () => {
    const order = [
      make({ id: "lo", year: "2026", month: 6, citations: 1 }),
      make({ id: "hi", year: "2026", month: 6, citations: 9 }),
    ]
      .sort(comparePublications)
      .map((p) => p.id);
    expect(order).toEqual(["hi", "lo"]);
  });
});

describe("publicationToBibTeX", () => {
  const base: Publication = {
    id: "claret2026emr",
    title: "Tensor-Accelerated Grids",
    authors: ["Romain Claret", "Michael O'Neill"],
    year: "2026",
    venue: "Genetic and Evolutionary Computation Conference (GECCO)",
    doi: "10.1145/3795101.3805361",
    source: "static",
  };

  it("keys the entry by the publication id and joins authors with 'and'", () => {
    const bib = publicationToBibTeX(base);
    expect(bib.startsWith("@inproceedings{claret2026emr,")).toBe(true);
    expect(bib).toContain("author = {Romain Claret and Michael O'Neill}");
    expect(bib).toContain(
      "booktitle = {Genetic and Evolutionary Computation Conference (GECCO)}",
    );
    expect(bib).toContain("doi = {10.1145/3795101.3805361}");
  });

  it("omits the doi field when absent and falls back to @misc without a venue", () => {
    const noDoi = publicationToBibTeX({ ...base, doi: undefined });
    expect(noDoi).not.toContain("doi =");

    const noVenue = publicationToBibTeX({
      ...base,
      venue: undefined,
      doi: undefined,
    });
    expect(noVenue.startsWith("@misc{claret2026emr,")).toBe(true);
    expect(noVenue).not.toContain("booktitle =");
  });
});
