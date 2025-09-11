import { NextRequest, NextResponse } from "next/server";
import { devError, logWarning } from "@/lib/utils/dev-logger";
import { withRateLimit } from "@/lib/utils/rate-limiter";

// Cache the result for 5 minutes to avoid hitting rate limits
let cachedData: { date: string; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

async function handler(_request: NextRequest) {
  try {
    // Check if we have cached data that's still valid
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return NextResponse.json(
        { lastCommitDate: cachedData.date },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        },
      );
    }

    // GitHub API endpoint for the repository
    const owner = "RomainClaret";
    const repo = "claret.tech";
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`;

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "claret.tech-portfolio",
        // Add GitHub token if available for higher rate limits
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 404) {
        devError("Repository not found or private:", `${owner}/${repo}`);
        // Repository is likely private or doesn't exist - use fallback
        const fallbackDate = "1942-05-01"; // May 1942
        cachedData = { date: fallbackDate, timestamp: Date.now() };
        return NextResponse.json(
          {
            lastCommitDate: fallbackDate,
            warning: "Repository is private or not found",
            fallback: true,
          },
          {
            headers: {
              "Cache-Control":
                "public, s-maxage=300, stale-while-revalidate=600",
            },
          },
        );
      }
      if (response.status === 409) {
        logWarning(
          "GitHub API returned 409 - repository may be empty or have no commits yet. Using fallback date.",
          "GitHub API",
        );
        // Don't throw error for 409, just use fallback
        const fallbackDate = "2022-12-15";
        return NextResponse.json(
          {
            lastCommitDate: fallbackDate,
            warning: "Repository has no commits yet",
            fallback: true,
          },
          {
            headers: {
              "Cache-Control":
                "public, s-maxage=300, stale-while-revalidate=600",
            },
          },
        );
      }
      if (response.status === 403) {
        devError("GitHub API rate limit exceeded or forbidden");
        // Return fallback date instead of throwing error
        const fallbackDate = "2022-12-15";
        cachedData = { date: fallbackDate, timestamp: Date.now() };
        return NextResponse.json(
          {
            lastCommitDate: fallbackDate,
            warning: "GitHub API rate limit exceeded",
            fallback: true,
          },
          {
            headers: {
              "Cache-Control":
                "public, s-maxage=300, stale-while-revalidate=600",
            },
          },
        );
      }
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error("No commits found");
    }

    // Get the date from the latest commit
    const lastCommitDate = data[0].commit.author.date;
    const formattedDate = new Date(lastCommitDate).toISOString().split("T")[0]; // YYYY-MM-DD format

    // Update cache
    cachedData = {
      date: formattedDate,
      timestamp: Date.now(),
    };

    return NextResponse.json(
      { lastCommitDate: formattedDate },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    devError("Error fetching last commit date:", error);

    // Use the fallback date from metadata
    const fallbackDate = "2022-12-15";

    // Return a fallback date if the API fails
    return NextResponse.json(
      {
        lastCommitDate: fallbackDate,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch commit date",
        fallback: true,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  }
}

// For backwards compatibility with tests
export async function GET(request: NextRequest) {
  return withRateLimit(handler)(request);
}
