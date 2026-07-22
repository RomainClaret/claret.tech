/**
 * License API Route Tests
 *
 * Tests the license API endpoint that reads, caches, and
 * serves the license content as plain text.
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
import { ApiCache } from "@/lib/utils/api-cache";

const mockFs = vi.mocked(fs);
const mockDevError = vi.mocked(devError);
const mockApiCache = vi.mocked(ApiCache);

describe("License API Route", () => {
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

  describe("Rate limiting", () => {
    it("wraps the handler with withRateLimit (attaches X-RateLimit headers)", async () => {
      mockApiCache.get.mockReturnValue("cached LICENSE content");
      const request = { headers: new Headers() } as unknown as Parameters<
        typeof GET
      >[0];

      const response = await GET(request);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
    });
  });

  describe("Successful Response", () => {
    it("returns license content as plain text", async () => {
      const mockLicenseText = `GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) 2025 Romain Claret

This program is free software...`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockLicenseText);

      await GET();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining("LICENSE"),
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining("LICENSE"),
        "utf-8",
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        { content: mockLicenseText },
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
      mockFs.readFileSync.mockReturnValue("GPL-3.0-or-later License Content");

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
      const mockLicenseText = "GPL-3.0-or-later License - Cached Version";

      // Mock cache hit
      mockApiCache.get.mockReturnValue(mockLicenseText);

      await GET();

      // File system should not be accessed when cache hits
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
      expect(mockFs.existsSync).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { content: mockLicenseText },
        expect.objectContaining({
          headers: expect.objectContaining({
            "Cache-Control":
              "public, s-maxage=3600, stale-while-revalidate=7200",
          }),
        }),
      );
    });

    it("refreshes cache after expiration", async () => {
      const newLicense = "New GPL-3.0-or-later License";

      // Mock cache miss (expired or not found)
      mockApiCache.get.mockReturnValue(null);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(newLicense);

      await GET();

      // File should be read when cache misses
      expect(mockFs.readFileSync).toHaveBeenCalled();
      expect(mockApiCache.set).toHaveBeenCalledWith(
        "license-content",
        newLicense,
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        { content: newLicense },
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
    it("returns 404 when LICENSE file does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await GET();

      expect(mockDevError).toHaveBeenCalledWith(
        "LICENSE file not found at:",
        expect.stringContaining("LICENSE"),
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "LICENSE file not found",
          content:
            "GPL-3.0-or-later\n\nCopyright (C) 2025 Romain Claret\n\n[LICENSE file not found - see https://www.gnu.org/licenses/gpl-3.0.txt]",
        },
        { status: 404 },
      );
    });

    it("includes fallback content in 404 response", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await GET();

      const notFoundCall = (NextResponse.json as any).mock.calls[0][0];
      expect(notFoundCall.content).toContain("GPL-3.0-or-later");
      expect(notFoundCall.content).toContain(
        "Copyright (C) 2025 Romain Claret",
      );
      expect(notFoundCall.error).toBe("LICENSE file not found");
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
        "Failed to read LICENSE file:",
        expect.any(Error),
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("GNU GENERAL PUBLIC LICENSE"),
          warning: "Using fallback license content due to read error",
        }),
        { status: 200 },
      );
    });

    it("includes comprehensive fallback GPL license", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("Read error");
      });

      await GET();

      const fallbackCall = (NextResponse.json as any).mock.calls[0][0];
      expect(fallbackCall.content).toContain("GNU GENERAL PUBLIC LICENSE");
      expect(fallbackCall.content).toContain(
        "Copyright (C) 2025 Romain Claret",
      );
      expect(fallbackCall.content).toContain("free software");
      expect(fallbackCall.content).toContain("any later");
      expect(fallbackCall.content).toContain("GNU General Public License");
      expect(fallbackCall.content).toContain("https://www.gnu.org/licenses/");
      expect(fallbackCall.warning).toBe(
        "Using fallback license content due to read error",
      );
    });

    it("returns status 200 for error fallback", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("File system error");
      });

      await GET();

      expect(NextResponse.json).toHaveBeenCalledWith(expect.any(Object), {
        status: 200,
      });
    });
  });

  describe("Path Resolution", () => {
    it("uses correct LICENSE file path", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("GPL-3.0-or-later License Content");

      await GET();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringMatching(/.*LICENSE$/),
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/.*LICENSE$/),
        "utf-8",
      );
    });

    it("resolves path from process.cwd()", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("License content");

      await GET();

      // Verify the path includes the current working directory
      const expectedPath = expect.stringMatching(/LICENSE$/);
      expect(mockFs.existsSync).toHaveBeenCalledWith(expectedPath);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(expectedPath, "utf-8");
    });
  });

  describe("Response Format", () => {
    it("returns content field only (no HTML rendering)", async () => {
      const mockLicenseText = "GPL License\\nContent here";

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockLicenseText);

      await GET();

      expect(NextResponse.json).toHaveBeenCalledWith(
        { content: mockLicenseText },
        expect.any(Object),
      );
    });

    it("stores content in cache correctly", async () => {
      const mockLicenseText = "Test GPL License";

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockLicenseText);

      // First call
      await GET();

      // Clear mocks and make second call to verify cache
      vi.clearAllMocks();
      await GET();

      expect(NextResponse.json).toHaveBeenCalledWith(
        { content: mockLicenseText },
        expect.any(Object),
      );
    });
  });

  describe("License Format", () => {
    it("handles standard GPL license format", async () => {
      const standardGPL = `GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

                            Preamble

  The GNU General Public License is a free, copyleft license for
software and other kinds of works.`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(standardGPL);

      await GET();

      expect(NextResponse.json).toHaveBeenCalledWith(
        { content: standardGPL },
        expect.any(Object),
      );
    });

    it("preserves license text formatting", async () => {
      const formattedLicense = `GNU GENERAL PUBLIC LICENSE

Copyright (C) 2025 Romain Claret

   Indented text here
   More indented content

Regular paragraph.`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(formattedLicense);

      await GET();

      expect(NextResponse.json).toHaveBeenCalledWith(
        { content: formattedLicense },
        expect.any(Object),
      );
    });
  });
});
