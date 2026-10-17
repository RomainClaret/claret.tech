import { NextRequest, NextResponse } from "next/server";
import {
  fetchMediumArticle,
  cleanMediumCache,
  getCachedColors,
} from "@/lib/utils/medium-scraper";
import { logError } from "@/lib/utils/dev-logger";
import { fetchMediumFeed } from "@/lib/utils/medium-feed";
import { mediumUsername } from "@/lib/utils/medium-username";
import { withRateLimit } from "@/lib/utils/rate-limiter";

interface MediumPost {
  title: string;
  link: string;
  thumbnail: string;
  content: string;
  pubDate: string;
  author: string;
  guid: string;
  categories: string[];
  enrichedImage?: string;
  // null when the article's page gave no colour (fetchMediumArticle)
  enrichedColor?: string | null;
}

async function handler(request: NextRequest) {
  const username = mediumUsername();

  // Check if this is a test environment (playwright only, not unit tests)
  const url = new URL(request.url);
  // Deliberately NOT keyed on User-Agent. It used to also match a UA containing
  // "Playwright", which made mock mode reachable on the bare URL: the response
  // is cacheable and nothing sets Vary, so the edge stored it under the same
  // key a real visitor uses. One request turned the public blog section and
  // /rss.xml into "Test Article 1" for everyone until the entry expired. The
  // query param is safe because it is part of the cache key.
  const isTestMode =
    url.searchParams.get("playwright") === "true" ||
    (process.env.NODE_ENV === "test" && !process.env.VITEST);

  // Return mock data in test environment to avoid API failures
  if (isTestMode) {
    return NextResponse.json(
      {
        status: "ok",
        feed: {
          title: "Medium - @romainclaret",
          description: "Stories from Test Environment",
          link: "https://medium.com/@romainclaret",
        },
        items: [
          {
            title: "Test Article 1",
            link: "https://medium.com/@romainclaret/test-article-1",
            thumbnail: "https://via.placeholder.com/400x200",
            content: "<p>This is a test article for automated testing.</p>",
            pubDate: new Date().toISOString(),
            author: "Romain Claret",
            guid: "test-1",
            categories: ["Testing", "Development"],
            enrichedImage: "https://via.placeholder.com/400x200",
            enrichedColor: "#007ACC",
          },
          {
            title: "Test Article 2",
            link: "https://medium.com/@romainclaret/test-article-2",
            thumbnail: "https://via.placeholder.com/400x200",
            content: "<p>Another test article for automated testing.</p>",
            pubDate: new Date(Date.now() - 86400000).toISOString(),
            author: "Romain Claret",
            guid: "test-2",
            categories: ["Testing", "Automation"],
            enrichedImage: "https://via.placeholder.com/400x200",
            enrichedColor: "#28A745",
          },
        ],
        cachedColors: {
          "#007ACC": "blue",
          "#28A745": "green",
        },
      },
      {
        headers: {
          // Never shared: mock output must not be able to occupy a cache entry
          // that a real visitor could be served from.
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  try {
    // Clean expired cache entries periodically (non-fatal if it fails)
    try {
      await cleanMediumCache();
    } catch (error) {
      logError(error, "Medium cache cleaning failed");
      // Continue processing even if cache cleaning fails
    }

    // Medium's RSS as JSON (rss2json), cached for an hour
    const data = await fetchMediumFeed<{
      items?: MediumPost[];
      cachedColors?: unknown;
    }>(username);

    // Enrich posts with scraped images and colors
    if (data.items && Array.isArray(data.items)) {
      const enrichedItems = await Promise.all(
        data.items.map(async (post: MediumPost) => {
          try {
            // Fetch better image and color from Medium article page
            const { image, color } = await fetchMediumArticle(post.link);

            return {
              ...post,
              enrichedImage: image || post.thumbnail,
              enrichedColor: color,
            };
          } catch (error) {
            logError(error, `Error enriching post ${post.link}`);
            return post;
          }
        }),
      );

      data.items = enrichedItems;
    }

    // Get all cached colors for client-side use (non-fatal if it fails)
    try {
      const cachedColors = await getCachedColors();
      data.cachedColors = cachedColors;
    } catch (error) {
      logError(error, "Failed to get cached colors");
      data.cachedColors = {}; // Provide empty colors object as fallback
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    logError(error, "Error fetching Medium posts");
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch Medium posts",
        items: [],
        cachedColors: {},
      },
      { status: 500 },
    );
  }
}

// For backwards compatibility with tests
export async function GET(request: NextRequest) {
  return withRateLimit(handler)(request);
}
