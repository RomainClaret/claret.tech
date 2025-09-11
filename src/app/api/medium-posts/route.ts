import { NextRequest, NextResponse } from "next/server";
import {
  fetchMediumArticle,
  cleanMediumCache,
  getCachedColors,
} from "@/lib/utils/medium-scraper";
import { logError } from "@/lib/utils/dev-logger";
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
  enrichedColor?: string;
}

async function handler(request: NextRequest) {
  const mediumUsername =
    process.env.NEXT_PUBLIC_MEDIUM_USERNAME || "romainclaret";

  // Check if this is a test environment (playwright only, not unit tests)
  const url = new URL(request.url);
  const isTestMode =
    url.searchParams.get("playwright") === "true" ||
    (process.env.NODE_ENV === "test" && !process.env.VITEST) ||
    request.headers.get("user-agent")?.includes("Playwright");

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
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
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

    // Using rss2json.com to convert RSS to JSON
    const response = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@${mediumUsername}`,
      {
        // Cache for 1 hour
        next: { revalidate: 3600 },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Medium posts");
    }

    const data = await response.json();

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
