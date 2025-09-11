import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { NextRequest } from "next/server";

// Use vi.hoisted to ensure mocks are set up before any imports
const mocks = vi.hoisted(() => {
  return {
    fetch: vi.fn(),
    NextResponse: {
      json: vi.fn((data, options) => ({
        json: () => data,
        status: options?.status || 200,
      })),
    },
  };
});

// Mock Next.js before any imports
vi.mock("next/server", () => ({
  NextResponse: mocks.NextResponse,
  NextRequest: vi.fn(),
}));

// Set up global fetch mock
global.fetch = mocks.fetch;

// Dynamic import for proper mocking
let GET: typeof import("./route").GET;

const mockFetch = mocks.fetch as Mock;
const mockNextResponse = mocks.NextResponse as { json: Mock };

describe("Fetch All Repositories API Route", () => {
  const mockRepository = {
    id: "repo1",
    name: "test-repo",
    description: "A test repository",
    url: "https://github.com/testuser/test-repo",
    homepageUrl: null,
    stargazerCount: 10,
    forkCount: 2,
    primaryLanguage: {
      name: "TypeScript",
      color: "#3178c6",
    },
    languages: {
      edges: [
        {
          node: { name: "TypeScript", color: "#3178c6" },
          size: 1000,
        },
        {
          node: { name: "JavaScript", color: "#f1e05a" },
          size: 500,
        },
      ],
    },
    topics: {
      edges: [
        {
          node: {
            topic: { name: "react" },
          },
        },
        {
          node: {
            topic: { name: "typescript" },
          },
        },
      ],
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-08-18T12:00:00Z",
    pushedAt: "2024-08-18T11:00:00Z",
    isPrivate: false,
    isArchived: false,
    diskUsage: 1024,
    isFork: false,
    parent: null,
  };

  const mockGraphQLResponse = {
    data: {
      user: {
        repositories: {
          totalCount: 1,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
          edges: [
            {
              node: mockRepository,
            },
          ],
        },
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-08-18T12:00:00.000Z"));

    // Mock environment variables
    process.env.GH_USERNAME = "testuser";
    process.env.GITHUB_TOKEN = "test-token";

    // Reset modules to ensure fresh import with mocks
    vi.resetModules();

    // Dynamic import after mocks are set up
    const routeModule = await import("./route");
    GET = routeModule.GET;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.GH_USERNAME;
    delete process.env.GITHUB_TOKEN;
  });

  describe("GET /api/fetch-all-repos", () => {
    it("fetches repositories successfully without cache", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGraphQLResponse),
      });

      const request = {
        nextUrl: {
          searchParams: { get: () => null, has: () => false },
        },
      } as unknown as NextRequest;

      const response = await GET(request);

      expect(mockFetch).toHaveBeenCalledWith("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
          "User-Agent": "Node",
        },
        body: expect.stringContaining("testuser"),
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockRepository]);
      expect(result.cached).toBe(false);
      expect(result.meta.total).toBe(1);
      expect(result.meta.username).toBe("testuser");
    });

    it("returns cached data when cache is valid", async () => {
      // First call to populate cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGraphQLResponse),
      });

      const request1 = {
        nextUrl: { searchParams: { get: () => null, has: () => false } },
      } as unknown as NextRequest;

      await GET(request1);

      // Second call should use cache (within 10 minutes)
      vi.setSystemTime(new Date("2024-08-18T12:09:00.000Z")); // 9 minutes later
      mockFetch.mockClear();

      const request2 = {
        nextUrl: { searchParams: { get: () => null, has: () => false } },
      } as unknown as NextRequest;

      const response = await GET(request2);

      expect(mockFetch).not.toHaveBeenCalled();

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockRepository]);
      expect(result.cached).toBe(true);
    });

    it("forces fresh data when fresh=true parameter", async () => {
      // Populate cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGraphQLResponse),
      });

      const request1 = {
        nextUrl: { searchParams: { get: () => null, has: () => false } },
      } as unknown as NextRequest;

      await GET(request1);

      // Request with fresh=true should bypass cache
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGraphQLResponse),
      });

      const request2 = {
        nextUrl: {
          searchParams: {
            get: (key: string) => (key === "fresh" ? "true" : null),
            has: (key: string) => key === "fresh",
          },
        },
      } as unknown as NextRequest;

      const response = await GET(request2);

      expect(mockFetch).toHaveBeenCalled();

      const result = await response.json();
      expect(result.cached).toBe(false);
    });

    it("handles pagination correctly", async () => {
      const firstPageResponse = {
        data: {
          user: {
            repositories: {
              totalCount: 2,
              pageInfo: {
                hasNextPage: true,
                endCursor: "cursor1",
              },
              edges: [{ node: mockRepository }],
            },
          },
        },
      };

      const secondRepository = {
        ...mockRepository,
        id: "repo2",
        name: "test-repo-2",
      };
      const secondPageResponse = {
        data: {
          user: {
            repositories: {
              totalCount: 2,
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              edges: [{ node: secondRepository }],
            },
          },
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(firstPageResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(secondPageResponse),
        });

      const request = {
        nextUrl: { searchParams: { get: () => null, has: () => false } },
      } as unknown as NextRequest;

      const response = await GET(request);

      expect(mockFetch).toHaveBeenCalledTimes(2);

      const result = await response.json();
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe("test-repo");
      expect(result.data[1].name).toBe("test-repo-2");
    });

    it("returns error when username is not configured", async () => {
      delete process.env.GH_USERNAME;

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({
          success: false,
          error: "GitHub username not configured",
        }),
        status: 500,
      });

      const request = {
        nextUrl: { searchParams: { get: () => null, has: () => false } },
      } as unknown as NextRequest;

      await GET(request);

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: "GitHub username not configured",
        },
        { status: 500 },
      );
    });

    it("handles GitHub API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({
          success: false,
          error: "GitHub API error: 403",
        }),
        status: 500,
      });

      const request = {
        nextUrl: { searchParams: { get: () => null, has: () => false } },
      } as unknown as NextRequest;

      await GET(request);

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: "GitHub API error: 403",
        },
        { status: 500 },
      );
    });

    it("handles GraphQL errors", async () => {
      const errorResponse = {
        errors: [
          {
            message: "API rate limit exceeded",
            type: "RATE_LIMITED",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(errorResponse),
      });

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({
          success: false,
          error:
            'GraphQL errors: [{"message":"API rate limit exceeded","type":"RATE_LIMITED"}]',
        }),
        status: 500,
      });

      const request = {
        nextUrl: { searchParams: { get: () => null, has: () => false } },
      } as unknown as NextRequest;

      await GET(request);

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: expect.stringContaining("GraphQL errors"),
        },
        { status: 500 },
      );
    });

    it("works without GitHub token", async () => {
      delete process.env.GITHUB_TOKEN;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGraphQLResponse),
      });

      const request = {
        nextUrl: { searchParams: { get: () => null, has: () => false } },
      } as unknown as NextRequest;

      const response = await GET(request);

      expect(mockFetch).toHaveBeenCalledWith("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "", // Empty when no token
          "User-Agent": "Node",
        },
        body: expect.any(String),
      });

      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it("handles network errors", async () => {
      const networkError = new Error("Network error");
      mockFetch.mockRejectedValueOnce(networkError);

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({
          success: false,
          error: "Network error",
        }),
        status: 500,
      });

      const request = {
        nextUrl: { searchParams: { get: () => null, has: () => false } },
      } as unknown as NextRequest;

      await GET(request);

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: "Network error",
        },
        { status: 500 },
      );
    });

    it("includes correct GraphQL query structure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGraphQLResponse),
      });

      const request = {
        nextUrl: { searchParams: { get: () => null, has: () => false } },
      } as unknown as NextRequest;

      await GET(request);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.query).toContain("user(login: $username)");
      expect(requestBody.query).toContain("repositories(");
      expect(requestBody.query).toContain("stargazerCount");
      expect(requestBody.query).toContain("primaryLanguage");
      expect(requestBody.query).toContain("topics: repositoryTopics");
      expect(requestBody.variables.username).toBe("testuser");
      expect(requestBody.variables.first).toBe(100);
    });
  });
});
