import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARXIV_VARIANTS, STATIC_PUBLICATIONS } from "./fetch-publications";
import { papersSection } from "@/data/sections/papers";

/**
 * The publications data lives in two committed files that have to agree:
 * src/lib/api/static-publications.json, which the app and the fetch script
 * both read, and public/publications.json, which the API serves and which
 * additionally carries lastUpdated, count and totalCitations.
 *
 * They agree today, and nothing enforced that. A hand edit to one and not the
 * other is invisible until a refetch rebuilds from the static array and
 * silently drops whatever only existed in the served file.
 *
 * Run against the real files rather than fixtures: the whole point is what
 * ships, so a fixture would prove nothing.
 */

interface Served {
  count: number;
  totalCitations: number;
  publications: Array<Record<string, unknown>>;
}

const served: Served = JSON.parse(
  readFileSync(join(process.cwd(), "public/publications.json"), "utf-8"),
);

describe("publications.json against the static source", () => {
  it("serves exactly the publications in the static source", () => {
    const staticIds = STATIC_PUBLICATIONS.map((p) => p.id).sort();
    const servedIds = served.publications.map((p) => p.id as string).sort();

    expect(servedIds).toEqual(staticIds);
  });

  it("agrees field for field, so a refetch cannot quietly drop anything", () => {
    const drift: string[] = [];

    for (const source of STATIC_PUBLICATIONS) {
      const shipped = served.publications.find((p) => p.id === source.id);
      if (!shipped) continue; // covered by the id test above
      const keys = new Set([...Object.keys(source), ...Object.keys(shipped)]);
      for (const key of keys) {
        const a = JSON.stringify((source as Record<string, unknown>)[key]);
        const b = JSON.stringify(shipped[key]);
        if (a !== b) drift.push(`${source.id}.${key}: ${a} vs ${b}`);
      }
    }

    expect(drift).toEqual([]);
  });

  it("carries counters that describe the array it ships with", () => {
    expect(served.count).toBe(served.publications.length);
    expect(served.totalCitations).toBe(
      served.publications.reduce(
        (sum, p) => sum + ((p.citations as number) ?? 0),
        0,
      ),
    );
  });
});

describe("publications against Other Work", () => {
  /**
   * The vestibular poster was moved out of the publications list and rebuilt
   * as an Other Work card. Nothing in the fetch pipeline records that it was
   * removed deliberately, and its dedupe is exact lowercase title matching, so
   * an academic API listing it again would add it back as an eighth
   * publication while the card still exists, and it would render twice.
   *
   * Asserted as a general rule rather than against that one id, so it also
   * catches any future entry that ends up in both lists.
   */
  const cards = papersSection.papersCards;

  it("shares no id with an Other Work card", () => {
    const cardIds = new Set(
      cards.map((c) => c.anchorId).filter(Boolean) as string[],
    );
    const collisions = STATIC_PUBLICATIONS.map((p) => p.id).filter((id) =>
      cardIds.has(id),
    );

    expect(collisions, "these would render as two cards").toEqual([]);
  });

  it("shares no title with an Other Work card", () => {
    // The id can differ while the document is the same, and title is the only
    // key the fetcher dedupes on.
    const cardTitles = new Set(cards.map((c) => c.title.toLowerCase().trim()));
    const collisions = STATIC_PUBLICATIONS.filter((p) =>
      cardTitles.has(p.title.toLowerCase().trim()),
    ).map((p) => p.title);

    expect(collisions).toEqual([]);
  });

  it("keeps the served list clear of Other Work too", () => {
    // The static array is what a rebuild starts from, but the served file is
    // what the page actually renders, and a fetch can append to it.
    const cardIds = new Set(
      cards.map((c) => c.anchorId).filter(Boolean) as string[],
    );
    const collisions = served.publications
      .map((p) => p.id as string)
      .filter((id) => cardIds.has(id));

    expect(collisions).toEqual([]);
  });
});

/**
 * arxivId is hand-typed into JSON and interpolated straight into
 * https://arxiv.org/abs/<id>, so a pasted abstract URL or an "arXiv:" prefix
 * would ship a dead link that nothing else would catch.
 */
describe("arXiv identifiers", () => {
  // New-style (2608.24480, optionally version-pinned) and the pre-2007 style
  // (cs.NE/0501001), which is still what the oldest papers carry.
  const ARXIV_ID =
    /^(\d{4}\.\d{4,5}(v\d+)?|[a-z-]+(\.[A-Z]{2})?\/\d{7}(v\d+)?)$/;

  it("stores bare identifiers, not URLs", () => {
    const bad = STATIC_PUBLICATIONS.filter(
      (p) => p.arxivId !== undefined && !ARXIV_ID.test(p.arxivId),
    ).map((p) => `${p.id}: ${p.arxivId}`);

    expect(bad).toEqual([]);
  });

  it("does not call a to-appear paper's arXiv copy the published version", () => {
    // "published version" is a claim about the record, and a to-appear paper
    // does not have one yet. Omitting arxivVariant defaults to published, so
    // this goes wrong silently rather than loudly.
    const mislabelled = STATIC_PUBLICATIONS.filter(
      (p) =>
        p.arxivId !== undefined &&
        p.status === "to-appear" &&
        (p.arxivVariant ?? "published") === "published",
    ).map((p) => p.id);

    expect(mislabelled).toEqual([]);
  });

  it("names only arXiv variants the cards have a label for", () => {
    // The JSON reaches Publication through a cast, so a typo such as
    // "Accepted" compiles, and the card would render nothing for it.
    const known: readonly string[] = ARXIV_VARIANTS;
    const bad = [...STATIC_PUBLICATIONS, ...papersSection.papersCards]
      .filter(
        (e) => e.arxivVariant !== undefined && !known.includes(e.arxivVariant),
      )
      .map((e) => `${"id" in e ? e.id : e.title}: ${e.arxivVariant}`);

    expect(bad).toEqual([]);
  });

  it("stores bare identifiers on Other Work cards too", () => {
    const bad = papersSection.papersCards
      .filter((c) => c.arxivId !== undefined && !ARXIV_ID.test(c.arxivId))
      .map((c) => `${c.anchorId ?? c.title}: ${c.arxivId}`);

    expect(bad).toEqual([]);
  });
});
