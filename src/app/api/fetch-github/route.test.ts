import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { NextRequest } from "next/server";

// Use vi.hoisted to ensure mocks are set up before any imports
const mocks = vi.hoisted(() => {
  return {
    NextResponse: {
      json: vi.fn((data, options) => ({
        json: () => data,
        status: options?.status || 200,
      })),
    },
    fetchGitHubData: vi.fn(),
  };
});

// Mock Next.js before any imports
vi.mock("next/server", () => ({
  NextResponse: mocks.NextResponse,
  NextRequest: vi.fn().mockImplementation((url) => ({
    url: url || "http://localhost",
    method: "GET",
  })),
}));

// Mock external data fetcher
vi.mock("@/lib/api/fetch-external-data", () => ({
  fetchGitHubData: mocks.fetchGitHubData,
}));

// Dynamic import for proper mocking
let GET: typeof import("./route").GET;

const mockFetchGitHubData = mocks.fetchGitHubData as Mock;
const mockNextResponse = mocks.NextResponse as { json: Mock };

describe("GitHub API Route", () => {
  const mockGitHubData = {
    user: {
      login: "testuser",
      name: "Test User",
      bio: "Test bio",
      publicRepos: 10,
      followers: 100,
    },
    repositories: [
      {
        id: "1",
        name: "test-repo",
        description: "Test repository",
        stars: 5,
        language: "TypeScript",
      },
    ],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Reset timer state first
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-08-18T12:00:00.000Z"));

    // Mock environment variables
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GH_USERNAME = "testuser";
    process.env.USE_GITHUB_DATA = "true";

    // Reset modules to ensure fresh import with mocks
    vi.resetModules();

    // Dynamic import after mocks are set up
    const routeModule = await import("./route");
    GET = routeModule.GET;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_USERNAME;
    delete process.env.USE_GITHUB_DATA;
  });

  describe("GET /api/fetch-github", () => {
    it("returns fresh data when cache is empty", async () => {
      mockFetchGitHubData.mockResolvedValueOnce(mockGitHubData);

      const response = await GET(new NextRequest("http://localhost"));

      expect(mockFetchGitHubData).toHaveBeenCalledWith(
        {
          githubToken: "test-token",
          githubUsername: "testuser",
          useGithubData: "true",
        },
        true, // skipFileWrite
      );

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockGitHubData);
      expect(result.cached).toBe(false);
      expect(result.config.username).toBe("testuser");
      expect(result.config.tokenSet).toBe(true);
    });

    it("returns cached data when cache is valid", async () => {
      // First call to populate cache
      mockFetchGitHubData.mockResolvedValueOnce(mockGitHubData);
      await GET(new NextRequest("http://localhost"));

      // Second call should use cache (within 5 minutes)
      vi.setSystemTime(new Date("2024-08-18T12:04:00.000Z")); // 4 minutes later
      mockFetchGitHubData.mockClear();

      const response = await GET(new NextRequest("http://localhost"));

      expect(mockFetchGitHubData).not.toHaveBeenCalled();

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockGitHubData);
      expect(result.cached).toBe(true);
    });

    it("refreshes cache when TTL expires", async () => {
      // First call to populate cache
      mockFetchGitHubData.mockResolvedValueOnce(mockGitHubData);
      await GET(new NextRequest("http://localhost"));

      // Move time forward beyond cache TTL (5 minutes)
      vi.setSystemTime(new Date("2024-08-18T12:06:00.000Z")); // 6 minutes later
      mockFetchGitHubData.mockClear();

      const updatedData = {
        ...mockGitHubData,
        user: { ...mockGitHubData.user, name: "Updated User" },
      };
      mockFetchGitHubData.mockResolvedValueOnce(updatedData);

      const response = await GET(new NextRequest("http://localhost"));

      expect(mockFetchGitHubData).toHaveBeenCalled();

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedData);
      expect(result.cached).toBe(false);
    });

    it("handles fetch errors gracefully", async () => {
      const errorMessage = "GitHub API rate limit exceeded";
      mockFetchGitHubData.mockRejectedValueOnce(new Error(errorMessage));

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({
          success: false,
          error: errorMessage,
        }),
        status: 500,
      });

      await GET(new NextRequest("http://localhost"));

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 },
      );
    });

    it("handles non-Error exceptions", async () => {
      mockFetchGitHubData.mockRejectedValueOnce("String error");

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({
          success: false,
          error: "Unknown error",
        }),
        status: 500,
      });

      await GET(new NextRequest("http://localhost"));

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: "Unknown error",
        },
        { status: 500 },
      );
    });

    it("does not update cache when fetch returns null/falsy data", async () => {
      mockFetchGitHubData.mockResolvedValueOnce(null);

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
      expect(result.cached).toBe(false);

      // Verify cache wasn't updated by making another call immediately
      mockFetchGitHubData.mockClear();
      await GET(new NextRequest("http://localhost"));
      expect(mockFetchGitHubData).toHaveBeenCalled(); // Should fetch again since cache is empty
    });

    it("includes correct config information in response", async () => {
      mockFetchGitHubData.mockResolvedValueOnce(mockGitHubData);

      const response = await GET(new NextRequest("http://localhost"));
      const result = await response.json();

      expect(result.config).toEqual({
        username: "testuser",
        useGithubData: "true",
        tokenSet: true,
      });
    });

    it("handles missing environment variables", async () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_USERNAME;

      mockFetchGitHubData.mockResolvedValueOnce(mockGitHubData);

      const response = await GET(new NextRequest("http://localhost"));
      const result = await response.json();

      expect(result.config).toEqual({
        username: undefined,
        useGithubData: "true",
        tokenSet: false,
      });

      expect(mockFetchGitHubData).toHaveBeenCalledWith(
        {
          githubToken: undefined,
          githubUsername: undefined,
          useGithubData: "true",
        },
        true,
      );
    });

    it("passes skipFileWrite parameter correctly", async () => {
      mockFetchGitHubData.mockResolvedValueOnce(mockGitHubData);

      await GET(new NextRequest("http://localhost"));

      expect(mockFetchGitHubData).toHaveBeenCalledWith(
        expect.any(Object),
        true, // skipFileWrite should be true for API routes
      );
    });
  });
});
