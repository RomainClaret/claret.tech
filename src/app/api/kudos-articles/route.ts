import { NextRequest, NextResponse } from "next/server";
import {
  kudosArticles,
  formatKudosArticleForBlog,
} from "@/data/sections/kudos-articles";
import { fetchKudosImage, cleanCache } from "@/lib/utils/kudos-scraper";
import { devError } from "@/lib/utils/dev-logger";
import { withRateLimit } from "@/lib/utils/rate-limiter";

async function handler(_request: NextRequest) {
  try {
    // Clean expired cache entries periodically (non-fatal if it fails)
    try {
      await cleanCache();
    } catch (error) {
      devError("Cache cleaning failed:", error);
      // Continue processing even if cache cleaning fails
    }

    // Format articles for blog display
    const formattedArticles = kudosArticles.map(formatKudosArticleForBlog);

    // Enrich articles with dynamically fetched images
    const enrichedArticles = await Promise.all(
      formattedArticles.map(async (article) => {
        try {
          // Fetch image from Kudos if we don't have a static one
          if (!article.image || article.image.startsWith("/images/")) {
            const dynamicImage = await fetchKudosImage(article.url);
            if (dynamicImage) {
              return {
                ...article,
                image: dynamicImage,
              };
            }
          }
        } catch (error) {
          devError(`Error fetching image for ${article.url}:`, error);
        }
        return article;
      }),
    );

    return NextResponse.json({
      status: "success",
      articles: enrichedArticles,
      count: enrichedArticles.length,
    });
  } catch (error) {
    devError("Error fetching Kudos articles:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch Kudos articles",
        articles: [],
      },
      { status: 500 },
    );
  }
}

// For backwards compatibility with tests
export async function GET(request: NextRequest) {
  return withRateLimit(handler)(request);
}
