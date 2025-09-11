/**
 * Privacy Policy API Route Tests
 *
 * Tests the privacy policy API endpoint that reads, caches, and
 * serves markdown-rendered privacy policy content.
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

describe("Privacy Policy API Route", () => {
  beforeEach(async () => {
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
    it("returns privacy policy content with HTML rendering", async () => {
      const mockMarkdown = "# Privacy Policy\\n\\nContent here.";
      const mockHtml = "<h1>Privacy Policy</h1>\\n<p>Content here.</p>";

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockMarkdown);
      mockRenderMarkdownToHtml.mockReturnValue(mockHtml);

      await GET();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining("PRIVACY-POLICY.md"),
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining("PRIVACY-POLICY.md"),
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
      mockFs.readFileSync.mockReturnValue("# Privacy Policy");
      mockRenderMarkdownToHtml.mockReturnValue("<h1>Privacy Policy</h1>");

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
      const mockMarkdown = "# Cached Privacy Policy";
      const mockHtml = "<h1>Cached Privacy Policy</h1>";

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
      const newMarkdown = "# New Privacy Policy";
      const newHtml = "<h1>New Privacy Policy</h1>";

      // Mock cache miss (expired or not found)
      mockApiCache.get.mockReturnValue(null);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(newMarkdown);
      mockRenderMarkdownToHtml.mockReturnValue(newHtml);

      await GET();

      // File should be read when cache misses
      expect(mockFs.readFileSync).toHaveBeenCalled();
      expect(mockRenderMarkdownToHtml).toHaveBeenCalledWith(newMarkdown);
      expect(mockApiCache.set).toHaveBeenCalledWith("privacy-policy-content", {
        content: newMarkdown,
        html: newHtml,
      });
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          content: newMarkdown,
          html: newHtml,
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            "Cache-Control":
              "public, s-maxage=3600, stale-while-revalidate=7200",
          }),
        }),
      );
    });
  });

  describe("File Not Found", () => {
    it("returns 404 when privacy policy file does not exist", async () => {
      // Clear any cached data and setup fresh mocks
      vi.clearAllMocks();
      mockFs.existsSync.mockReturnValue(false);

      // Mock fresh route import to avoid cached data
      vi.resetModules();
      const { GET: freshGET } = await import("./route");
      await freshGET();

      expect(mockDevError).toHaveBeenCalledWith(
        "PRIVACY-POLICY.md file not found at:",
        expect.stringContaining("PRIVACY-POLICY.md"),
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "PRIVACY-POLICY file not found",
          content:
            "# Privacy Policy\n\n**Last Updated: 2025-01-03**\n\n[Privacy policy file not found - please check repository]",
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
        "Failed to read PRIVACY-POLICY file:",
        expect.any(Error),
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("# Privacy Policy"),
          warning: "Using fallback privacy policy content due to read error",
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
      expect(fallbackCall.content).toContain("# Privacy Policy");
      expect(fallbackCall.content).toContain("**Last Updated: 2025-01-03**");
      expect(fallbackCall.content).toContain("## Our Commitment to Privacy");
      expect(fallbackCall.content).toContain("We DO NOT track you");
      expect(fallbackCall.content).toContain("## What We Don't Collect");
      expect(fallbackCall.content).toContain("❌ No personal identification");
      expect(fallbackCall.content).toContain("❌ No IP address logging");
      expect(fallbackCall.content).toContain("privacy@claret.tech");
    });

    it("handles markdown rendering errors gracefully", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("# Privacy Policy");
      mockRenderMarkdownToHtml.mockImplementation(() => {
        throw new Error("Markdown rendering failed");
      });

      await GET();

      // Should call devError and return fallback content
      expect(mockDevError).toHaveBeenCalledWith(
        "Failed to read PRIVACY-POLICY file:",
        expect.any(Error),
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("# Privacy Policy"),
          warning: "Using fallback privacy policy content due to read error",
        }),
        { status: 200 },
      );
    });
  });

  describe("Path Resolution", () => {
    it("uses correct file path", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("# Privacy Policy");
      mockRenderMarkdownToHtml.mockReturnValue("<h1>Privacy Policy</h1>");

      await GET();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining("PRIVACY-POLICY.md"),
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining("PRIVACY-POLICY.md"),
        "utf-8",
      );
    });
  });

  describe("Response Format", () => {
    it("returns both content and html fields", async () => {
      const mockMarkdown = "# Privacy Policy\\nContent";
      const mockHtml = "<h1>Privacy Policy</h1>\\n<p>Content</p>";

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
      const mockMarkdown = "# Test Privacy Policy";
      const mockHtml = "<h1>Test Privacy Policy</h1>";

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
