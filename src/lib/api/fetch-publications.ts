// Free academic publication fetching from multiple sources
// No API keys required for basic usage

import { logError } from "@/lib/utils/dev-logger";
import authorNameFixes from "./author-name-fixes.json";
import staticPublications from "./static-publications.json";

// Configurable map of abbreviated author names (as returned by academic APIs)
// to canonical full names. Shared with scripts/fetch-publications.js; edit
// src/lib/api/author-name-fixes.json to extend.
const AUTHOR_NAME_FIXES: Record<string, string> = authorNameFixes;

// Static publications that may not be available through APIs
// Exported for the /pdf/<slug> registry, which builds its routes from the
// curated entries; API-fetched publications have no locally hosted file.
/**
 * The hand-curated publications, kept as data rather than code so the fetch
 * script can read the same file instead of carrying its own copy. That copy
 * had already drifted: it was missing bibtex and shortDescription on every
 * entry, and public/publications.json is a third copy on top of that.
 *
 * Same arrangement as author-name-fixes.json above, and for the same reason.
 */
export const STATIC_PUBLICATIONS = staticPublications as Publication[];

export interface Publication {
  id: string;
  title: string;
  authors: string[];
  year: string;
  month?: number; // 1-12; orders within a year (newest first); not displayed
  starred?: boolean; // manually featured; sorts first with a star
  venue?: string;
  citations?: number;
  abstract?: string;
  shortDescription?: string; // Optional: Shows in collapsed state, expands to full abstract
  status?: "to-appear" | "presented" | "preprint"; // Optional: explicit status badge (defaults to Published)
  doi?: string;
  arxivId?: string;
  pdfUrl?: string;
  paperPdf?: string; // local /pdfs/ paper PDF (renders a Read Paper chip)
  posterPdf?: string; // local /pdfs/ poster PDF (renders a Read Poster chip)
  presentationPdf?: string; // local /pdfs/ slides PDF (renders a Read Presentation chip)
  videoUrl?: string; // video presentation link, e.g. YouTube (renders a Watch Video button)
  bibtex?: string; // verbatim curated BibTeX entry (copied by the BibTeX button)
  openAccessUrl?: string;
  semanticScholarUrl?: string;
  paperUrl?: string;
  codeUrl?: string; // link to the paper's code repository
  googleScholarCitationId?: string;
  source: "semantic-scholar" | "orcid" | "crossref" | "static";
}

/**
 * Ordering for the publication list: manually starred papers first, then newest
 * by year and month, then by citation count. Shared by the server-side rebuild
 * and the client render so the displayed order is consistent.
 */
export function comparePublications(a: Publication, b: Publication): number {
  const starDiff = (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
  if (starDiff !== 0) return starDiff;
  const yearDiff = parseInt(b.year) - parseInt(a.year);
  if (yearDiff !== 0) return yearDiff;
  const monthDiff = (b.month || 0) - (a.month || 0);
  if (monthDiff !== 0) return monthDiff;
  return (b.citations || 0) - (a.citations || 0);
}

interface SemanticScholarAuthor {
  authorId: string;
  name: string;
}

interface CrossrefAuthor {
  given: string;
  family: string;
}

interface CrossrefLink {
  "content-type": string;
  URL: string;
}

interface SemanticScholarPaper {
  paperId: string;
  title: string;
  authors: SemanticScholarAuthor[];
  year: number;
  venue?: string;
  citationCount: number;
  abstract?: string;
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    MAG?: string;
    PubMed?: string;
  };
  openAccessPdf?: { url: string };
  url: string;
}

interface OrcidWork {
  "work-summary": Array<{
    "put-code": number;
    title: { title: { value: string } };
    "publication-date"?: {
      year?: { value: string };
    };
    "external-ids"?: {
      "external-id"?: Array<{
        "external-id-type": string;
        "external-id-value": string;
      }>;
    };
  }>;
}

// Rate limiting helper
async function rateLimitedFetch(
  url: string,
  delayMs: number = 1000,
): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "claret.tech-portfolio/1.0 (https://claret.tech)",
    },
  });

  // Respect rate limits
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  return response;
}

/**
 * Fetch publications from Semantic Scholar
 * Free API, no key required, 100 requests per 5 minutes
 */
export async function fetchFromSemanticScholar(
  authorId: string,
): Promise<Publication[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/author/${authorId}/papers?fields=paperId,title,authors,year,venue,citationCount,abstract,externalIds,openAccessPdf,url&limit=100`;

    const response = await rateLimitedFetch(url, 3000); // 20 requests per minute max

    if (!response.ok) {
      logError(
        new Error(`Semantic Scholar API error: ${response.status}`),
        "Semantic Scholar API",
      );
      return [];
    }

    const data = await response.json();
    const papers: SemanticScholarPaper[] = data.data || data.papers || [];

    return papers.map((paper) => {
      const doi = paper.externalIds?.DOI;
      // Per-paper curation (descriptions, links, code repos) lives in
      // STATIC_PUBLICATIONS; manually curated papers are deduped by title, so
      // their fetched copies are dropped.
      return {
        id: paper.paperId,
        title: paper.title,
        authors: paper.authors.map((a) => a.name),
        year: paper.year?.toString() || "Unknown",
        venue: paper.venue,
        citations: paper.citationCount,
        abstract: paper.abstract,
        doi: doi,
        arxivId: paper.externalIds?.ArXiv,
        pdfUrl: paper.openAccessPdf?.url,
        // Curated field (manually set per-paper in publications.json), not derived
        // from the API; default empty so existing curated values are preserved.
        openAccessUrl: "",
        semanticScholarUrl: paper.url,
        source: "semantic-scholar" as const,
      };
    });
  } catch (error) {
    logError(error, "Error fetching from Semantic Scholar");
    return [];
  }
}

/**
 * Fetch publications from ORCID
 * Free API, no key required for public data
 */
export async function fetchFromORCID(orcidId: string): Promise<Publication[]> {
  try {
    const url = `https://pub.orcid.org/v3.0/${orcidId}/works`;

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      logError(new Error(`ORCID API error: ${response.status}`), "ORCID API");
      return [];
    }

    const data = await response.json();
    const works: OrcidWork = data;
    const publications: Publication[] = [];

    // ORCID only gives summaries, we'd need to fetch each work individually
    // For now, we'll just extract basic info
    for (const workGroup of works["work-summary"] || []) {
      const work = workGroup;
      const doi = work["external-ids"]?.["external-id"]?.find(
        (id) => id["external-id-type"] === "doi",
      );

      publications.push({
        id: `orcid-${work["put-code"]}`,
        title: work.title?.title?.value || "Unknown Title",
        authors: [], // ORCID doesn't provide authors in summary
        year: work["publication-date"]?.year?.value || "Unknown",
        doi: doi?.["external-id-value"],
        source: "orcid" as const,
      });
    }

    return publications;
  } catch (error) {
    logError(error, "Error fetching from ORCID");
    return [];
  }
}

/**
 * Enrich publication data using Crossref
 * Free API, no key required
 */
export async function enrichWithCrossref(
  doi: string,
): Promise<Partial<Publication>> {
  try {
    const url = `https://api.crossref.org/works/${doi}`;

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    const work = data.message;

    return {
      title: work.title?.[0],
      authors:
        work.author?.map((a: CrossrefAuthor) => `${a.given} ${a.family}`) || [],
      year: work.published?.["date-parts"]?.[0]?.[0]?.toString(),
      venue: work["container-title"]?.[0],
      abstract: work.abstract,
      doi: work.DOI,
      pdfUrl: work.link?.find(
        (l: CrossrefLink) => l["content-type"] === "application/pdf",
      )?.URL,
    };
  } catch (error) {
    logError(error, "Error enriching with Crossref");
    return {};
  }
}

/**
 * Fetch all publications from multiple sources
 */
export async function fetchAllPublications(config: {
  semanticScholarId?: string;
  orcidId?: string;
  authorName?: string;
}): Promise<Publication[]> {
  const allPublications: Publication[] = [];
  const seenDOIs = new Set<string>();
  const seenTitles = new Set<string>();

  // Add static publications first
  for (const pub of STATIC_PUBLICATIONS) {
    allPublications.push(pub);
    seenTitles.add(pub.title.toLowerCase());
  }

  // Fetch from Semantic Scholar
  if (config.semanticScholarId) {
    const papers = await fetchFromSemanticScholar(config.semanticScholarId);
    for (const paper of papers) {
      // Skip if we already have this paper (by title)
      if (seenTitles.has(paper.title.toLowerCase())) {
        continue;
      }
      if (paper.doi) {
        seenDOIs.add(paper.doi);
      }
      seenTitles.add(paper.title.toLowerCase());
      allPublications.push(paper);
    }
  }

  // Fetch from ORCID
  if (config.orcidId) {
    const papers = await fetchFromORCID(config.orcidId);

    // Enrich ORCID papers with Crossref data and deduplicate
    for (const paper of papers) {
      if (paper.doi && !seenDOIs.has(paper.doi)) {
        const enriched = await enrichWithCrossref(paper.doi);
        Object.assign(paper, enriched);
        // Skip if we already have this paper by title
        if (paper.title && seenTitles.has(paper.title.toLowerCase())) {
          continue;
        }
        seenDOIs.add(paper.doi);
        if (paper.title) {
          seenTitles.add(paper.title.toLowerCase());
        }
        allPublications.push(paper);
      } else if (!paper.doi) {
        // No DOI, check by title
        if (paper.title && !seenTitles.has(paper.title.toLowerCase())) {
          seenTitles.add(paper.title.toLowerCase());
          allPublications.push(paper);
        }
      }
    }
  }

  // Normalize abbreviated author names (e.g. "K. Stoffel" -> "Kilian Stoffel")
  // using the shared config, so the live API matches the curated publications.
  for (const pub of allPublications) {
    pub.authors = pub.authors.map((name) => AUTHOR_NAME_FIXES[name] || name);
  }

  // Starred first, then newest by year and month, then citations.
  allPublications.sort(comparePublications);

  return allPublications;
}

/**
 * Export publications to BibTeX format
 */
/**
 * A single publication as a BibTeX entry, keyed by its id (the site's
 * BibTeX-style keys, e.g. claret2024tpe). Anything with a venue is a
 * conference paper here, so it becomes @inproceedings; venue-less entries
 * fall back to @misc.
 */
export function publicationToBibTeX(pub: Publication): string {
  const type = pub.venue ? "@inproceedings" : "@misc";
  const fields = [
    `  title = {${pub.title}}`,
    `  author = {${pub.authors.join(" and ")}}`,
  ];
  if (pub.venue) fields.push(`  booktitle = {${pub.venue}}`);
  fields.push(`  year = {${pub.year}}`);
  if (pub.doi) fields.push(`  doi = {${pub.doi}}`);
  return `${type}{${pub.id},\n${fields.join(",\n")},\n}`;
}

export function exportToBibTeX(publications: Publication[]): string {
  return publications
    .map((pub) => pub.bibtex ?? publicationToBibTeX(pub))
    .join("\n\n");
}
