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
    fetchMediumArticle: vi.fn(),
    cleanMediumCache: vi.fn(),
    getCachedColors: vi.fn(),
  };
});

// Mock Next.js before any imports
vi.mock("next/server", () => ({
  NextResponse: mocks.NextResponse,
  NextRequest: class MockNextRequest {
    url: string;
    method: string;
    headers: {
      get: (key: string) => string | null;
    };

    constructor(url?: string) {
      this.url = url || "http://localhost:3000/api/medium-posts";
      this.method = "GET";
      this.headers = {
        get: vi.fn().mockReturnValue(null),
      };
    }
  },
}));

// Mock medium scraper
vi.mock("@/lib/utils/medium-scraper", () => ({
  fetchMediumArticle: mocks.fetchMediumArticle,
  cleanMediumCache: mocks.cleanMediumCache,
  getCachedColors: mocks.getCachedColors,
}));

// Set up global fetch mock
global.fetch = mocks.fetch;

// Dynamic import for proper mocking
let GET: typeof import("./route").GET;

const mockFetchMediumArticle = mocks.fetchMediumArticle as Mock;
const mockCleanMediumCache = mocks.cleanMediumCache as Mock;
const mockGetCachedColors = mocks.getCachedColors as Mock;
const mockFetch = mocks.fetch as Mock;
const mockNextResponse = mocks.NextResponse as { json: Mock };

describe("Medium Posts API Route", () => {
  const mockMediumPost = {
    title: "Test Medium Post",
    link: "https://medium.com/@testuser/test-post",
    thumbnail: "https://medium.com/thumbnail.jpg",
    content: "<p>Test content</p>",
    pubDate: "2024-08-18T12:00:00.000Z",
    author: "Test Author",
    guid: "post-guid-123",
    categories: ["programming", "testing"],
  };

  const mockRss2JsonResponse = {
    status: "ok",
    feed: {
      title: "Test User - Medium",
      description: "Test user's Medium posts",
    },
    items: [mockMediumPost],
  };

  const mockEnrichedData = {
    image: "https://medium.com/better-image.jpg",
    color: "#3178c6",
  };

  const mockCachedColors = {
    "test-post": "#3178c6",
    "another-post": "#f1e05a",
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock environment variables
    process.env.NEXT_PUBLIC_MEDIUM_USERNAME = "testuser";

    // Reset modules to ensure fresh import with mocks
    vi.resetModules();

    // Dynamic import after mocks are set up
    const routeModule = await import("./route");
    GET = routeModule.GET;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_MEDIUM_USERNAME;
  });

  describe("GET /api/medium-posts", () => {
    it("fetches and enriches Medium posts successfully", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRss2JsonResponse),
      });
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);
      mockGetCachedColors.mockResolvedValueOnce(mockCachedColors);

      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      // Verify cache cleaning was called
      expect(mockCleanMediumCache).toHaveBeenCalled();

      // Verify RSS2JSON API was called with correct URL
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@testuser",
        {
          next: { revalidate: 3600 },
        },
      );

      // Verify article enrichment was called
      expect(mockFetchMediumArticle).toHaveBeenCalledWith(mockMediumPost.link);

      // Verify cached colors were retrieved
      expect(mockGetCachedColors).toHaveBeenCalled();

      const result = await response.json();
      expect(result.status).toBe("ok");
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        ...mockMediumPost,
        enrichedImage: mockEnrichedData.image,
        enrichedColor: mockEnrichedData.color,
      });
      expect(result.cachedColors).toEqual(mockCachedColors);
    });

    it("uses default Medium username when env variable is not set", async () => {
      delete process.env.NEXT_PUBLIC_MEDIUM_USERNAME;

      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRss2JsonResponse),
      });
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);
      mockGetCachedColors.mockResolvedValueOnce({});

      await GET(new NextRequest("http://localhost:3000/api/medium-posts"));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@romainclaret",
        expect.any(Object),
      );
    });

    it("handles RSS2JSON API errors gracefully", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({
          status: "error",
          message: "Failed to fetch Medium posts",
          items: [],
          cachedColors: {},
        }),
        status: 500,
      });

      await GET(new NextRequest("http://localhost:3000/api/medium-posts"));

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          status: "error",
          message: "Failed to fetch Medium posts",
          items: [],
          cachedColors: {},
        },
        { status: 500 },
      );
    });

    it("handles network errors gracefully", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({
          status: "error",
          message: "Failed to fetch Medium posts",
          items: [],
          cachedColors: {},
        }),
        status: 500,
      });

      await GET(new NextRequest("http://localhost:3000/api/medium-posts"));

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          status: "error",
          message: "Failed to fetch Medium posts",
          items: [],
          cachedColors: {},
        },
        { status: 500 },
      );
    });

    it("continues processing even when individual article enrichment fails", async () => {
      const multiplePosts = [
        mockMediumPost,
        {
          ...mockMediumPost,
          title: "Second Post",
          link: "https://medium.com/@testuser/second-post",
          guid: "post-guid-456",
        },
      ];

      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockRss2JsonResponse,
            items: multiplePosts,
          }),
      });

      // First article enrichment succeeds
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);
      // Second article enrichment fails
      mockFetchMediumArticle.mockRejectedValueOnce(
        new Error("Scraping failed"),
      );

      mockGetCachedColors.mockResolvedValueOnce(mockCachedColors);

      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      const result = await response.json();
      expect(result.items).toHaveLength(2);

      // First post should be enriched
      expect(result.items[0].enrichedImage).toBe(mockEnrichedData.image);
      expect(result.items[0].enrichedColor).toBe(mockEnrichedData.color);

      // Second post should remain unchanged (no enrichment)
      expect(result.items[1].enrichedImage).toBeUndefined();
      expect(result.items[1].enrichedColor).toBeUndefined();
    });

    it("uses original thumbnail when enrichment returns no image", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRss2JsonResponse),
      });

      // Enrichment returns color but no image
      mockFetchMediumArticle.mockResolvedValueOnce({
        image: null,
        color: "#3178c6",
      });

      mockGetCachedColors.mockResolvedValueOnce(mockCachedColors);

      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      const result = await response.json();
      expect(result.items[0].enrichedImage).toBe(mockMediumPost.thumbnail);
      expect(result.items[0].enrichedColor).toBe("#3178c6");
    });

    it("handles empty items array gracefully", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockRss2JsonResponse,
            items: [],
          }),
      });
      mockGetCachedColors.mockResolvedValueOnce(mockCachedColors);

      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      const result = await response.json();
      expect(result.items).toEqual([]);
      expect(result.cachedColors).toEqual(mockCachedColors);
    });

    it("handles malformed RSS2JSON response", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "ok",
            // Missing items array
          }),
      });
      mockGetCachedColors.mockResolvedValueOnce(mockCachedColors);

      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      const result = await response.json();
      expect(result.cachedColors).toEqual(mockCachedColors);
    });

    it("handles cache operation errors gracefully", async () => {
      // Cache cleaning fails
      mockCleanMediumCache.mockRejectedValueOnce(new Error("Cache error"));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRss2JsonResponse),
      });
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);

      // Getting cached colors fails
      mockGetCachedColors.mockRejectedValueOnce(new Error("Cache read error"));

      // Should still work despite cache errors
      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      const result = await response.json();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe(mockMediumPost.title);
    });

    it("sets correct cache revalidation time", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRss2JsonResponse),
      });
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);
      mockGetCachedColors.mockResolvedValueOnce(mockCachedColors);

      await GET(new NextRequest("http://localhost:3000/api/medium-posts"));

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), {
        next: { revalidate: 3600 }, // 1 hour
      });
    });
  });
});
