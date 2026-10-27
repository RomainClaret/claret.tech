import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { NextResponse, NextRequest } from "next/server";

// Dynamic import to avoid cache issues
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
  };
  error?: string;
}

/** A POST as a browser sends it: JSON, with its length declared. */
function post(
  body: unknown,
  headers: Record<string, string> = { "content-type": "application/json" },
) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    headers: new Headers({
      "content-length": String(new TextEncoder().encode(text).length),
      ...headers,
    }),
    text: () => Promise.resolve(text),
  } as unknown as NextRequest;
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
    POST = routeModule.POST;
  });

  it("has no GET: nothing called its status answer", async () => {
    const route = await import("./route");
    expect("GET" in route).toBe(false);
  });

  describe("POST /api/performance-report", () => {
    it("generates comprehensive performance report", async () => {
      const request = post(mockPerformanceData);

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.success).toBe(true);
      expect(result.timestamp).toBe(mockPerformanceData.timestamp);
      expect(result.report).toBeDefined();

      // Verify report structure
      expect(result.report!.summary).toBeDefined();
      expect(result.report!.metrics).toBeDefined();
      expect(result.report!.recommendations).toBeDefined();
      expect(result.report!.browserOptimizations).toBeDefined();
      expect(result.report!.technicalDetails).toBeDefined();
    });

    it("parses browser information correctly for Chrome", async () => {
      const request = post(mockPerformanceData);

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      // The report names the browser it parsed from the user agent.
      expect(result.report!.browserOptimizations.currentBrowser).toBe("Chrome");
    });

    it("parses browser information correctly for Safari", async () => {
      const safariData = {
        ...mockPerformanceData,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.1.1 Safari/537.36",
      };

      const request = post(safariData);

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      // The report names the browser it parsed from the user agent.
      expect(result.report!.browserOptimizations.currentBrowser).toBe("Safari");
    });

    it("parses browser information correctly for Firefox", async () => {
      const firefoxData = {
        ...mockPerformanceData,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
      };

      const request = post(firefoxData);

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      // The report names the browser it parsed from the user agent.
      expect(result.report!.browserOptimizations.currentBrowser).toBe(
        "Firefox",
      );
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

      const request = post(excellentData);

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

      const request = post(poorData);

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

      const request = post(problemData);

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

      const request = post(safariData);

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
      const request = post(mockPerformanceData);

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

      const request = post(dataWithoutMemory);

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

      const request = post(invalidData);

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
      await POST(post("{not json"));

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: "Not a report" },
        { status: 400 },
      );
    });

    it("sets correct FPS targets for different browsers", async () => {
      const chromeRequest = post(mockPerformanceData);

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

      const safariRequest = post(safariData);

      const safariResponse = await POST(safariRequest);
      const safariResult = (await (
        safariResponse as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(safariResult.report!.metrics.performance.fps.target).toBe(55);
    });

    it("echoes nothing it was sent beyond the report", async () => {
      // It returned the whole body as rawData, and the timestamp four more
      // times in links to an /export route that does not exist: 1 MiB in,
      // 5 MiB out (security audit run 1, hardening).
      const response = await POST(post(mockPerformanceData));

      const result = (await (response as APIResponse).json()) as Record<
        string,
        unknown
      >;
      expect(result).not.toHaveProperty("rawData");
      expect(result.report).not.toHaveProperty("exportOptions");
    });

    it("takes JSON only, of at most 16 KiB, with a short timestamp and URL", async () => {
      await POST(post(mockPerformanceData, { "content-type": "text/plain" }));
      expect(mockNextResponse.json).toHaveBeenLastCalledWith(
        { error: "A report is JSON" },
        { status: 415 },
      );

      await POST(post({ ...mockPerformanceData, pad: "x".repeat(17_000) }));
      expect(mockNextResponse.json).toHaveBeenLastCalledWith(
        { error: "Report too large" },
        { status: 413 },
      );

      await POST(post({ ...mockPerformanceData, timestamp: "x".repeat(33) }));
      expect(mockNextResponse.json).toHaveBeenLastCalledWith(
        { error: "Missing required fields: timestamp, url" },
        { status: 400 },
      );
    });

    it("handles network connection type scoring", async () => {
      const slowNetworkData = {
        ...mockPerformanceData,
        network: { connectionType: "slow-2g" },
      };

      const request = post(slowNetworkData);

      const response = await POST(request);

      const result = (await (
        response as APIResponse
      ).json()) as PerformanceReportResponse;
      expect(result.report!.summary.overallScore).toBeLessThanOrEqual(86);
    });
  });
});
