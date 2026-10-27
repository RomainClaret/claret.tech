import { NextRequest, NextResponse } from "next/server";
import { fetchGitHubData } from "@/lib/api/fetch-external-data";
import { withRateLimit } from "@/lib/utils/rate-limiter";
import { singleFlight } from "@/lib/utils/single-flight";

// Simple in-memory cache
let cache: {
  data: unknown;
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// One GitHub load at a time, and a minute's pause after one fails.
const githubLoad = singleFlight<Awaited<ReturnType<typeof fetchGitHubData>>>(
  60 * 1000,
);

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

    if (githubLoad.recentlyFailed()) {
      return NextResponse.json(
        { success: false, error: "GitHub request failed" },
        { status: 503 },
      );
    }

    const data = await githubLoad.run(() => fetchGitHubData(config));

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
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    // A fixed answer, as /api/fetch-all-repos: undici puts a header's value
    // in its validation error, which would carry a malformed token. The
    // message is logged, redacted, where it is thrown (fetch-external-data).
    return NextResponse.json(
      { success: false, error: "GitHub request failed" },
      { status: 500 },
    );
  }
}

// For backwards compatibility with tests
export async function GET(request: NextRequest) {
  return withRateLimit(handler)(request);
}
