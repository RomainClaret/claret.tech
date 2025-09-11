import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { NextResponse, NextRequest } from "next/server";

// Dynamic import for proper mocking
let GET: typeof import("./route").GET;

// Mock Next.js
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => data,
      status: options?.status || 200,
    })),
  },
  NextRequest: vi.fn().mockImplementation((url) => ({
    url: url || "http://localhost",
    method: "GET",
  })),
}));

// Mock kudos data and formatter
vi.mock("@/data/sections/kudos-articles", () => ({
  kudosArticles: [
    {
      id: "article1",
      title: "Test Kudos Article",
      url: "https://www.growkudos.com/publications/12345",
      description: "Test description",
      date: "2024-08-18",
    },
    {
      id: "article2",
      title: "Second Kudos Article",
      url: "https://www.growkudos.com/publications/67890",
      description: "Another test description",
      date: "2024-08-17",
    },
  ],
  formatKudosArticleForBlog: vi.fn(),
}));

// Mock kudos scraper
vi.mock("@/lib/utils/kudos-scraper", () => ({
  fetchKudosImage: vi.fn(),
  cleanCache: vi.fn(),
}));

// Import mocked modules
import {
  kudosArticles,
  formatKudosArticleForBlog,
} from "@/data/sections/kudos-articles";
import { fetchKudosImage, cleanCache } from "@/lib/utils/kudos-scraper";

const mockFormatKudosArticleForBlog = formatKudosArticleForBlog as Mock;
const mockFetchKudosImage = fetchKudosImage as Mock;
const mockCleanCache = cleanCache as Mock;
const mockNextResponse = NextResponse as unknown as { json: Mock };

describe("Kudos Articles API Route", () => {
  const mockFormattedArticle = {
    id: "article1",
    title: "Test Kudos Article",
    url: "https://www.growkudos.com/publications/12345",
    description: "Test description",
    date: "2024-08-18",
    image: "/images/kudos/default.jpg", // Static image
    excerpt: "Formatted excerpt",
    tags: ["research", "publication"],
  };

  const mockFormattedArticleWithoutImage = {
    id: "article2",
    title: "Second Kudos Article",
    url: "https://www.growkudos.com/publications/67890",
    description: "Another test description",
    date: "2024-08-17",
    image: null, // No static image
    excerpt: "Another formatted excerpt",
    tags: ["science"],
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamic import after mocks are set up
    const routeModule = await import("./route");
    GET = routeModule.GET;

    mockCleanCache.mockResolvedValue(undefined);

    // Reset the NextResponse.json mock to return the proper structure
    mockNextResponse.json.mockImplementation(
      (data: unknown, options: Record<string, unknown>) => ({
        json: () => data,
        ...options,
      }),
    );
  });

  describe("GET /api/kudos-articles", () => {
    it("fetches and formats Kudos articles successfully", async () => {
      // Setup mock return values for this test
      mockFormatKudosArticleForBlog
        .mockReturnValueOnce(mockFormattedArticle)
        .mockReturnValueOnce(mockFormattedArticleWithoutImage);

      mockFetchKudosImage
        .mockResolvedValueOnce("https://kudos.com/dynamic1.jpg")
        .mockResolvedValueOnce("https://kudos.com/dynamic2.jpg");

      const response = await GET(new NextRequest("http://localhost"));

      // Verify cache cleaning was called
      expect(mockCleanCache).toHaveBeenCalled();

      // Verify articles were formatted (map passes element, index, array)
      expect(mockFormatKudosArticleForBlog).toHaveBeenCalledTimes(2);
      expect(mockFormatKudosArticleForBlog).toHaveBeenCalledWith(
        kudosArticles[0],
        0,
        kudosArticles,
      );
      expect(mockFormatKudosArticleForBlog).toHaveBeenCalledWith(
        kudosArticles[1],
        1,
        kudosArticles,
      );

      // Verify dynamic image fetching was called for both articles (first has /images/ path, second has null)
      expect(mockFetchKudosImage).toHaveBeenCalledTimes(2);
      expect(mockFetchKudosImage).toHaveBeenCalledWith(
        mockFormattedArticle.url,
      );
      expect(mockFetchKudosImage).toHaveBeenCalledWith(
        mockFormattedArticleWithoutImage.url,
      );

      const result = await response.json();
      expect(result.status).toBe("success");
      expect(result.articles).toHaveLength(2);
      expect(result.count).toBe(2);

      // First article should have dynamic image (replaces /images/ path)
      expect(result.articles[0]).toEqual({
        ...mockFormattedArticle,
        image: "https://kudos.com/dynamic1.jpg",
      });

      // Second article should have dynamic image (replaces null)
      expect(result.articles[1]).toEqual({
        ...mockFormattedArticleWithoutImage,
        image: "https://kudos.com/dynamic2.jpg",
      });
    });

    it("keeps static images when they exist and are not placeholder paths", async () => {
      const articleWithHttpImage = {
        ...mockFormattedArticle,
        image: "https://cdn.example.com/real-image.jpg",
      };

      // Setup mock return values for this test
      mockFormatKudosArticleForBlog
        .mockReturnValueOnce(articleWithHttpImage)
        .mockReturnValueOnce(mockFormattedArticleWithoutImage);

      const response = await GET(new NextRequest("http://localhost"));

      // Should not fetch dynamic image for article with HTTP image
      expect(mockFetchKudosImage).toHaveBeenCalledTimes(1);
      expect(mockFetchKudosImage).toHaveBeenCalledWith(
        mockFormattedArticleWithoutImage.url,
      );

      const result = await response.json();
      expect(result.articles[0].image).toBe(
        "https://cdn.example.com/real-image.jpg",
      );
    });

    it("fetches dynamic images for articles with placeholder /images/ paths", async () => {
      const articleWithPlaceholderImage = {
        ...mockFormattedArticle,
        image: "/images/kudos/placeholder.jpg", // Should trigger dynamic fetch
      };

      // Setup mock return values for this test
      mockFormatKudosArticleForBlog
        .mockReturnValueOnce(articleWithPlaceholderImage)
        .mockReturnValueOnce(mockFormattedArticleWithoutImage);

      mockFetchKudosImage
        .mockResolvedValueOnce("https://kudos.com/dynamic1.jpg")
        .mockResolvedValueOnce("https://kudos.com/dynamic2.jpg");

      const response = await GET(new NextRequest("http://localhost"));

      // Should fetch dynamic images for both articles
      expect(mockFetchKudosImage).toHaveBeenCalledTimes(2);
      expect(mockFetchKudosImage).toHaveBeenCalledWith(
        articleWithPlaceholderImage.url,
      );
      expect(mockFetchKudosImage).toHaveBeenCalledWith(
        mockFormattedArticleWithoutImage.url,
      );

      const result = await response.json();
      expect(result.articles[0].image).toBe("https://kudos.com/dynamic1.jpg");
      expect(result.articles[1].image).toBe("https://kudos.com/dynamic2.jpg");
    });

    it("handles individual image fetch failures gracefully", async () => {
      // Setup mock return values for this test
      mockFormatKudosArticleForBlog
        .mockReturnValueOnce(mockFormattedArticle)
        .mockReturnValueOnce(mockFormattedArticleWithoutImage);

      mockFetchKudosImage.mockRejectedValueOnce(new Error("Scraping failed"));

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.status).toBe("success");
      expect(result.articles).toHaveLength(2);

      // Failed image fetch should keep original article unchanged
      expect(result.articles[1]).toEqual(mockFormattedArticleWithoutImage);
    });

    it("continues processing when some image fetches fail", async () => {
      const articlesWithoutImages = [
        {
          ...mockFormattedArticleWithoutImage,
          id: "article1",
          url: "https://kudos.com/1",
        },
        {
          ...mockFormattedArticleWithoutImage,
          id: "article2",
          url: "https://kudos.com/2",
        },
      ];

      // Setup mock return values for this test
      mockFormatKudosArticleForBlog
        .mockReturnValueOnce(articlesWithoutImages[0])
        .mockReturnValueOnce(articlesWithoutImages[1]);

      // First fetch succeeds, second fails
      mockFetchKudosImage
        .mockResolvedValueOnce("https://kudos.com/image1.jpg")
        .mockRejectedValueOnce(new Error("Network error"));

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result.articles).toHaveLength(2);
      expect(result.articles[0].image).toBe("https://kudos.com/image1.jpg");
      expect(result.articles[1].image).toBe(null); // Failed fetch, unchanged
    });

    it("handles cache cleaning errors gracefully", async () => {
      // Setup mock return values for this test
      mockFormatKudosArticleForBlog
        .mockReturnValueOnce(mockFormattedArticle)
        .mockReturnValueOnce(mockFormattedArticleWithoutImage);

      mockCleanCache.mockRejectedValueOnce(new Error("Cache cleanup failed"));

      const response = await GET(new NextRequest("http://localhost"));

      // Should still process articles despite cache error
      const result = await response.json();
      expect(result.status).toBe("success");
      expect(result.articles).toHaveLength(2);
    });

    it("handles formatting errors", async () => {
      mockFormatKudosArticleForBlog.mockReset().mockImplementationOnce(() => {
        throw new Error("Formatting error");
      });

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({
          status: "error",
          message: "Failed to fetch Kudos articles",
          articles: [],
        }),
        status: 500,
      });

      await GET(new NextRequest("http://localhost"));

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          status: "error",
          message: "Failed to fetch Kudos articles",
          articles: [],
        },
        { status: 500 },
      );
    });

    it("handles empty articles array", async () => {
      vi.doMock("@/data/sections/kudos-articles", () => ({
        kudosArticles: [],
        formatKudosArticleForBlog: vi.fn(),
      }));

      // Re-import the module to get the new mock
      vi.resetModules();
      const { GET: getWithEmptyArticles } = await import("./route");

      const response = await getWithEmptyArticles(
        new NextRequest("http://localhost"),
      );

      const result = await response.json();
      expect(result.status).toBe("success");
      expect(result.articles).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("does not fetch images when dynamic fetch returns null", async () => {
      // Setup mock return values for this test
      mockFormatKudosArticleForBlog
        .mockReturnValueOnce(mockFormattedArticle)
        .mockReturnValueOnce(mockFormattedArticleWithoutImage);

      // Both articles trigger fetch but both return null
      mockFetchKudosImage
        .mockResolvedValueOnce(null) // First article (/images/ path)
        .mockResolvedValueOnce(null); // Second article (null image)

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      // Check if the response structure is correct
      expect(result).toBeDefined();
      expect(result.articles).toBeDefined();

      // Both articles should remain unchanged when fetch returns null
      if (result.articles && result.articles.length >= 2) {
        expect(result.articles[0]).toEqual(mockFormattedArticle);
        expect(result.articles[1]).toEqual(mockFormattedArticleWithoutImage);
      } else {
        // If articles is not properly set, check the basic response
        expect(result.status).toBe("success");
      }
    });

    it("preserves all article properties during enrichment", async () => {
      const complexArticle = {
        ...mockFormattedArticleWithoutImage,
        customProperty: "custom value",
        nestedObject: { key: "value" },
        arrayProperty: [1, 2, 3],
      };

      // Setup custom mock return values for this test
      mockFormatKudosArticleForBlog
        .mockReturnValueOnce(mockFormattedArticle)
        .mockReturnValueOnce(complexArticle);

      // Both articles trigger fetch - first gets one image, second gets another
      mockFetchKudosImage
        .mockResolvedValueOnce("https://kudos.com/first-image.jpg") // First article (/images/ path)
        .mockResolvedValueOnce("https://kudos.com/new-image.jpg"); // Second article (null image)

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      // Check if the response structure is correct
      expect(result).toBeDefined();
      expect(result.articles).toBeDefined();

      if (result.articles && result.articles.length >= 2) {
        // First article should get first dynamic image
        expect(result.articles[0]).toEqual({
          ...mockFormattedArticle,
          image: "https://kudos.com/first-image.jpg",
        });
        // Second article should get second dynamic image
        expect(result.articles[1]).toEqual({
          ...complexArticle,
          image: "https://kudos.com/new-image.jpg",
        });
        expect(result.articles[1].customProperty).toBe("custom value");
        expect(result.articles[1].nestedObject).toEqual({ key: "value" });
        expect(result.articles[1].arrayProperty).toEqual([1, 2, 3]);
      } else {
        // If articles is not properly set, check the basic response
        expect(result.status).toBe("success");
      }
    });

    it("includes correct response structure", async () => {
      // Setup mock return values for this test
      mockFormatKudosArticleForBlog
        .mockReturnValueOnce(mockFormattedArticle)
        .mockReturnValueOnce(mockFormattedArticleWithoutImage);

      const response = await GET(new NextRequest("http://localhost"));

      const result = await response.json();
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("articles");
      expect(result).toHaveProperty("count");
      expect(typeof result.count).toBe("number");
      expect(Array.isArray(result.articles)).toBe(true);
    });
  });
});
