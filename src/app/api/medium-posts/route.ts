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
import { blogImagePath } from "@/lib/blog-images/sources";

// A backstop for the fetches' own 10 s timeouts (the feed, then each
// article page, then its image): Next drops a fetch's signal when it
// refreshes a stale cached response in the background.
export const maxDuration = 60;

interface MediumPost {
  title: string;
  link: string;
  /** The post's first image, when it has one. */
  thumbnail?: string;
  content: string;
  pubDate: string;
  author: string;
  guid: string;
  categories: string[];
  description?: string;
  /** The picture, through /api/blog-image: never a Medium URL to load. */
  image?: string | null;
  // null when the article's page gave no colour (fetchMediumArticle)
  enrichedColor?: string | null;
}

async function handler() {
  const username = mediumUsername();

  try {
    // Clean expired cache entries periodically (non-fatal if it fails)
    try {
      await cleanMediumCache();
    } catch (error) {
      logError(error, "Medium cache cleaning failed");
      // Continue processing even if cache cleaning fails
    }

    // Medium's own RSS feed, cached for an hour
    const data = await fetchMediumFeed<{
      items?: MediumPost[];
      cachedColors?: unknown;
    }>(username);

    // Each post's picture comes from the feed, through the site's own
    // route, which serves only what the feed names (src/lib/blog-images);
    // its color from the article page.
    if (data.items && Array.isArray(data.items)) {
      const enrichedItems = await Promise.all(
        data.items.map(async (post: MediumPost) => {
          const image = blogImagePath(post);
          try {
            const { color } = await fetchMediumArticle(post.link);
            return { ...post, image, enrichedColor: color };
          } catch (error) {
            logError(error, `Error enriching post ${post.link}`);
            return { ...post, image };
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
    // No posts, said with a 200: the blog shows the Kudos story alone, and
    // a 500 put "Failed to load resource" in every visitor's console while
    // the feed was away (rss2json's Cloudflare challenge, 2026-10). Cached
    // five minutes, so the posts come back soon after the feed does.
    logError(error, "Error fetching Medium posts");
    return NextResponse.json(
      { status: "unavailable", items: [], cachedColors: {} },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
        },
      },
    );
  }
}

// For backwards compatibility with tests
export async function GET(request: NextRequest) {
  return withRateLimit(handler)(request);
}
