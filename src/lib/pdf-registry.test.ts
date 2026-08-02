import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  PDF_ROUTES,
  findPdfRoute,
  findPdfRouteByUrl,
  pdfDownloadName,
} from "./pdf-registry";
import { researchSection } from "@/data/sections/research";
import { papersSection } from "@/data/sections/papers";
import { greeting } from "@/data/sections/greeting";
import { STATIC_PUBLICATIONS } from "@/lib/api/fetch-publications";

/**
 * These run against the real data, not fixtures. The registry's whole job is
 * to stay in step with the sections, so a test on a fixture would prove
 * nothing about the links people actually paste.
 */

describe("PDF_ROUTES", () => {
  it("has no duplicate slugs", () => {
    // A collision between a research anchor and a publication id would
    // silently shadow one of them, and the shadowed link would quietly serve
    // the wrong document rather than fail.
    const slugs = PDF_ROUTES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only ever points at locally hosted PDFs", () => {
    for (const route of PDF_ROUTES) {
      expect(route.url.startsWith("/pdfs/")).toBe(true);
      expect(route.url.endsWith(".pdf")).toBe(true);
    }
  });

  it("points only at files that exist on disk", () => {
    const onDisk = new Set(readdirSync(join(process.cwd(), "public/pdfs")));

    for (const route of PDF_ROUTES) {
      expect(
        onDisk.has(route.url.replace("/pdfs/", "")),
        `${route.slug} points at a missing file: ${route.url}`,
      ).toBe(true);
    }
  });

  it("gives every PDF referenced anywhere in the data a route", () => {
    // Catches drift the other way: a PDF added to a card or publication that
    // never became linkable.
    const referenced = new Set<string>();
    for (const project of researchSection.projects) {
      for (const link of project.links ?? []) {
        if (link.url.startsWith("/pdfs/")) referenced.add(link.url);
      }
    }
    for (const entry of [
      ...papersSection.papersCards,
      ...STATIC_PUBLICATIONS,
    ]) {
      for (const url of [
        entry.paperPdf,
        entry.posterPdf,
        entry.presentationPdf,
      ]) {
        if (url?.startsWith("/pdfs/")) referenced.add(url);
      }
    }

    const routed = new Set(PDF_ROUTES.map((r) => r.url));
    for (const url of referenced) {
      expect(
        routed.has(url),
        `${url} is referenced but has no /pdf route`,
      ).toBe(true);
    }
  });

  it("gives every research card with a PDF its own slug", () => {
    for (const project of researchSection.projects) {
      const pdf = project.links?.find((l) => l.url.startsWith("/pdfs/"));
      if (!pdf || !project.anchorId) continue;
      expect(findPdfRoute(project.anchorId)?.url).toBe(pdf.url);
    }
  });

  it("resolves a bare publication slug to its primary file", () => {
    // claret2026emr carries both a paper and a poster.
    expect(findPdfRoute("claret2026emr")?.url).toContain("paper_");
    expect(findPdfRoute("claret2026emr-poster")?.url).toContain("poster_");
  });

  it("falls back to the poster when that is the only file", () => {
    // claret2023geenns has no paper PDF, so its bare slug must still resolve.
    expect(findPdfRoute("claret2023geenns")?.url).toContain("poster_");
  });

  it("labels a research poster as a poster, not a paper", () => {
    // The vestibular card reads as research but links a conference poster;
    // the kind comes from the filename for exactly this reason.
    expect(findPdfRoute("vestibular-integration")?.kind).toBe("poster");
  });

  it("returns nothing for an unknown slug", () => {
    expect(findPdfRoute("not-a-real-document")).toBeUndefined();
  });

  it("gives the CV a route at /pdf/cv", () => {
    const route = findPdfRoute("cv");
    expect(route).toBeDefined();
    expect(route!.url).toBe("/pdfs/RomainClaret_CV.pdf");
    expect(route!.kind).toBe("cv");
  });

  it("takes the CV's URL from the greeting data, not a second copy of it", () => {
    // The hero's View Resume button opens greeting.resumeLink. If this route
    // were spelled out separately, renaming the file would fix one and break
    // the other, and the reader's share link resolves by matching the URL.
    expect(findPdfRoute("cv")?.url).toBe(greeting.resumeLink);
  });

  describe("findPdfRouteByUrl", () => {
    it("resolves a file back to its canonical bare slug", () => {
      // claret2026emr registers both "claret2026emr" and
      // "claret2026emr-paper" for the same file. The share link should be the
      // bare one, not the alias.
      const paper = findPdfRoute("claret2026emr")!;
      expect(findPdfRouteByUrl(paper.url)?.slug).toBe("claret2026emr");
    });

    it("resolves the CV", () => {
      expect(findPdfRouteByUrl(greeting.resumeLink)?.slug).toBe("cv");
    });

    it("returns nothing for a PDF that has no route", () => {
      // A publication fetched at runtime has no local file, so a reader opened
      // on it must not offer a link.
      expect(findPdfRouteByUrl("https://example.com/elsewhere.pdf")).toBe(
        undefined,
      );
    });
  });

  describe("alias addresses", () => {
    it.each([
      ["phd", "phd-thesis"],
      ["msc", "graphqa"],
      ["bsc", "overclouds"],
    ])("/pdf/%s serves whatever /pdf/%s serves", (short, target) => {
      const targetRoute = findPdfRoute(target);
      expect(targetRoute, `${target} is missing`).toBeDefined();
      expect(findPdfRoute(short)?.url).toBe(targetRoute!.url);
    });

    it.each(["phd", "msc", "bsc"])(
      "/pdf/%s names a target that exists",
      (short) => {
        // A nickname whose target is misspelled is skipped when the routes are
        // built, so it would 404 silently rather than fail anywhere. This is
        // what makes that loud.
        const route = findPdfRoute(short);
        expect(
          route,
          `${short} did not resolve, check SHORT_NAMES`,
        ).toBeDefined();
        expect(findPdfRoute(route!.canonicalSlug!)).toBeDefined();
      },
    );

    it("pins /pdf/thesis-geenns to the thesis chapter, not to the geenns slug", () => {
      // geenns moves to the journal paper when that is published. This must
      // not move with it, so it is asserted against the file, which is the
      // actual guarantee, rather than against whatever geenns points at today.
      expect(findPdfRoute("thesis-geenns")?.url).toBe(
        "/pdfs/RomainClaret_PhD_Thesis_chapter_7.pdf",
      );
      expect(findPdfRoute("thesis-geenns")?.canonicalSlug).toBeUndefined();
    });

    it("never lets an alias win a share link", () => {
      // The reader copies whatever findPdfRouteByUrl returns. Aliases are
      // appended after the real routes so the first match stays canonical;
      // reordering them would quietly start handing out /pdf/thesis-geenns
      // for a card that is about /pdf/geenns.
      expect(
        findPdfRouteByUrl("/pdfs/RomainClaret_PhD_Thesis_chapter_7.pdf")?.slug,
      ).toBe("geenns");
      expect(findPdfRouteByUrl("/pdfs/RomainClaret_PhD_Thesis.pdf")?.slug).toBe(
        "phd-thesis",
      );
      expect(findPdfRouteByUrl("/pdfs/RomainClaret_Msc_Thesis.pdf")?.slug).toBe(
        "graphqa",
      );
      expect(findPdfRouteByUrl("/pdfs/RomainClaret_Bsc_Thesis.pdf")?.slug).toBe(
        "overclouds",
      );
    });

    it("keeps the research cards' own slugs intact", () => {
      // An alias registered before the research loop would shadow a card.
      expect(findPdfRoute("geenns")?.url).toBe(
        "/pdfs/RomainClaret_PhD_Thesis_chapter_7.pdf",
      );
      expect(findPdfRoute("phd-thesis")?.canonicalSlug).toBeUndefined();
    });
  });

  it("derives a sensible download filename", () => {
    const route = findPdfRoute("phd-thesis");
    expect(route).toBeDefined();
    expect(pdfDownloadName(route!)).toBe("RomainClaret_PhD_Thesis.pdf");
  });
});
