import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  Mock,
  Mocked,
} from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "./route";

// Mock Next.js
vi.mock("next/server", () => ({
  NextRequest: vi.fn((url, options) => ({
    url,
    headers: new Map(),
    nextUrl: {
      pathname: url.split("?")[0],
      searchParams: {
        get: (key: string) => {
          const params = url.includes("?") ? url.split("?")[1].split("&") : [];
          const param = params.find((p: string) => p.startsWith(`${key}=`));
          return param ? param.split("=")[1] : null;
        },
        has: (key: string) => {
          const params = url.includes("?") ? url.split("?")[1].split("&") : [];
          return params.some((p: string) => p.startsWith(`${key}=`));
        },
      },
      toString: () => url,
    },
    json: async () => (options?.body ? JSON.parse(options.body) : {}),
  })),
  NextResponse: Object.assign(
    vi.fn((body, options) => {
      const headersMap = new Map(Object.entries(options?.headers || {}));
      return {
        text: async () => body,
        headers: headersMap,
        status: options?.status || 200,
      };
    }),
    {
      json: vi.fn((data, options) => {
        const headersMap = new Map(Object.entries(options?.headers || {}));
        return {
          json: () => data,
          headers: headersMap,
          status: options?.status || 200,
        };
      }),
    },
  ),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

// Mock path
vi.mock("path", () => ({
  default: {
    join: vi.fn((...args) => args.join("/")),
    dirname: vi.fn((path) => path.split("/").slice(0, -1).join("/")),
  },
}));

// Mock fetch-publications with dynamic import support
vi.mock("@/lib/api/fetch-publications", () => ({
  fetchAllPublications: vi.fn(),
  exportToBibTeX: vi.fn(),
  default: {
    fetchAllPublications: vi.fn(),
    exportToBibTeX: vi.fn(),
  },
}));

// Mock rate limiter
vi.mock("@/lib/utils/rate-limiter", () => ({
  withRateLimit: vi.fn((handler) => handler),
}));

// Import mocked modules
import fs from "fs/promises";
import { fetchAllPublications } from "@/lib/api/fetch-publications";

const mockFs = fs as Mocked<typeof fs>;
const mockFetchAllPublications = fetchAllPublications as Mock;
const mockNextResponse = NextResponse as unknown as { json: Mock };

describe("Publications API Route", () => {
  const mockPublications = [
    {
      id: "1",
      title: "Test Publication 1",
      authors: ["Author 1"],
      citations: 10,
      year: 2023,
    },
    {
      id: "2",
      title: "Test Publication 2",
      authors: ["Author 2"],
      citations: 5,
      year: 2024,
    },
  ];

  const mockCachedData = {
    lastUpdated: "2024-08-18T12:00:00.000Z",
    count: 2,
    totalCitations: 15,
    publications: mockPublications,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Reset timer state first
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-08-18T12:30:00.000Z"));

    // Mock environment variables
    process.env.SEMANTIC_SCHOLAR_AUTHOR_ID = "test-semantic-id";
    process.env.ORCID_ID = "test-orcid-id";
    process.env.AUTHOR_NAME = "Test Author";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock("@/lib/api/fetch-publications");
    delete process.env.SEMANTIC_SCHOLAR_AUTHOR_ID;
    delete process.env.ORCID_ID;
    delete process.env.AUTHOR_NAME;
  });

  describe("GET /api/publications", () => {
    it("returns cached data when cache is valid", async () => {
      // Mock valid cache (30 minutes old, within 7-day limit)
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockCachedData));

      const request = new NextRequest("http://localhost:3000/api/publications");
      const response = await GET(request);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining("publications.json"),
        "utf-8",
      );
      expect(mockFetchAllPublications).not.toHaveBeenCalled();
      const result = await response.json();
      expect(result).toEqual(mockCachedData);
    });

    it("fetches new data when cache is expired", async () => {
      // Mock expired cache (8 days old)
      const expiredData = {
        ...mockCachedData,
        lastUpdated: "2024-08-10T12:00:00.000Z",
      };
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(expiredData));
      mockFetchAllPublications.mockResolvedValueOnce(mockPublications);

      const request = new NextRequest("http://localhost:3000/api/publications");
      await GET(request);

      expect(mockFetchAllPublications).toHaveBeenCalledWith({
        semanticScholarId: "test-semantic-id",
        orcidId: "test-orcid-id",
        authorName: "Test Author",
      });
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it("fetches new data when force refresh is requested", async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockCachedData));
      mockFetchAllPublications.mockResolvedValueOnce(mockPublications);

      const request = new NextRequest(
        "http://localhost:3000/api/publications?refresh=true",
      );
      await GET(request);

      expect(mockFetchAllPublications).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it("returns stale cache when fetch fails", async () => {
      // No valid cache available
      mockFs.readFile.mockRejectedValueOnce(new Error("No cache file"));
      // Fetch fails
      mockFetchAllPublications.mockRejectedValueOnce(new Error("API error"));
      // But stale data is available as fallback
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockCachedData));

      const request = new NextRequest("http://localhost:3000/api/publications");
      const response = await GET(request);

      const result = await response.json();
      expect(result).toEqual(mockCachedData);
    });

    it("returns empty data when all operations fail", async () => {
      // Reset all mocks to ensure clean state for this test
      vi.resetAllMocks();

      // The route makes multiple calls to fs.readFile:
      // 1. getCachedPublications() - should fail (no valid cache)
      // 2. stale cache fallback - should also fail (no stale cache)
      mockFs.readFile.mockRejectedValue(new Error("No cache files"));

      // Mock fetch to fail
      mockFetchAllPublications.mockRejectedValueOnce(new Error("API error"));

      // Mock mkdir and writeFile (might be called during updateCache)
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const request = new NextRequest("http://localhost:3000/api/publications");
      const response = await GET(request);

      const result = await response.json();
      expect(result.count).toBe(0);
      expect(result.totalCitations).toBe(0);
      expect(result.publications).toEqual([]);
    });

    it("handles cache write errors gracefully", async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error("No cache"));
      mockFetchAllPublications.mockResolvedValueOnce(mockPublications);
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockRejectedValueOnce(new Error("Write failed"));

      const request = new NextRequest("http://localhost:3000/api/publications");
      const response = await GET(request);

      // Should still return the data even if cache write fails
      const result = await response.json();
      expect(result.count).toBe(2);
      expect(result.totalCitations).toBe(15);
    });

    it("calculates total citations correctly", async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error("No cache"));
      mockFetchAllPublications.mockResolvedValueOnce(mockPublications);

      const request = new NextRequest("http://localhost:3000/api/publications");
      const response = await GET(request);

      const result = await response.json();
      expect(result.totalCitations).toBe(15); // 10 + 5
    });

    it("sets correct cache headers", async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockCachedData));

      const request = new NextRequest("http://localhost:3000/api/publications");
      const response = await GET(request);

      const headers = response.headers;
      expect(headers.get("Cache-Control")).toEqual(
        "public, s-maxage=3600, stale-while-revalidate=86400",
      );
    });

    it("returns 500 error on response serialization failure", async () => {
      // This test targets the outer catch block by making NextResponse.json fail
      // Line 104-108: return NextResponse.json(data, {...});

      // Setup successful data fetch
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockCachedData));

      // Mock NextResponse.json to throw after data is processed
      const originalJson = NextResponse.json;
      let callCount = 0;
      NextResponse.json = vi
        .fn()
        .mockImplementation((...args: Parameters<typeof NextResponse.json>) => {
          callCount++;
          if (callCount === 1) {
            // First call (in our handler) should throw
            throw new Error("JSON serialization failed");
          }
          // Subsequent calls (like in our test assertion) should work
          return originalJson(...args);
        }) as typeof NextResponse.json;

      try {
        const request = new NextRequest(
          "http://localhost:3000/api/publications",
        );
        const response = await GET(request);

        const result = await response.json();
        expect(result.error).toBe("Failed to fetch publications");
        expect(response.status).toBe(500);
      } finally {
        // Restore NextResponse.json
        NextResponse.json = originalJson;
      }
    });
  });

  describe("POST /api/publications", () => {
    it("exports publications to BibTeX format", async () => {
      const bibtexOutput = "@article{test1,\n  title={Test Publication 1},\n}";

      // Mock the dynamic import
      vi.doMock("@/lib/api/fetch-publications", () => ({
        exportToBibTeX: vi.fn(() => bibtexOutput),
      }));

      const request = new NextRequest(
        "http://localhost:3000/api/publications",
        {
          method: "POST",
          body: JSON.stringify({ publications: mockPublications }),
        },
      );

      const result = await POST(request);

      // Compare Response properties separately
      const resultBody = await result.text();
      expect(resultBody).toEqual(bibtexOutput);
      expect(result.headers.get("Content-Type")).toEqual("text/plain");
      expect(result.headers.get("Content-Disposition")).toEqual(
        "attachment; filename=publications.bib",
      );
    });

    it("returns 500 error when BibTeX export fails", async () => {
      // Mock the dynamic import to throw an error
      vi.doMock("@/lib/api/fetch-publications", () => {
        throw new Error("Import failed");
      });

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({ error: "Failed to export BibTeX" }),
        status: 500,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/publications",
        {
          method: "POST",
          body: JSON.stringify({ publications: mockPublications }),
        },
      );

      await POST(request);

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: "Failed to export BibTeX" },
        { status: 500 },
      );
    });

    it("handles invalid request body gracefully", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/publications",
        {
          method: "POST",
          body: "invalid json",
        },
      );

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({ error: "Failed to export BibTeX" }),
        status: 500,
      });

      const result = await POST(request);

      expect(result.status).toBe(500);
    });
  });
});
