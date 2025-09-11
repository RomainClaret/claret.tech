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
  NextRequest: vi.fn().mockImplementation((url) => ({
    url: url || "http://localhost",
    method: "GET",
  })),
}));

// Set up global fetch mock
global.fetch = mocks.fetch;

// Dynamic import to avoid cache issues
let GET: typeof import("./route").GET;

const mockFetch = mocks.fetch as Mock;
// const mockNextResponse = NextResponse as any; // Unused - mock is defined in vi.mock

describe("Last Commit API Route", () => {
  const mockCommitData = [
    {
      sha: "abc123def456",
      commit: {
        author: {
          name: "Test Author",
          email: "test@example.com",
          date: "2024-08-18T15:30:00Z",
        },
        message: "feat: add new feature",
      },
      author: {
        login: "testuser",
        id: 123456,
      },
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-08-18T16:00:00.000Z"));

    // Mock environment variables
    process.env.GITHUB_TOKEN = "test-token";

    // Reset modules to ensure fresh import with mocks
    vi.resetModules();

    // Dynamic import after mocks are set up
    const routeModule = await import("./route");
    GET = routeModule.GET;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.GITHUB_TOKEN;
  });

  describe("GET /api/last-commit", () => {
    it("fetches and returns last commit date successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommitData),
      });

      const response = await GET(new NextRequest("http://localhost"));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/RomainClaret/claret.tech/commits?per_page=1",
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "claret.tech-portfolio",
            Authorization: "Bearer test-token",
          },
          next: { revalidate: 300 },
        },
      );

      const result = await response.json();
      expect(result.lastCommitDate).toBe("2024-08-18"); // ISO date format YYYY-MM-DD
    });

    it("works without GitHub token", async () => {
      delete process.env.GITHUB_TOKEN;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommitData),
      });

      const response = await GET(new NextRequest("http://localhost"));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/RomainClaret/claret.tech/commits?per_page=1",
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "claret.tech-portfolio",
          },
          next: { revalidate: 300 },
        },
      );

      const result = await response.json();
      expect(result.lastCommitDate).toBe("2024-08-18");
    });

    it("returns cached data when cache is valid", async () => {
      // First request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommitData),
      });

      await GET(new NextRequest("http://localhost"));

      // Second request within cache period (5 minutes)
      vi.setSystemTime(new Date("2024-08-18T16:04:00.000Z")); // 4 minutes later
      mockFetch.mockClear();

      const response = await GET(new NextRequest("http://localhost"));

      expect(mockFetch).not.toHaveBeenCalled();
      const result = await response.json();
      expect(result.lastCommitDate).toBe("2024-08-18");
    });

    it("fetches new data when cache expires", async () => {
      // First request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommitData),
      });

      await GET(new NextRequest("http://localhost"));

      // Second request after cache expires (5 minutes)
      vi.setSystemTime(new Date("2024-08-18T16:06:00.000Z")); // 6 minutes later
      mockFetch.mockClear();

      const newerCommitData = [
        {
          ...mockCommitData[0],
          commit: {
            ...mockCommitData[0].commit,
            author: {
              ...mockCommitData[0].commit.author,
              date: "2024-08-18T17:00:00Z",
            },
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newerCommitData),
      });

      const response = await GET(new NextRequest("http://localhost"));

      expect(mockFetch).toHaveBeenCalled();
      const result = await response.json();
      expect(result.lastCommitDate).toBe("2024-08-18");
    });

    it("handles 404 repository not found error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.lastCommitDate).toBe("1942-05-01"); // Fallback date - May 1942
      expect(result.warning).toBe("Repository is private or not found");
      expect(result.fallback).toBe(true);
    });

    it("handles 409 empty repository gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
      });

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.lastCommitDate).toBe("2022-12-15"); // Fallback date
      expect(result.warning).toBe("Repository has no commits yet");
      expect(result.fallback).toBe(true);
    });

    it("handles 403 rate limit exceeded error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.lastCommitDate).toBe("2022-12-15"); // Fallback date
      expect(result.warning).toBe("GitHub API rate limit exceeded");
      expect(result.fallback).toBe(true);
    });

    it("handles other HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.lastCommitDate).toBe("2022-12-15"); // Fallback date
      expect(result.error).toBe("GitHub API responded with 500");
      expect(result.fallback).toBe(true);
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network connection failed"));

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.lastCommitDate).toBe("2022-12-15"); // Fallback date
      expect(result.error).toBe("Network connection failed");
      expect(result.fallback).toBe(true);
    });

    it("handles empty commits array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]), // Empty array
      });

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.lastCommitDate).toBe("2022-12-15"); // Fallback date
      expect(result.error).toBe("No commits found");
      expect(result.fallback).toBe(true);
    });

    it("handles null response data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null),
      });

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.lastCommitDate).toBe("2022-12-15"); // Fallback date
      expect(result.error).toBe("No commits found");
      expect(result.fallback).toBe(true);
    });

    it("formats date correctly to YYYY-MM-DD", async () => {
      const testCommitData = [
        {
          ...mockCommitData[0],
          commit: {
            ...mockCommitData[0].commit,
            author: {
              ...mockCommitData[0].commit.author,
              date: "2024-08-18T23:59:59.999Z", // Late in the day
            },
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testCommitData),
      });

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.lastCommitDate).toBe("2024-08-18");
      expect(result.lastCommitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("includes GitHub token in headers when available", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommitData),
      });

      await GET(new NextRequest("http://localhost"));

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBe("Bearer test-token");
    });

    it("omits Authorization header when token is not available", async () => {
      delete process.env.GITHUB_TOKEN;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommitData),
      });

      await GET(new NextRequest("http://localhost"));

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });

    it("sets correct cache revalidation time", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommitData),
      });

      await GET(new NextRequest("http://localhost"));

      const [, options] = mockFetch.mock.calls[0];
      expect(options.next.revalidate).toBe(300); // 5 minutes
    });

    it("updates cache after successful fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommitData),
      });

      // First request
      await GET(new NextRequest("http://localhost"));

      // Advance time but within cache period
      vi.setSystemTime(new Date("2024-08-18T16:03:00.000Z"));
      mockFetch.mockClear();

      // Second request should use cache
      const response = await GET(new NextRequest("http://localhost"));

      expect(mockFetch).not.toHaveBeenCalled();
      const result = (
        response as unknown as { json: () => Record<string, unknown> }
      ).json();
      expect(result.lastCommitDate).toBe("2024-08-18");
    });

    it("handles JSON parsing errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.lastCommitDate).toBe("2022-12-15");
      expect(result.fallback).toBe(true);
    });

    it("uses correct repository owner and name", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommitData),
      });

      await GET(new NextRequest("http://localhost"));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/RomainClaret/claret.tech/commits?per_page=1",
        expect.any(Object),
      );
    });
  });
});
