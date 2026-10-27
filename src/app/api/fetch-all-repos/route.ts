import { NextResponse, NextRequest } from "next/server";
import { logError } from "@/lib/utils/dev-logger";
import { withRateLimit } from "@/lib/utils/rate-limiter";
import { mayForceRefresh } from "@/lib/utils/refresh-key";
import { singleFlight } from "@/lib/utils/single-flight";

// Simple in-memory cache
let cache: {
  data: unknown;
  timestamp: number;
} | null = null;

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// One GitHub load at a time, and a minute's pause after one fails.
const repositoriesLoad = singleFlight<Repository[]>(60 * 1000);
const UNAVAILABLE = { success: false, error: "GitHub request failed" };

interface Repository {
  id: string;
  name: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: {
    name: string;
    color: string;
  } | null;
  languages: {
    edges: Array<{
      node: {
        name: string;
        color: string;
      };
      size: number;
    }>;
  };
  topics: {
    edges: Array<{
      node: {
        topic: {
          name: string;
        };
      };
    }>;
  };
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  isPrivate: boolean;
  isArchived: boolean;
  diskUsage: number;
  isFork: boolean;
  parent: {
    nameWithOwner: string;
  } | null;
}

async function fetchAllRepositories(
  username: string,
  token?: string,
  first = 100,
  after?: string,
): Promise<Repository[]> {
  const query = `
    query($username: String!, $first: Int!, $after: String) {
      user(login: $username) {
        repositories(
          first: $first
          after: $after
          orderBy: { field: UPDATED_AT, direction: DESC }
          ownerAffiliations: OWNER
          privacy: PUBLIC
          isFork: false
          isArchived: false
        ) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              name
              description
              url
              homepageUrl
              stargazerCount
              forkCount
              primaryLanguage {
                name
                color
              }
              languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
                edges {
                  node {
                    name
                    color
                  }
                  size
                }
              }
              topics: repositoryTopics(first: 10) {
                edges {
                  node {
                    topic {
                      name
                    }
                  }
                }
              }
              createdAt
              updatedAt
              pushedAt
              isPrivate
              isArchived
              diskUsage
              isFork
              parent {
                nameWithOwner
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      "User-Agent": "Node",
    },
    body: JSON.stringify({
      query,
      variables: { username, first, after },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  // Public repositories only, whatever the token can read: the answer is
  // public and cached. The query asks for them; a repository not marked
  // public is dropped anyway (security audit run 1, lead 7).
  const repositories = data.data.user.repositories.edges
    .map((edge: { node: Repository }) => edge.node)
    .filter((repository: Repository) => repository.isPrivate === false);

  // If there are more pages, fetch them recursively
  if (data.data.user.repositories.pageInfo.hasNextPage) {
    const nextRepos = await fetchAllRepositories(
      username,
      token,
      first,
      data.data.user.repositories.pageInfo.endCursor,
    );
    return [...repositories, ...nextRepos];
  }

  return repositories;
}

async function handler(request: NextRequest) {
  try {
    // As /api/fetch-github: with GitHub data off (CI's e2e builds, a local
    // server without the token), there is nothing to fetch. This route used
    // to answer 500 when GH_USERNAME was missing, a console error on every
    // page load there, and called GitHub anyway when it was set.
    if (process.env.USE_GITHUB_DATA !== "true") {
      return NextResponse.json({ success: true, data: [], cached: false });
    }

    // ?fresh alone is not enough. Every forced refresh costs one authenticated
    // GitHub GraphQL call per 100 repositories against the owner's token, and
    // it bypasses both this cache and the CDN, so an anonymous caller could
    // drain the quota by repeating the request.
    const forceFresh =
      request.nextUrl.searchParams.get("fresh") === "true" &&
      mayForceRefresh(request);

    // Check cache first
    if (!forceFresh && cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cache.data,
        cached: true,
      });
    }

    const username = process.env.GH_USERNAME;
    const token = process.env.GITHUB_TOKEN;

    if (!username) {
      return NextResponse.json(
        {
          success: false,
          error: "GitHub username not configured",
        },
        { status: 500 },
      );
    }

    // The keyed refresh is the owner's, and may try again at once.
    if (!forceFresh && repositoriesLoad.recentlyFailed()) {
      return NextResponse.json(UNAVAILABLE, { status: 503 });
    }

    const repositories = await repositoriesLoad.run(() =>
      fetchAllRepositories(username, token),
    );

    // Update cache
    cache = {
      data: repositories,
      timestamp: Date.now(),
    };

    return NextResponse.json(
      {
        success: true,
        data: repositories,
        cached: false,
        meta: {
          total: repositories.length,
          username,
        },
      },
      {
        // Stated here rather than inherited: the blanket /api rule in
        // next.config.mjs that used to supply this is gone, because it beat
        // every handler that tried to set its own. This route spends one
        // authenticated GitHub call per 100 repositories, so a cache miss is
        // expensive and worth an hour.
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    // A fixed answer: undici puts a header's value in its validation error,
    // so a token stored with a stray CR or NUL came back in the 500 body.
    // The log keeps the message, with anything token-shaped redacted.
    const message = error instanceof Error ? error.message : String(error);
    logError(
      new Error(
        message.replace(/\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, "$1…"),
      ),
      "Error fetching repositories",
    );
    return NextResponse.json(UNAVAILABLE, { status: 500 });
  }
}

export const GET = withRateLimit(handler);
