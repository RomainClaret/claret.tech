import { researchSection } from "@/data/sections/research";
import { papersSection } from "@/data/sections/papers";
import { greeting } from "@/data/sections/greeting";
import { STATIC_PUBLICATIONS } from "@/lib/api/fetch-publications";

/**
 * Every locally hosted PDF, addressable at /pdf/<slug>.
 *
 * Derived from the section data rather than hand-listed, so a PDF added to a
 * card or a publication becomes linkable without touching this file, and a
 * link can never point at something the site no longer references.
 *
 * Only static data feeds this. Publications fetched from Semantic Scholar or
 * ORCID at runtime have no local file to serve.
 */

export interface PdfRoute {
  slug: string;
  /** Root-relative path under /pdfs. */
  url: string;
  /** Shown in the reader header and as the page title. */
  title: string;
  /** What the file is, for the page description. */
  kind: "paper" | "poster" | "presentation" | "thesis" | "cv";
  /**
   * The slug this one is a nickname for. Set on the short names below, so the
   * sitemap lists the document once and the page can point crawlers at the
   * real address. Absent on routes that are an address in their own right.
   */
  canonicalSlug?: string;
}

/**
 * Short, memorable addresses for documents that already have a route.
 *
 * These follow their target: /pdf/phd is whatever /pdf/phd-thesis serves, so
 * replacing a thesis file keeps both right. They are nicknames for one
 * document, not documents of their own.
 */
const SHORT_NAMES: Array<{ slug: string; of: string }> = [
  { slug: "phd", of: "phd-thesis" },
  { slug: "msc", of: "graphqa" },
  { slug: "bsc", of: "overclouds" },
];

/**
 * Addresses pinned to one file for good, whatever the cards do later.
 *
 * /pdf/geenns names the current state of the GEENNS work and moves to the
 * journal paper when that is published. /pdf/thesis-geenns names the thesis
 * chapter itself and must not move with it, which is why it is pinned to the
 * file rather than pointed at the geenns slug: pointing at the slug would drag
 * it along to the journal paper. The two serve the same document today and are
 * meant to diverge.
 */
const PINNED: PdfRoute[] = [
  {
    slug: "thesis-geenns",
    url: "/pdfs/RomainClaret_PhD_Thesis_chapter_7.pdf",
    title: "GEENNS: Compositional Intelligence Through Evolution",
    kind: "thesis",
  },
];

const isLocalPdf = (url: string | undefined): url is string =>
  !!url && url.startsWith("/") && url.endsWith(".pdf");

/**
 * What a research card's single PDF actually is.
 *
 * The filenames already encode it (poster_, presentation_, paper_), which is
 * more reliable than the card's subtitle: the vestibular card is titled as
 * research but links a conference poster.
 */
function researchPdfKind(url: string, subtitle: string): PdfRoute["kind"] {
  const file = url.split("/").pop() ?? "";
  if (file.startsWith("poster_")) return "poster";
  if (file.startsWith("presentation_")) return "presentation";
  if (subtitle.toLowerCase().includes("thesis")) return "thesis";
  return "paper";
}

/**
 * Papers and publications share a shape: an id plus up to three PDFs. The bare
 * slug resolves to the entry's primary file, and each file also gets an
 * explicit suffixed slug so a poster can be linked without ambiguity.
 *
 * Primary order is paper, then poster, then presentation, so an entry whose
 * only file is a poster still answers on its bare slug.
 */
function publicationRoutes(entry: {
  id: string;
  title: string;
  paperPdf?: string;
  posterPdf?: string;
  presentationPdf?: string;
}): PdfRoute[] {
  const files: Array<{ url?: string; kind: PdfRoute["kind"] }> = [
    { url: entry.paperPdf, kind: "paper" },
    { url: entry.posterPdf, kind: "poster" },
    { url: entry.presentationPdf, kind: "presentation" },
  ];

  const present = files.filter((f) => isLocalPdf(f.url)) as Array<{
    url: string;
    kind: PdfRoute["kind"];
  }>;
  if (present.length === 0) return [];

  const routes: PdfRoute[] = [
    {
      slug: entry.id,
      url: present[0].url,
      title: entry.title,
      kind: present[0].kind,
    },
  ];
  for (const file of present) {
    routes.push({
      slug: `${entry.id}-${file.kind}`,
      url: file.url,
      title: entry.title,
      kind: file.kind,
    });
  }
  return routes;
}

function buildRoutes(): PdfRoute[] {
  const routes: PdfRoute[] = [];

  // The CV has no card or publication to derive from, so it is named here. Its
  // URL comes from the greeting data, which is what the hero's View Resume
  // button opens, so the route and the button cannot point at different files.
  if (isLocalPdf(greeting.resumeLink)) {
    routes.push({
      slug: "cv",
      url: greeting.resumeLink,
      title: "Resume",
      kind: "cv",
    });
  }

  // Research cards carry exactly one PDF, in their links array, so the card's
  // own anchor is unambiguous as a slug.
  for (const project of researchSection.projects) {
    if (!project.anchorId) continue;
    const pdf = project.links?.find((link) => isLocalPdf(link.url));
    if (!pdf) continue;
    routes.push({
      slug: project.anchorId,
      url: pdf.url,
      title: project.title,
      kind: researchPdfKind(pdf.url, project.subtitle),
    });
  }

  for (const paper of papersSection.papersCards) {
    if (!paper.anchorId) continue;
    routes.push(...publicationRoutes({ ...paper, id: paper.anchorId }));
  }

  for (const publication of STATIC_PUBLICATIONS) {
    routes.push(...publicationRoutes(publication));
  }

  // Aliases go last, and that is load-bearing rather than tidy. Dedup below is
  // first writer wins, so a nickname can never shadow a real slug, and
  // findPdfRouteByUrl returns the first match, so the reader's share button
  // keeps copying /pdf/geenns and /pdf/phd-thesis rather than an alias.
  routes.push(...PINNED);

  for (const { slug, of } of SHORT_NAMES) {
    const target = routes.find((route) => route.slug === of);
    // A name pointing at nothing is a typo in the list above. Skipped rather
    // than thrown: this module is imported by the page bundle, so throwing
    // here would take the whole site down over a dead nickname. A test fails
    // on it instead.
    if (!target) continue;
    routes.push({ ...target, slug, canonicalSlug: of });
  }

  // First writer wins. Research anchors are registered first so a card keeps
  // its slug if a publication ever reuses the same id.
  const seen = new Set<string>();
  return routes.filter((route) => {
    if (seen.has(route.slug)) return false;
    seen.add(route.slug);
    return true;
  });
}

export const PDF_ROUTES: PdfRoute[] = buildRoutes();

export function findPdfRoute(slug: string): PdfRoute | undefined {
  return PDF_ROUTES.find((route) => route.slug === slug);
}

/**
 * The route a locally hosted PDF is reachable at, for turning a URL already in
 * hand back into a shareable link.
 *
 * Several slugs can point at one file: a publication registers a bare id and a
 * suffixed alias for the same primary document. The bare slug is pushed first,
 * so the first match is the canonical one.
 */
export function findPdfRouteByUrl(url: string): PdfRoute | undefined {
  return PDF_ROUTES.find((route) => route.url === url);
}

/** Filename offered when the reader's download button is used. */
export function pdfDownloadName(route: PdfRoute): string {
  return route.url.split("/").pop() || "document.pdf";
}
