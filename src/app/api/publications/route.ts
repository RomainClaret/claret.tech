import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  fetchAllPublications,
  type Publication,
} from "@/lib/api/fetch-publications";
import { logError } from "@/lib/utils/dev-logger";
import { withRateLimit } from "@/lib/utils/rate-limiter";

const CACHE_FILE = path.join(process.cwd(), "public", "publications.json");
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedData {
  lastUpdated: string;
  count: number;
  totalCitations: number;
  publications: Publication[];
}

async function getCachedPublications(): Promise<CachedData | null> {
  try {
    const data = await fs.readFile(CACHE_FILE, "utf-8");
    const cached: CachedData = JSON.parse(data);

    // Check if cache is still valid
    const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
    if (cacheAge < CACHE_DURATION_MS) {
      return cached;
    }
  } catch {
    // Cache doesn't exist or is invalid
  }

  return null;
}

async function updateCache(): Promise<CachedData> {
  const config = {
    semanticScholarId: process.env.SEMANTIC_SCHOLAR_AUTHOR_ID,
    orcidId: process.env.ORCID_ID,
    authorName: process.env.AUTHOR_NAME || "Romain Claret",
  };

  const publications = await fetchAllPublications(config);

  const data: CachedData = {
    lastUpdated: new Date().toISOString(),
    count: publications.length,
    totalCitations: publications.reduce(
      (sum, pub) => sum + (pub.citations || 0),
      0,
    ),
    publications,
  };

  // Save to cache
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    logError(error, "Failed to write cache");
  }

  return data;
}

async function getHandler(request: NextRequest) {
  try {
    // Check if we want to force refresh
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    let data: CachedData | null = null;

    if (!forceRefresh) {
      // Try to get cached data first
      data = await getCachedPublications();
    }

    // If no cache or force refresh, fetch new data
    if (!data) {
      try {
        data = await updateCache();
      } catch (error) {
        logError(error, "Failed to fetch publications");

        // Try to return stale cache if available
        try {
          const staleData = await fs.readFile(CACHE_FILE, "utf-8");
          data = JSON.parse(staleData);
        } catch {
          // Return empty data as last resort
          data = {
            lastUpdated: new Date().toISOString(),
            count: 0,
            totalCitations: 0,
            publications: [],
          };
        }
      }
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    logError(error, "Publications API error");
    return NextResponse.json(
      { error: "Failed to fetch publications" },
      { status: 500 },
    );
  }
}

async function postHandler(request: NextRequest) {
  try {
    const { publications } = await request.json();
    const { exportToBibTeX } = await import("@/lib/api/fetch-publications");

    const bibtex = exportToBibTeX(publications);

    return new NextResponse(bibtex, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": "attachment; filename=publications.bib",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to export BibTeX" },
      { status: 500 },
    );
  }
}

// For backwards compatibility with tests
export async function GET(request: NextRequest) {
  return withRateLimit(getHandler)(request);
}

export async function POST(request: NextRequest) {
  return withRateLimit(postHandler)(request);
}
