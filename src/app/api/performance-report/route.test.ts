import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { NextResponse, NextRequest } from "next/server";

// Dynamic import to avoid cache issues
let GET: typeof import("./route").GET;
let POST: typeof import("./route").POST;

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

const mockNextResponse = NextResponse as unknown as { json: Mock };

// Type for API response with json() method
type APIResponse = { json: () => Promise<Record<string, unknown>> };

// Specific response interface for type safety
interface PerformanceReportResponse {
  success?: boolean;
  timestamp?: string;
  report?: {
    summary: {
      overallScore: number;
      grade: string;
      primaryIssues: string[];
      strengths: string[];
    };
    metrics: {
      performance: {
        fps: { value: number; status: string; target: number };
        memory: { value: number; status: string; target: number };
        cpu: { value?: number; status: string; target: number };
      };
      vitals: Record<
        string,
        { value?: number; status: string; target: number }
      >;
    };
    recommendations: Array<{
      issue: string;
      category: string;
      priority: string;
    }>;
    browserOptimizations: {
      currentBrowser: string;
      optimizations: string[];
      browserSpecificIssues: string[];
    };
    technicalDetails: {
      resourceBreakdown: Array<{ type: string; percentage: number }>;
    };
    exportOptions: {
      formats: string[];
      downloadLinks: Record<string, string>;
    };
  };
  rawData?: {
    browser: {
      name: string;
      version: string;
      engine: string;
    };
    [key: string]: unknown;
  };
  service?: string;
  status?: string;
  error?: string;
}

describe("Performance Report API Route", () => {
  const mockPerformanceData = {
    timestamp: "2024-08-18T12:00:00.000Z",
    url: "https://example.com",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    vitals: {
      lcp: 2000,
      fcp: 1500,
      cls: 0.05,
      inp: 150,
      ttfb: 300,
    },
    performance: {
      fps: 58,
      averageFps: 55,
      minFps: 45,
      maxFps: 60,
      memoryUsage: 50,
      memoryLimit: 100,
      cpuUsage: 25,
      gpuUsage: 15,
    },
    network: {
      connectionType: "4g",
      effectiveBandwidth: 10,
      rtt: 50,
      saveData: false,
    },
    resources: {
      totalSize: 2000000,
      scriptSize: 800000,
      styleSize: 300000,
      imageSize: 700000,
      fontSize: 200000,
      requestCount: 25,
    },
    browser: {
      name: "",
      version: "",
      engine: "",
      platform: "Win32",
    },
    device: {
      cores: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      platform: "Win32",
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear module cache and re-import to get fresh instance
    vi.resetModules();
    const routeModule = await import("./route");
    GET = routeModule.GET;
    POST = routeModule.POST;
  });

  describe("GET /api/performance-report", () => {
    it("returns health check information", async () => {
      vi.useRealTimers();
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-08-18T12:00:00.000Z"));

      const response = await GET(new NextRequest("http://localhost"));

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.service).toBe("Performance Report Generator");
      expect(result.status).toBe("operational");
      expect(result.timestamp).toBe("2024-08-18T12:00:00.000Z");

      vi.useRealTimers();
    });
  });

  describe("POST /api/performance-report", () => {
    it("generates comprehensive performance report", async () => {
      const request = {
        json: () => Promise.resolve(mockPerformanceData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.success).toBe(true);
      expect(result.timestamp).toBe(mockPerformanceData.timestamp);
      expect(result.report).toBeDefined();
      expect(result.rawData).toEqual(mockPerformanceData);

      // Verify report structure
      expect(result.report!.summary).toBeDefined();
      expect(result.report!.metrics).toBeDefined();
      expect(result.report!.recommendations).toBeDefined();
      expect(result.report!.browserOptimizations).toBeDefined();
      expect(result.report!.technicalDetails).toBeDefined();
      expect(result.report!.exportOptions).toBeDefined();
    });

    it("parses browser information correctly for Chrome", async () => {
      const request = {
        json: () => Promise.resolve(mockPerformanceData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.rawData!.browser.name).toBe("Chrome");
      expect(result.rawData!.browser.version).toBe("91.0.4472.124");
      expect(result.rawData!.browser.engine).toBe("Blink");
    });

    it("parses browser information correctly for Safari", async () => {
      const safariData = {
        ...mockPerformanceData,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.1.1 Safari/537.36",
      };

      const request = {
        json: () => Promise.resolve(safariData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.rawData!.browser.name).toBe("Safari");
      expect(result.rawData!.browser.version).toBe("14.1.1");
      expect(result.rawData!.browser.engine).toBe("WebKit");
    });

    it("parses browser information correctly for Firefox", async () => {
      const firefoxData = {
        ...mockPerformanceData,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
      };

      const request = {
        json: () => Promise.resolve(firefoxData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.rawData!.browser.name).toBe("Firefox");
      expect(result.rawData!.browser.version).toBe("89.0");
      expect(result.rawData!.browser.engine).toBe("Gecko");
    });

    it("calculates overall score correctly for excellent performance", async () => {
      const excellentData = {
        ...mockPerformanceData,
        performance: {
          ...mockPerformanceData.performance,
          fps: 60,
          memoryUsage: 30,
          memoryLimit: 100,
        },
        vitals: {
          lcp: 1500,
          fcp: 1200,
          cls: 0.05,
          inp: 100,
          ttfb: 200,
        },
      };

      const request = {
        json: () => Promise.resolve(excellentData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.report!.summary.overallScore).toBeGreaterThan(85);
      expect(result.report!.summary.grade).toBe("Excellent");
    });

    it("identifies performance issues correctly", async () => {
      const poorData = {
        ...mockPerformanceData,
        performance: {
          ...mockPerformanceData.performance,
          fps: 20, // Poor FPS
          memoryUsage: 85, // High memory usage
          memoryLimit: 100,
        },
        vitals: {
          lcp: 4000, // Poor LCP
          fcp: 3500,
          cls: 0.3, // Poor CLS
          inp: 600,
          ttfb: 2000,
        },
      };

      const request = {
        json: () => Promise.resolve(poorData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.report!.summary.primaryIssues).toContain("Low frame rate");
      expect(result.report!.summary.primaryIssues).toContain(
        "High memory usage",
      );
      expect(result.report!.summary.primaryIssues).toContain("Slow loading");
      expect(result.report!.summary.overallScore).toBeLessThan(60);
    });

    it("generates appropriate recommendations", async () => {
      const problemData = {
        ...mockPerformanceData,
        performance: {
          ...mockPerformanceData.performance,
          fps: 25,
        },
        vitals: {
          lcp: 3000,
          cls: 0.15,
        },
        network: {
          connectionType: "2g",
        },
      };

      const request = {
        json: () => Promise.resolve(problemData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      const recommendations = result.report!.recommendations;

      expect(
        recommendations.some((r: { issue: string }) =>
          r.issue.includes("Low frame rate"),
        ),
      ).toBe(true);
      expect(
        recommendations.some((r: { issue: string }) =>
          r.issue.includes("Largest Contentful Paint"),
        ),
      ).toBe(true);
      expect(
        recommendations.some((r: { issue: string }) =>
          r.issue.includes("Layout shifts"),
        ),
      ).toBe(true);
      expect(
        recommendations.some((r: { issue: string }) =>
          r.issue.includes("Slow network"),
        ),
      ).toBe(true);
    });

    it("provides Safari-specific optimizations", async () => {
      const safariData = {
        ...mockPerformanceData,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.1.1 Safari/537.36",
        performance: {
          ...mockPerformanceData.performance,
          fps: 45, // Below Safari target
        },
      };

      const request = {
        json: () => Promise.resolve(safariData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.report!.browserOptimizations.currentBrowser).toBe("Safari");
      expect(result.report!.browserOptimizations.optimizations).toContain(
        "Use transform instead of changing layout properties",
      );
      expect(
        result.report!.browserOptimizations.browserSpecificIssues,
      ).toContain("Frame rate below Safari target (55 FPS)");
    });

    it("calculates resource breakdown correctly", async () => {
      const request = {
        json: () => Promise.resolve(mockPerformanceData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      const breakdown = result.report!.technicalDetails.resourceBreakdown;

      expect(breakdown).toHaveLength(4);
      expect(breakdown[0].type).toBe("Scripts"); // Largest
      expect(breakdown[0].percentage).toBe(40); // 800000 / 2000000 * 100
      expect(
        breakdown.find(
          (r: { type: string; percentage: number }) => r.type === "Images",
        )!.percentage,
      ).toBe(35);
    });

    it("handles missing memory data gracefully", async () => {
      const dataWithoutMemory = {
        ...mockPerformanceData,
        performance: {
          ...mockPerformanceData.performance,
          memoryUsage: undefined,
          memoryLimit: undefined,
        },
      };

      const request = {
        json: () => Promise.resolve(dataWithoutMemory),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.report!.metrics.performance.memory.status).toBe("Unknown");
      expect(result.report!.summary.overallScore).toBeGreaterThan(0);
    });

    it("validates required fields", async () => {
      const invalidData = {
        userAgent: "test",
        // Missing timestamp and url
      };

      const request = {
        json: () => Promise.resolve(invalidData),
      } as NextRequest;

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({ error: "Missing required fields: timestamp, url" }),
        status: 400,
      });

      await POST(request);

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: "Missing required fields: timestamp, url" },
        { status: 400 },
      );
    });

    it("handles JSON parsing errors", async () => {
      const request = {
        json: () => Promise.reject(new Error("Invalid JSON")),
      } as NextRequest;

      mockNextResponse.json.mockReturnValueOnce({
        json: () => ({ error: "Failed to generate performance report" }),
        status: 500,
      });

      await POST(request);

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: "Failed to generate performance report" },
        { status: 500 },
      );
    });

    it("sets correct FPS targets for different browsers", async () => {
      const chromeRequest = {
        json: () => Promise.resolve(mockPerformanceData),
      } as NextRequest;

      const chromeResponse = await POST(chromeRequest);
      const chromeResult = (await (
        chromeResponse as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(chromeResult.report!.metrics.performance.fps.target).toBe(60);

      const safariData = {
        ...mockPerformanceData,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.1.1 Safari/537.36",
      };

      const safariRequest = {
        json: () => Promise.resolve(safariData),
      } as NextRequest;

      const safariResponse = await POST(safariRequest);
      const safariResult = (await (
        safariResponse as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(safariResult.report!.metrics.performance.fps.target).toBe(55);
    });

    it("includes export options with correct URLs", async () => {
      const request = {
        json: () => Promise.resolve(mockPerformanceData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      const exportOptions = result.report!.exportOptions;

      expect(exportOptions.formats).toEqual(["JSON", "HTML", "CSV"]);
      expect(exportOptions.downloadLinks.json).toContain(
        mockPerformanceData.timestamp,
      );
      expect(exportOptions.downloadLinks.html).toContain("format=html");
      expect(exportOptions.downloadLinks.csv).toContain("format=csv");
    });

    it("handles network connection type scoring", async () => {
      const slowNetworkData = {
        ...mockPerformanceData,
        network: { connectionType: "slow-2g" },
      };

      const request = {
        json: () => Promise.resolve(slowNetworkData),
      } as NextRequest;

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.report!.summary.overallScore).toBeLessThanOrEqual(86);
    });
  });
});
