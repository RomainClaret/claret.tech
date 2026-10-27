import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { NextRequest } from "next/server";
import { blogImageId } from "@/lib/blog-images/sources";

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
}));

// Set up global fetch mock
global.fetch = mocks.fetch;

// Dynamic import for proper mocking
let GET: typeof import("./route").GET;

const mockFetchMediumArticle = mocks.fetchMediumArticle as Mock;
const mockCleanMediumCache = mocks.cleanMediumCache as Mock;
const mockFetch = mocks.fetch as Mock;
const mockNextResponse = mocks.NextResponse as { json: Mock };

// A post's picture, as Medium's feed gives it.
const PICTURE = "https://cdn-images-1.medium.com/max/1024/0*test-picture";
const PICTURE_PATH = `/api/blog-image/${blogImageId(PICTURE)}`;

describe("Medium Posts API Route", () => {
  const mockMediumPost = {
    title: "Test Medium Post",
    link: "https://medium.com/@testuser/test-post",
    content: `<p>Test content</p><img src="${PICTURE}">`,
    pubDate: "Sun, 18 Aug 2024 12:00:00 GMT",
    author: "Test Author",
    guid: "post-guid-123",
    categories: ["programming", "testing"],
  };

  /** Medium's RSS for these posts, as medium.com serves it. */
  const feed = (posts: (typeof mockMediumPost)[]) =>
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title><![CDATA[Stories by Test User on Medium]]></title>${posts
      .map(
        (post) =>
          `<item><title><![CDATA[${post.title}]]></title><link>${post.link}</link><guid isPermaLink="false">${post.guid}</guid>${post.categories
            .map((category) => `<category><![CDATA[${category}]]></category>`)
            .join(
              "",
            )}<dc:creator><![CDATA[${post.author}]]></dc:creator><pubDate>${post.pubDate}</pubDate><content:encoded><![CDATA[${post.content}]]></content:encoded></item>`,
      )
      .join("")}</channel></rss>`;

  /** An answer from medium.com with this body. */
  const answer = (body: string) => ({
    ok: true,
    status: 200,
    text: () => Promise.resolve(body),
  });

  /** What the route answers while the feed cannot be had. */
  const UNAVAILABLE = [
    { status: "unavailable", items: [] },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    },
  ];

  const mockEnrichedData = {
    image: "https://medium.com/better-image.jpg",
    color: "#3178c6",
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
    it("ends within a minute, whatever its fetches do", async () => {
      // Next drops a fetch's own timeout when it refreshes a stale cached
      // response in the background (next/dist/server/lib/patch-fetch.js),
      // so the route's limit is the backstop. The feed, an article page and
      // its image take up to 10 s each.
      const { maxDuration } = await import("./route");
      expect(maxDuration).toBe(60);
    });

    it("fetches and enriches Medium posts successfully", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce(answer(feed([mockMediumPost])));
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);

      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      // Verify cache cleaning was called
      expect(mockCleanMediumCache).toHaveBeenCalled();

      // Medium's own feed, for the configured account
      expect(mockFetch).toHaveBeenCalledWith(
        "https://medium.com/feed/@testuser",
        {
          next: { revalidate: 3600 },
          signal: expect.any(AbortSignal),
        },
      );

      // Verify article enrichment was called
      expect(mockFetchMediumArticle).toHaveBeenCalledWith(mockMediumPost.link);

      const result = await response.json();
      expect(result.status).toBe("ok");
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        ...mockMediumPost,
        thumbnail: PICTURE,
        image: PICTURE_PATH,
        enrichedColor: mockEnrichedData.color,
      });
      // Only the posts: the scraped image URLs it sent as cachedColors went
      // unused (security audit run 1, hardening).
      expect(result).not.toHaveProperty("cachedColors");
    });

    it("serves the feed to a request that says ?playwright=true", async () => {
      // That flag got two made-up posts ("Test Article 1"), meant for the
      // browser tests; the page asks with no query string, so no page or
      // test ever had them (2026-10-21).
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce(answer(feed([mockMediumPost])));
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);

      const response = await GET(
        new NextRequest(
          "http://localhost:3000/api/medium-posts?playwright=true",
        ),
      );

      const result = await response.json();
      expect(mockFetch).toHaveBeenCalled();
      expect(result.items.map((item: { title: string }) => item.title)).toEqual(
        [mockMediumPost.title],
      );
    });

    it("uses default Medium username when env variable is not set", async () => {
      delete process.env.NEXT_PUBLIC_MEDIUM_USERNAME;

      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce(answer(feed([mockMediumPost])));
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);

      await GET(new NextRequest("http://localhost:3000/api/medium-posts"));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://medium.com/feed/@romainclaret",
        expect.any(Object),
      );
    });

    // The URL has its own "@", and the old .env.example asked for one in
    // the variable too: the feed was then requested for "@@testuser".
    it("drops a leading @ from the configured username", async () => {
      process.env.NEXT_PUBLIC_MEDIUM_USERNAME = "@testuser";

      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce(answer(feed([mockMediumPost])));
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);

      await GET(new NextRequest("http://localhost:3000/api/medium-posts"));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://medium.com/feed/@testuser",
        expect.any(Object),
      );
    });

    // A 500 put "Failed to load resource" in every visitor's console while
    // the feed was away; the blog shows the Kudos story alone either way.
    it("answers no posts, with a 200 cached briefly, when Medium refuses", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      // A refusal, whatever its body.
      mockFetch.mockResolvedValueOnce({
        ...answer(feed([mockMediumPost])),
        ok: false,
        status: 403,
      });

      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      expect(mockNextResponse.json).toHaveBeenCalledWith(...UNAVAILABLE);
      expect(response.status).toBe(200);
    });

    it("answers no posts when the network fails", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await GET(new NextRequest("http://localhost:3000/api/medium-posts"));

      expect(mockNextResponse.json).toHaveBeenCalledWith(...UNAVAILABLE);
    });

    it("answers no posts when a challenge page comes instead of the feed", async () => {
      // What rss2json answered servers with from 2026-10.
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce(
        answer(
          '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head></html>',
        ),
      );

      await GET(new NextRequest("http://localhost:3000/api/medium-posts"));

      expect(mockNextResponse.json).toHaveBeenCalledWith(...UNAVAILABLE);
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
      mockFetch.mockResolvedValueOnce(answer(feed(multiplePosts)));

      // First article enrichment succeeds
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);
      // Second article enrichment fails
      mockFetchMediumArticle.mockRejectedValueOnce(
        new Error("Scraping failed"),
      );

      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      const result = await response.json();
      expect(result.items).toHaveLength(2);

      // First post should be enriched
      expect(result.items[0].image).toBe(PICTURE_PATH);
      expect(result.items[0].enrichedColor).toBe(mockEnrichedData.color);

      // The second keeps its picture, which comes from the feed, and only
      // misses the color its page would have given.
      expect(result.items[1].image).toBe(PICTURE_PATH);
      expect(result.items[1].enrichedColor).toBeUndefined();
    });

    it("takes a post's picture from the feed, through the site's route", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce(
        answer(
          feed([
            mockMediumPost,
            { ...mockMediumPost, guid: "no-picture", content: "<p>Text</p>" },
          ]),
        ),
      );
      // The article page's own image is not what the card shows.
      mockFetchMediumArticle.mockResolvedValue(mockEnrichedData);

      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      const result = await response.json();
      expect(
        result.items.map((item: { image: unknown }) => item.image),
      ).toEqual([PICTURE_PATH, null]);
      expect(JSON.stringify(result.items)).not.toContain(
        mockEnrichedData.image,
      );
    });

    it("handles empty items array gracefully", async () => {
      mockCleanMediumCache.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce(answer(feed([])));

      const response = await GET(
        new NextRequest("http://localhost:3000/api/medium-posts"),
      );

      const result = await response.json();
      expect(result.items).toEqual([]);
    });

    it("handles cache operation errors gracefully", async () => {
      // Cache cleaning fails
      mockCleanMediumCache.mockRejectedValueOnce(new Error("Cache error"));

      mockFetch.mockResolvedValueOnce(answer(feed([mockMediumPost])));
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);

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
      mockFetch.mockResolvedValueOnce(answer(feed([mockMediumPost])));
      mockFetchMediumArticle.mockResolvedValueOnce(mockEnrichedData);

      await GET(new NextRequest("http://localhost:3000/api/medium-posts"));

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), {
        next: { revalidate: 3600 }, // 1 hour
        signal: expect.any(AbortSignal),
      });
    });
  });
});
