/**
 * Terms of Service API Route Tests
 *
 * Tests the terms of service API endpoint that reads, caches, and
 * serves markdown-rendered terms of service content.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "./route";
import { NextResponse } from "next/server";
import fs from "fs";
import { clearApiCache } from "@/test/helpers/api-test-helpers";

// Mock dependencies
vi.mock("fs");
vi.mock("@/lib/utils/dev-logger", () => ({
  devError: vi.fn(),
}));
vi.mock("@/lib/utils/markdown-server", () => ({
  renderMarkdownToHtml: vi.fn(),
}));
vi.mock("@/lib/utils/api-cache", () => ({
  ApiCache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
}));

// Import the mocked functions
import { devError } from "@/lib/utils/dev-logger";
import { renderMarkdownToHtml } from "@/lib/utils/markdown-server";
import { ApiCache } from "@/lib/utils/api-cache";

const mockFs = vi.mocked(fs);
const mockDevError = vi.mocked(devError);
const mockRenderMarkdownToHtml = vi.mocked(renderMarkdownToHtml);
const mockApiCache = vi.mocked(ApiCache);

describe("Terms of Service API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.useFakeTimers();
    clearApiCache();

    // Reset cache mocks to default behavior
    mockApiCache.get.mockReturnValue(null);
    mockApiCache.set.mockImplementation(() => {});

    // Mock NextResponse
    vi.spyOn(NextResponse, "json").mockImplementation((data, init) => {
      return {
        json: () => Promise.resolve(data),
        headers: new Headers(init?.headers),
        status: init?.status || 200,
      } as any;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Successful Response", () => {
    it("returns terms of service content with HTML rendering", async () => {
      const mockMarkdown = "# Terms of Service\\n\\nTerms content here.";
      const mockHtml = "<h1>Terms of Service</h1>\\n<p>Terms content here.</p>";

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockMarkdown);
      mockRenderMarkdownToHtml.mockReturnValue(mockHtml);

      await GET();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining("TERMS-OF-SERVICE.md"),
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining("TERMS-OF-SERVICE.md"),
        "utf-8",
      );
      expect(mockRenderMarkdownToHtml).toHaveBeenCalledWith(mockMarkdown);
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          content: mockMarkdown,
          html: mockHtml,
        },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=3600, stale-while-revalidate=7200",
          },
        },
      );
    });

    it("includes proper cache headers", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("# Terms of Service");
      mockRenderMarkdownToHtml.mockReturnValue("<h1>Terms of Service</h1>");

      await GET();

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          headers: {
            "Cache-Control":
              "public, s-maxage=3600, stale-while-revalidate=7200",
          },
        }),
      );
    });
  });

  describe("Caching Behavior", () => {
    it("returns cached data when cache is valid", async () => {
      const mockMarkdown = "# Cached Terms";
      const mockHtml = "<h1>Cached Terms</h1>";

      // Mock cache hit
      mockApiCache.get.mockReturnValue({
        content: mockMarkdown,
        html: mockHtml,
      });

      await GET();

      // File system should not be accessed when cache hits
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
      expect(mockFs.existsSync).not.toHaveBeenCalled();
      expect(mockRenderMarkdownToHtml).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          content: mockMarkdown,
          html: mockHtml,
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            "Cache-Control":
              "public, s-maxage=3600, stale-while-revalidate=7200",
          }),
        }),
      );
    });

    it("refreshes cache after expiration", async () => {
      const oldMarkdown = "# Old Terms";
      const oldHtml = "<h1>Old Terms</h1>";
      const newMarkdown = "# New Terms";
      const newHtml = "<h1>New Terms</h1>";

      // First call to populate cache
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(oldMarkdown);
      mockRenderMarkdownToHtml.mockReturnValue(oldHtml);

      await GET();

      // Advance time beyond cache duration (1 hour)
      vi.advanceTimersByTime(61 * 60 * 1000);

      // Reset mocks for second call
      vi.clearAllMocks();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(newMarkdown);
      mockRenderMarkdownToHtml.mockReturnValue(newHtml);

      await GET();

      // File should be read again after cache expiration
      expect(mockFs.readFileSync).toHaveBeenCalled();
      expect(mockRenderMarkdownToHtml).toHaveBeenCalledWith(newMarkdown);
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          content: newMarkdown,
          html: newHtml,
        },
        expect.any(Object),
      );
    });
  });

  describe("File Not Found", () => {
    it("returns 404 when terms file does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await GET();

      expect(mockDevError).toHaveBeenCalledWith(
        "TERMS-OF-SERVICE.md file not found at:",
        expect.stringContaining("TERMS-OF-SERVICE.md"),
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "TERMS-OF-SERVICE file not found",
          content:
            "# Terms of Service\n\n**Effective Date: 2025-01-03**\n\n[Terms of service file not found - please check repository]",
        },
        { status: 404 },
      );
    });

    it("does not call markdown renderer when file not found", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await GET();

      expect(mockRenderMarkdownToHtml).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("returns fallback content when file read fails", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await GET();

      expect(mockDevError).toHaveBeenCalledWith(
        "Failed to read TERMS-OF-SERVICE file:",
        expect.any(Error),
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("# Terms of Service"),
          warning: "Using fallback terms of service content due to read error",
        }),
        { status: 200 },
      );
    });

    it("includes comprehensive fallback content", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("Read error");
      });

      await GET();

      const fallbackCall = (NextResponse.json as any).mock.calls[0][0];
      expect(fallbackCall.content).toContain("# Terms of Service");
      expect(fallbackCall.content).toContain("**Effective Date: 2025-01-03**");
      expect(fallbackCall.content).toContain("## 1. Acceptance of Terms");
      expect(fallbackCall.content).toContain(
        "By accessing and using claret.tech",
      );
      expect(fallbackCall.content).toContain("## 2. Use of Website");
      expect(fallbackCall.content).toContain(
        "personal portfolio and research showcase",
      );
      expect(fallbackCall.content).toContain("## 12. Contact Information");
      expect(fallbackCall.content).toContain("legal@claret.tech");
    });

    it("handles markdown rendering errors gracefully", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("# Terms of Service");
      mockRenderMarkdownToHtml.mockImplementation(() => {
        throw new Error("Markdown rendering failed");
      });

      await GET();

      // Should call devError and return fallback content
      expect(mockDevError).toHaveBeenCalledWith(
        "Failed to read TERMS-OF-SERVICE file:",
        expect.any(Error),
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("# Terms of Service"),
          warning: "Using fallback terms of service content due to read error",
        }),
        { status: 200 },
      );
    });
  });

  describe("Path Resolution", () => {
    it("uses correct file path", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("# Terms of Service");
      mockRenderMarkdownToHtml.mockReturnValue("<h1>Terms of Service</h1>");

      await GET();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining("TERMS-OF-SERVICE.md"),
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining("TERMS-OF-SERVICE.md"),
        "utf-8",
      );
    });
  });

  describe("Response Format", () => {
    it("returns both content and html fields", async () => {
      const mockMarkdown = "# Terms of Service\\nContent";
      const mockHtml = "<h1>Terms of Service</h1>\\n<p>Content</p>";

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockMarkdown);
      mockRenderMarkdownToHtml.mockReturnValue(mockHtml);

      await GET();

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          content: mockMarkdown,
          html: mockHtml,
        }),
        expect.any(Object),
      );
    });

    it("stores both content and html in cache", async () => {
      const mockMarkdown = "# Test Terms of Service";
      const mockHtml = "<h1>Test Terms of Service</h1>";

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockMarkdown);
      mockRenderMarkdownToHtml.mockReturnValue(mockHtml);

      // First call
      await GET();

      // Clear mocks and make second call to verify cache
      vi.clearAllMocks();
      await GET();

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          content: mockMarkdown,
          html: mockHtml,
        }),
        expect.any(Object),
      );
    });
  });
});
