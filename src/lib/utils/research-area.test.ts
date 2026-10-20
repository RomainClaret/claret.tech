import { describe, it, expect } from "vitest";
import { researchAreaOf } from "./research-area";
import { STATIC_PUBLICATIONS } from "@/lib/api/fetch-publications";
import { papersSection } from "@/data/sections/papers";
import abstracts from "@/lib/api/publication-abstracts.json";

/**
 * Matched as substrings, the area words filed the Blockchain paper under
 * neuroevolution ("proclaimed revolution", "three evolutionary paths") and
 * the vestibular poster under machine learning (an "ai" inside a word).
 */
const otherWork = (id: string) => {
  const card = papersSection.papersCards.find((c) => c.anchorId === id);
  if (!card) throw new Error(`No Other Work card ${id}`);
  return card;
};

describe("researchAreaOf", () => {
  it("files the papers under neuroevolution", () => {
    expect(STATIC_PUBLICATIONS.map(researchAreaOf)).toEqual(
      STATIC_PUBLICATIONS.map(() => "neuroevolution"),
    );
    expect(researchAreaOf(otherWork("claret2026quadtree"))).toBe(
      "neuroevolution",
    );
    expect(researchAreaOf(otherWork("claret2023geenns"))).toBe(
      "neuroevolution",
    );
  });

  it("files each paper the same before its abstract comes and after", () => {
    // The page draws the curated papers without their abstracts, which
    // /api/publications brings on mount: a card's colour must not change.
    const withAbstract = STATIC_PUBLICATIONS.map((publication) => ({
      ...publication,
      abstract: (abstracts as Record<string, string>)[publication.id],
    }));

    expect(STATIC_PUBLICATIONS.map(researchAreaOf)).toEqual(
      withAbstract.map(researchAreaOf),
    );
  });

  it("files the Blockchain paper under blockchain", () => {
    expect(researchAreaOf(otherWork("claret2016blockchain"))).toBe(
      "blockchain",
    );
  });

  it("files the vestibular poster under neuroscience", () => {
    expect(researchAreaOf(otherWork("karmali2010perceptual"))).toBe(
      "neuroscience",
    );
  });

  it("matches whole words only", () => {
    expect(researchAreaOf({ title: "The revolution, again" })).toBe("general");
    expect(researchAreaOf({ title: "Evolutionary paths of a ledger" })).toBe(
      "blockchain",
    );
    expect(researchAreaOf({ title: "AI for question answering" })).toBe("ml");
    expect(researchAreaOf({ title: "Tuning ES-HyperNEAT" })).toBe(
      "neuroevolution",
    );
  });
});
