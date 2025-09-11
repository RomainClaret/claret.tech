/**
 * License API Route Tests
 *
 * Tests the license API endpoint that reads, caches, and
 * serves MIT license content as plain text.
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

  describe("Successful Response", () => {
    it("returns license content as plain text", async () => {
      const mockLicenseText = `MIT License

Copyright (c) 2025 Romain Claret

Permission is hereby granted...`;

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
      mockFs.readFileSync.mockReturnValue("MIT License Content");

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
      const mockLicenseText = "MIT License - Cached Version";

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
      const newLicense = "New MIT License";

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
            "MIT License\n\nCopyright (c) 2025 Romain Claret\n\n[License file not found - please check repository]",
        },
        { status: 404 },
      );
    });

    it("includes fallback content in 404 response", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await GET();

      const notFoundCall = (NextResponse.json as any).mock.calls[0][0];
      expect(notFoundCall.content).toContain("MIT License");
      expect(notFoundCall.content).toContain(
        "Copyright (c) 2025 Romain Claret",
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
          content: expect.stringContaining("MIT License"),
          warning: "Using fallback license content due to read error",
        }),
        { status: 200 },
      );
    });

    it("includes comprehensive fallback MIT license", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("Read error");
      });

      await GET();

      const fallbackCall = (NextResponse.json as any).mock.calls[0][0];
      expect(fallbackCall.content).toContain("MIT License");
      expect(fallbackCall.content).toContain(
        "Copyright (c) 2025 Romain Claret",
      );
      expect(fallbackCall.content).toContain("Permission is hereby granted");
      expect(fallbackCall.content).toContain("without restriction");
      expect(fallbackCall.content).toContain(
        'THE SOFTWARE IS PROVIDED "AS IS"',
      );
      expect(fallbackCall.content).toContain("WITHOUT WARRANTY OF ANY KIND");
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
      mockFs.readFileSync.mockReturnValue("MIT License Content");

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
      const mockLicenseText = "MIT License\\nContent here";

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockLicenseText);

      await GET();

      expect(NextResponse.json).toHaveBeenCalledWith(
        { content: mockLicenseText },
        expect.any(Object),
      );
    });

    it("stores content in cache correctly", async () => {
      const mockLicenseText = "Test MIT License";

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

  describe("MIT License Format", () => {
    it("handles standard MIT license format", async () => {
      const standardMIT = `MIT License

Copyright (c) 2025 Romain Claret

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(standardMIT);

      await GET();

      expect(NextResponse.json).toHaveBeenCalledWith(
        { content: standardMIT },
        expect.any(Object),
      );
    });

    it("preserves license text formatting", async () => {
      const formattedLicense = `MIT License

Copyright (c) 2025 Romain Claret

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
