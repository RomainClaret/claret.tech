import { NextResponse, NextRequest } from "next/server";
import { logError } from "@/lib/utils/dev-logger";
import { withRateLimit } from "@/lib/utils/rate-limiter";

// Simple in-memory cache
let cache: {
  data: unknown;
  timestamp: number;
} | null = null;

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  const repositories = data.data.user.repositories.edges.map(
    (edge: { node: Repository }) => edge.node,
  );

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
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const forceFresh = searchParams.get("fresh") === "true";

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

    // Fetch all repositories
    const repositories = await fetchAllRepositories(username, token);

    // Update cache
    cache = {
      data: repositories,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      success: true,
      data: repositories,
      cached: false,
      meta: {
        total: repositories.length,
        username,
      },
    });
  } catch (error) {
    logError(error, "Error fetching repositories");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler);
