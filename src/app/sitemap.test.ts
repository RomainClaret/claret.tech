import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";
import { PDF_ROUTES } from "@/lib/pdf-registry";

/**
 * The sitemap decides which of several addresses for one document is the one
 * crawlers are told about, so it is worth asserting. Runs against the real
 * registry: a fixture would prove nothing about the URLs actually published.
 */

const entries = sitemap();
const urls = entries.map((entry) => entry.url);
const pdfPaths = urls
  .filter((url) => url.includes("/pdf/"))
  .map((url) => url.replace(/^https?:\/\/[^/]+/, ""));

describe("sitemap", () => {
  it("lists each document once, under its own address", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it.each(["phd", "msc", "bsc"])("leaves the /pdf/%s nickname out", (short) => {
    // It resolves to a document already listed under its real address, and
    // two URLs serving one file is duplicate content.
    expect(pdfPaths).not.toContain(`/pdf/${short}`);
  });

  it.each(["phd-thesis", "graphqa", "overclouds"])(
    "still lists /pdf/%s, the address the nickname points at",
    (slug) => {
      expect(pdfPaths).toContain(`/pdf/${slug}`);
    },
  );

  it("lists /pdf/thesis-geenns, which is an address of its own", () => {
    // Not a nickname: it names the thesis chapter permanently, and stops
    // sharing a file with /pdf/geenns once the journal paper is out.
    expect(pdfPaths).toContain("/pdf/thesis-geenns");
    expect(pdfPaths).toContain("/pdf/geenns");
  });

  it("leaves the suffixed -paper and -poster aliases out", () => {
    for (const path of pdfPaths) {
      expect(path).not.toMatch(/-(paper|poster|presentation)$/);
    }
  });

  it("never lists a document that has no route", () => {
    const slugs = new Set(PDF_ROUTES.map((route) => route.slug));
    for (const path of pdfPaths) {
      expect(slugs.has(path.replace("/pdf/", "")), `${path} has no route`).toBe(
        true,
      );
    }
  });

  it("marks the CV as changing more often than a published paper", () => {
    const cv = entries.find((entry) => entry.url.endsWith("/pdf/cv"));
    const thesis = entries.find((entry) =>
      entry.url.endsWith("/pdf/phd-thesis"),
    );
    expect(cv?.changeFrequency).toBe("monthly");
    expect(thesis?.changeFrequency).toBe("yearly");
  });
});
