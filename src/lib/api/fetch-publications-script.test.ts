import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * The publications workflow merges papers from Semantic Scholar into the
 * curated file and prints their text to the public job log (security audit
 * run 1, hardening).
 */
const { mergeWithExisting, logText } = createRequire(import.meta.url)(
  "../../../scripts/fetch-publications.js",
) as {
  mergeWithExisting: (
    fetched: Record<string, unknown>[],
    existing: { publications: Record<string, unknown>[] } | null,
  ) => Record<string, unknown>[];
  logText: (value: unknown) => string;
};

const curated = {
  id: "claret2026activations",
  title: "A curated paper",
  source: "static",
  pdfUrl: "/pdfs/curated.pdf",
  citations: 3,
};

describe("mergeWithExisting", () => {
  it("does not merge a paper titled like a curated id onto that record", () => {
    const merged = mergeWithExisting(
      [{ id: "ss-1", title: "claret2026activations", citations: 0 }],
      { publications: [curated] },
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((p) => p.id === "ss-1")).not.toHaveProperty("pdfUrl");
    expect(merged.find((p) => p.id === curated.id)).toEqual(curated);
  });

  it("refreshes a matched paper's fields and keeps the curated ones", () => {
    const [paper] = mergeWithExisting(
      [{ title: "A curated paper", citations: 9, pdfUrl: "" }],
      { publications: [curated] },
    );

    expect(paper).toEqual({ ...curated, citations: 9 });
  });

  it("keeps https links only from the fetch", () => {
    const [paper] = mergeWithExisting(
      [
        {
          id: "ss-2",
          title: "Fetched",
          url: "javascript:alert(1)",
          openAccessUrl: "http://example.com/a.pdf",
          pdfUrl: "https://example.com/b.pdf",
        },
      ],
      null,
    );

    expect(paper).toEqual({
      id: "ss-2",
      title: "Fetched",
      pdfUrl: "https://example.com/b.pdf",
    });
  });

  it("keeps a curated paper this run did not return", () => {
    expect(mergeWithExisting([], { publications: [curated] })).toEqual([
      curated,
    ]);
  });
});

describe("logText", () => {
  it("writes no workflow command and no second line", () => {
    const line = logText("Title\n::warning title=x::injected");
    expect(line).not.toContain("\n");
    expect(line).not.toContain("::");
  });
});
