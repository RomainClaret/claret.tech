import { NextRequest, NextResponse } from "next/server";
import { fetchGitHubData } from "@/lib/api/fetch-external-data";
import { withRateLimit } from "@/lib/utils/rate-limiter";

// Simple in-memory cache
let cache: {
  data: unknown;
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function handler(_request: NextRequest) {
  try {
    // Check cache first
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(
        {
          success: true,
          data: cache.data,
          cached: true,
          config: {
            username: process.env.GH_USERNAME,
            useGithubData: process.env.USE_GITHUB_DATA,
            tokenSet: !!process.env.GITHUB_TOKEN,
          },
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        },
      );
    }

    const config = {
      githubToken: process.env.GITHUB_TOKEN,
      githubUsername: process.env.GH_USERNAME,
      useGithubData: process.env.USE_GITHUB_DATA,
    };

    // Pass true for skipFileWrite to avoid writing to filesystem in API route
    const data = await fetchGitHubData(config, true);

    // Update cache
    if (data) {
      cache = {
        data,
        timestamp: Date.now(),
      };
    }

    return NextResponse.json(
      {
        success: true,
        data,
        cached: false,
        config: {
          username: config.githubUsername,
          useGithubData: config.useGithubData,
          tokenSet: !!config.githubToken,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// For backwards compatibility with tests
export async function GET(request: NextRequest) {
  return withRateLimit(handler)(request);
}
