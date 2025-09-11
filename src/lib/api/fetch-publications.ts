// Free academic publication fetching from multiple sources
// No API keys required for basic usage

import { logError } from "@/lib/utils/dev-logger";

// Static publications that may not be available through APIs
const STATIC_PUBLICATIONS: Publication[] = [
  {
    id: "karmali2010perceptual",
    title:
      "Perceptual roll tilt thresholds demonstrate visual-vestibular fusion",
    authors: [
      "Faisal Karmali",
      "Koeun Lim",
      "Adil Adatia",
      "Romain Claret",
      "Keyvan Nicoucar",
      "Daniel M Merfeld",
    ],
    year: "2010",
    venue: "40th Annual meeting of Neuroscience, San Diego, CA, on November",
    citations: 2,
    abstract:
      "Prior studies show that visual motion perception is more precise than vestibular motion perception, but it is unclear whether this is universal or the result of specific experimental conditions. We compared visual and vestibular motion precision over a broad range of temporal frequencies by measuring thresholds for vestibular (subject motion in the dark), visual (visual scene motion) or visual-vestibular (subject motion in the light) stimuli.",
    shortDescription:
      "Investigating how the brain integrates visual and vestibular information for motion perception by comparing precision thresholds across sensory modalities.",
    pdfUrl:
      "/pdfs/poster_visual_vestibular_integration_in_sensory_recognition_thresholds_2010.pdf",
    openAccessUrl:
      "https://journals.physiology.org/doi/abs/10.1152/jn.00332.2013",
    paperUrl: "https://journals.physiology.org/doi/full/10.1152/jn.00332.2013",
    googleScholarCitationId: "4650031951635731568",
    source: "static" as const,
  },
];

export interface Publication {
  id: string;
  title: string;
  authors: string[];
  year: string;
  venue?: string;
  citations?: number;
  abstract?: string;
  shortDescription?: string; // Optional: Shows in collapsed state, expands to full abstract
  doi?: string;
  arxivId?: string;
  pdfUrl?: string;
  openAccessUrl?: string;
  semanticScholarUrl?: string;
  paperUrl?: string;
  googleScholarCitationId?: string;
  source: "semantic-scholar" | "orcid" | "crossref" | "static";
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
      let paperUrl: string | undefined;

      // Add specific paper URLs based on DOI
      if (doi === "10.1145/3638530.3664144") {
        paperUrl = "https://dl.acm.org/doi/10.1145/3638530.3664144";
      }

      // Add shortDescription for GECCO paper
      let shortDescription: string | undefined;
      if (paper.paperId === "a450d758796fdcc7b5964f751cfa6e796499a693") {
        shortDescription =
          "Achieved 29% MNIST accuracy with ES-HyperNEAT through systematic TPE optimization, beating previous 23.90% benchmark while proving transferability to Fashion-MNIST.";
      }

      return {
        id: paper.paperId,
        title: paper.title,
        authors: paper.authors.map((a) => a.name),
        year: paper.year?.toString() || "Unknown",
        venue: paper.venue,
        citations: paper.citationCount,
        abstract: paper.abstract,
        shortDescription: shortDescription,
        doi: doi,
        arxivId: paper.externalIds?.ArXiv,
        pdfUrl: paper.openAccessPdf?.url,
        openAccessUrl: paper.openAccessPdf?.url,
        semanticScholarUrl: paper.url,
        paperUrl: paperUrl,
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

  // Sort by year (newest first) and then by citations
  allPublications.sort((a, b) => {
    const yearDiff = parseInt(b.year) - parseInt(a.year);
    if (yearDiff !== 0) return yearDiff;
    return (b.citations || 0) - (a.citations || 0);
  });

  return allPublications;
}

/**
 * Export publications to BibTeX format
 */
export function exportToBibTeX(publications: Publication[]): string {
  return publications
    .map((pub) => {
      const type = pub.venue?.toLowerCase().includes("arxiv")
        ? "@misc"
        : "@article";
      const key =
        pub.title
          .split(" ")
          .slice(0, 2)
          .join("")
          .replace(/[^a-zA-Z0-9]/g, "") + pub.year;

      const fields = [
        `  title = {${pub.title}}`,
        `  author = {${pub.authors.join(" and ")}}`,
        `  year = {${pub.year}}`,
      ];

      if (pub.venue) fields.push(`  journal = {${pub.venue}}`);
      if (pub.doi) fields.push(`  doi = {${pub.doi}}`);
      if (pub.abstract) fields.push(`  abstract = {${pub.abstract}}`);
      if (pub.pdfUrl) fields.push(`  url = {${pub.pdfUrl}}`);

      return `${type}{${key},\n${fields.join(",\n")}\n}`;
    })
    .join("\n\n");
}
