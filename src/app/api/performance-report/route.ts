import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/utils/dev-logger";
import { withRateLimit } from "@/lib/utils/rate-limiter";

interface PerformanceReportData {
  timestamp: string;
  url: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };

  // Core Web Vitals
  vitals: {
    lcp?: number;
    fcp?: number;
    cls?: number;
    inp?: number;
    ttfb?: number;
  };

  // Performance metrics
  performance: {
    fps?: number;
    averageFps?: number;
    minFps?: number;
    maxFps?: number;
    memoryUsage?: number;
    memoryLimit?: number;
    cpuUsage?: number;
    gpuUsage?: number;
  };

  // Network information
  network: {
    connectionType?: string;
    effectiveBandwidth?: number;
    rtt?: number;
    saveData?: boolean;
  };

  // Resource metrics
  resources: {
    totalSize: number;
    scriptSize: number;
    styleSize: number;
    imageSize: number;
    fontSize: number;
    requestCount: number;
  };

  // Browser information
  browser: {
    name: string;
    version: string;
    engine: string;
    platform: string;
  };

  // Device information
  device: {
    cores: number;
    deviceMemory?: number;
    maxTouchPoints: number;
    platform: string;
  };
}

interface GeneratedReport {
  summary: {
    overallScore: number;
    grade: "Excellent" | "Good" | "Fair" | "Poor";
    primaryIssues: string[];
    strengths: string[];
  };

  metrics: {
    performance: {
      fps: { value: number; status: string; target: number };
      memory: { value: number; status: string; target: number };
      cpu: { value?: number; status: string; target: number };
    };
    vitals: {
      lcp: { value?: number; status: string; target: number };
      fcp: { value?: number; status: string; target: number };
      cls: { value?: number; status: string; target: number };
      inp: { value?: number; status: string; target: number };
      ttfb: { value?: number; status: string; target: number };
    };
  };

  recommendations: Array<{
    category: "Performance" | "Memory" | "Network" | "Browser";
    priority: "High" | "Medium" | "Low";
    issue: string;
    solution: string;
    impact: string;
  }>;

  browserOptimizations: {
    currentBrowser: string;
    optimizations: string[];
    browserSpecificIssues: string[];
  };

  technicalDetails: {
    resourceBreakdown: Array<{
      type: string;
      size: number;
      percentage: number;
    }>;
    performanceTimeline: {
      domContentLoaded?: number;
      loadComplete?: number;
      firstPaint?: number;
    };
  };

  exportOptions: {
    formats: string[];
    downloadLinks: {
      json: string;
      html: string;
      csv: string;
    };
  };
}

function getBrowserInfo(userAgent: string) {
  const ua = userAgent.toLowerCase();

  let name = "Unknown";
  let version = "Unknown";
  let engine = "Unknown";

  if (ua.includes("chrome") && !ua.includes("edg")) {
    name = "Chrome";
    engine = "Blink";
    const match = ua.match(/chrome\/([0-9.]+)/);
    version = match ? match[1] : "Unknown";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    name = "Safari";
    engine = "WebKit";
    const match = ua.match(/version\/([0-9.]+)/);
    version = match ? match[1] : "Unknown";
  } else if (ua.includes("firefox")) {
    name = "Firefox";
    engine = "Gecko";
    const match = ua.match(/firefox\/([0-9.]+)/);
    version = match ? match[1] : "Unknown";
  } else if (ua.includes("edg")) {
    name = "Edge";
    engine = "Blink";
    const match = ua.match(/edg\/([0-9.]+)/);
    version = match ? match[1] : "Unknown";
  }

  return { name, version, engine };
}

function calculateResourceBreakdown(
  resources: PerformanceReportData["resources"],
) {
  const total = resources.totalSize;

  return [
    {
      type: "Scripts",
      size: resources.scriptSize,
      percentage:
        total > 0 ? Math.round((resources.scriptSize / total) * 100) : 0,
    },
    {
      type: "Stylesheets",
      size: resources.styleSize,
      percentage:
        total > 0 ? Math.round((resources.styleSize / total) * 100) : 0,
    },
    {
      type: "Images",
      size: resources.imageSize,
      percentage:
        total > 0 ? Math.round((resources.imageSize / total) * 100) : 0,
    },
    {
      type: "Fonts",
      size: resources.fontSize,
      percentage:
        total > 0 ? Math.round((resources.fontSize / total) * 100) : 0,
    },
  ].sort((a, b) => b.size - a.size);
}

function generateRecommendations(
  data: PerformanceReportData,
): GeneratedReport["recommendations"] {
  const recommendations: GeneratedReport["recommendations"] = [];

  // FPS recommendations
  if (data.performance.fps && data.performance.fps < 30) {
    recommendations.push({
      category: "Performance",
      priority: "High",
      issue: `Low frame rate detected (${data.performance.fps} FPS)`,
      solution:
        "Reduce animation complexity, enable performance mode, or upgrade hardware",
      impact: "Improved user experience and smoother interactions",
    });
  }

  // Memory recommendations - handle null/undefined values
  const memoryPercentage =
    data.performance.memoryUsage && data.performance.memoryLimit
      ? (data.performance.memoryUsage / data.performance.memoryLimit) * 100
      : null;

  if (memoryPercentage !== null && memoryPercentage > 80) {
    recommendations.push({
      category: "Memory",
      priority: "High",
      issue: `High memory usage (${Math.round(memoryPercentage)}%)`,
      solution:
        "Check for memory leaks, reduce concurrent operations, clear unused data",
      impact: "Prevent browser crashes and improve stability",
    });
  }

  // Core Web Vitals recommendations
  if (data.vitals.lcp && data.vitals.lcp > 2500) {
    recommendations.push({
      category: "Performance",
      priority: "High",
      issue: `Poor Largest Contentful Paint (${Math.round(data.vitals.lcp)}ms)`,
      solution: "Optimize images, reduce render-blocking resources, use CDN",
      impact: "Faster perceived loading and better user experience",
    });
  }

  if (data.vitals.cls && data.vitals.cls > 0.1) {
    recommendations.push({
      category: "Performance",
      priority: "Medium",
      issue: `Layout shifts detected (CLS: ${data.vitals.cls.toFixed(3)})`,
      solution:
        "Set explicit dimensions for images, avoid inserting content above existing content",
      impact: "Reduce visual instability and improve user experience",
    });
  }

  // Network recommendations
  if (
    data.network.connectionType === "2g" ||
    data.network.connectionType === "slow-2g"
  ) {
    recommendations.push({
      category: "Network",
      priority: "Medium",
      issue: "Slow network connection detected",
      solution:
        "Enable data saver mode, reduce resource sizes, implement progressive loading",
      impact: "Better performance on slow connections",
    });
  }

  // Browser-specific recommendations
  if (data.browser.name === "Safari") {
    if (data.performance.fps && data.performance.fps < 55) {
      recommendations.push({
        category: "Browser",
        priority: "Medium",
        issue: "Safari performance could be improved",
        solution:
          "Reduce backdrop-filter usage, minimize complex animations, use transform instead of changing layout properties",
        impact: "Better performance on Safari and iOS devices",
      });
    }
  }

  return recommendations;
}

function calculateOverallScore(data: PerformanceReportData): number {
  let score = 100;

  // FPS score (30% weight)
  if (data.performance.fps) {
    const fpsScore = Math.min(data.performance.fps / 60, 1) * 30;
    score = score - 30 + fpsScore;
  }

  // Core Web Vitals score (40% weight)
  let vitalsScore = 40;

  if (data.vitals.lcp) {
    const lcpScore =
      data.vitals.lcp <= 2500 ? 10 : data.vitals.lcp <= 4000 ? 7 : 3;
    vitalsScore = vitalsScore - 10 + lcpScore;
  }

  if (data.vitals.cls) {
    const clsScore =
      data.vitals.cls <= 0.1 ? 10 : data.vitals.cls <= 0.25 ? 7 : 3;
    vitalsScore = vitalsScore - 10 + clsScore;
  }

  if (data.vitals.fcp) {
    const fcpScore =
      data.vitals.fcp <= 1800 ? 10 : data.vitals.fcp <= 3000 ? 7 : 3;
    vitalsScore = vitalsScore - 10 + fcpScore;
  }

  if (data.vitals.inp) {
    const inpScore =
      data.vitals.inp <= 200 ? 10 : data.vitals.inp <= 500 ? 7 : 3;
    vitalsScore = vitalsScore - 10 + inpScore;
  }

  score = score - 40 + vitalsScore;

  // Memory score (20% weight) - handle null memory data
  const memoryPercentageForScore =
    data.performance.memoryUsage && data.performance.memoryLimit
      ? (data.performance.memoryUsage / data.performance.memoryLimit) * 100
      : null;
  let memoryScore = 15; // Default neutral score when memory data unavailable
  if (memoryPercentageForScore !== null) {
    memoryScore =
      memoryPercentageForScore < 50
        ? 20
        : memoryPercentageForScore < 80
          ? 15
          : 10;
  }
  score = score - 20 + memoryScore;

  // Network score (10% weight)
  let networkScore = 10;
  if (data.network.connectionType) {
    switch (data.network.connectionType) {
      case "4g":
        networkScore = 10;
        break;
      case "3g":
        networkScore = 7;
        break;
      case "2g":
        networkScore = 4;
        break;
      case "slow-2g":
        networkScore = 2;
        break;
    }
  }
  score = score - 10 + networkScore;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getGrade(score: number): "Excellent" | "Good" | "Fair" | "Poor" {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  return "Poor";
}

async function postHandler(request: NextRequest) {
  try {
    const data: PerformanceReportData = await request.json();

    // Validate required fields
    if (!data.timestamp || !data.url) {
      return NextResponse.json(
        { error: "Missing required fields: timestamp, url" },
        { status: 400 },
      );
    }

    // Parse browser information
    const browserInfo = getBrowserInfo(data.userAgent);
    data.browser = {
      ...data.browser,
      ...browserInfo,
    };

    // Calculate overall performance score
    const overallScore = calculateOverallScore(data);
    const grade = getGrade(overallScore);

    // Generate recommendations
    const recommendations = generateRecommendations(data);

    // Calculate resource breakdown
    const resourceBreakdown = calculateResourceBreakdown(data.resources);

    // Identify primary issues and strengths
    const primaryIssues: string[] = [];
    const strengths: string[] = [];

    if (data.performance.fps && data.performance.fps < 30) {
      primaryIssues.push("Low frame rate");
    } else if (data.performance.fps && data.performance.fps >= 55) {
      strengths.push("Smooth animations");
    }

    if (data.vitals.lcp && data.vitals.lcp > 2500) {
      primaryIssues.push("Slow loading");
    } else if (data.vitals.lcp && data.vitals.lcp <= 1800) {
      strengths.push("Fast loading");
    }

    const memoryPercentage =
      data.performance.memoryUsage && data.performance.memoryLimit
        ? (data.performance.memoryUsage / data.performance.memoryLimit) * 100
        : null;

    if (memoryPercentage !== null) {
      if (memoryPercentage > 80) {
        primaryIssues.push("High memory usage");
      } else if (memoryPercentage < 50) {
        strengths.push("Efficient memory usage");
      }
    }

    // Generate browser-specific optimizations
    const browserOptimizations: string[] = [];
    const browserSpecificIssues: string[] = [];

    if (data.browser.name === "Safari") {
      browserOptimizations.push(
        "Use transform instead of changing layout properties",
      );
      browserOptimizations.push("Minimize backdrop-filter usage");
      browserOptimizations.push("Reduce complex CSS animations");

      if (data.performance.fps && data.performance.fps < 55) {
        browserSpecificIssues.push("Frame rate below Safari target (55 FPS)");
      }
    } else if (data.browser.name === "Chrome") {
      browserOptimizations.push("Leverage Chrome's GPU acceleration");
      browserOptimizations.push(
        "Use Chrome DevTools for performance profiling",
      );

      if (data.performance.fps && data.performance.fps < 60) {
        browserSpecificIssues.push("Frame rate below Chrome target (60 FPS)");
      }
    }

    // Create the comprehensive report
    const report: GeneratedReport = {
      summary: {
        overallScore,
        grade,
        primaryIssues,
        strengths,
      },

      metrics: {
        performance: {
          fps: {
            value: data.performance.fps || 0,
            status: !data.performance.fps
              ? "Unknown"
              : data.performance.fps >= 55
                ? "Excellent"
                : data.performance.fps >= 40
                  ? "Good"
                  : data.performance.fps >= 25
                    ? "Fair"
                    : "Poor",
            target: data.browser.name === "Safari" ? 55 : 60,
          },
          memory: {
            value: memoryPercentage !== null ? memoryPercentage : 0,
            status:
              memoryPercentage === null
                ? "Unknown"
                : memoryPercentage < 50
                  ? "Excellent"
                  : memoryPercentage < 70
                    ? "Good"
                    : memoryPercentage < 85
                      ? "Fair"
                      : "Poor",
            target: 50,
          },
          cpu: {
            value: data.performance.cpuUsage,
            status: !data.performance.cpuUsage
              ? "Unknown"
              : data.performance.cpuUsage < 30
                ? "Excellent"
                : data.performance.cpuUsage < 50
                  ? "Good"
                  : data.performance.cpuUsage < 70
                    ? "Fair"
                    : "Poor",
            target: 50,
          },
        },

        vitals: {
          lcp: {
            value: data.vitals.lcp,
            status: !data.vitals.lcp
              ? "Measuring"
              : data.vitals.lcp <= 2500
                ? "Good"
                : data.vitals.lcp <= 4000
                  ? "Needs Improvement"
                  : "Poor",
            target: 2500,
          },
          fcp: {
            value: data.vitals.fcp,
            status: !data.vitals.fcp
              ? "Measuring"
              : data.vitals.fcp <= 1800
                ? "Good"
                : data.vitals.fcp <= 3000
                  ? "Needs Improvement"
                  : "Poor",
            target: 1800,
          },
          cls: {
            value: data.vitals.cls,
            status: !data.vitals.cls
              ? "Measuring"
              : data.vitals.cls <= 0.1
                ? "Good"
                : data.vitals.cls <= 0.25
                  ? "Needs Improvement"
                  : "Poor",
            target: 0.1,
          },
          inp: {
            value: data.vitals.inp,
            status: !data.vitals.inp
              ? "Measuring"
              : data.vitals.inp <= 200
                ? "Good"
                : data.vitals.inp <= 500
                  ? "Needs Improvement"
                  : "Poor",
            target: 200,
          },
          ttfb: {
            value: data.vitals.ttfb,
            status: !data.vitals.ttfb
              ? "Measuring"
              : data.vitals.ttfb <= 800
                ? "Good"
                : data.vitals.ttfb <= 1800
                  ? "Needs Improvement"
                  : "Poor",
            target: 800,
          },
        },
      },

      recommendations,

      browserOptimizations: {
        currentBrowser: data.browser.name,
        optimizations: browserOptimizations,
        browserSpecificIssues,
      },

      technicalDetails: {
        resourceBreakdown,
        performanceTimeline: {
          domContentLoaded: data.vitals.fcp,
          loadComplete: data.vitals.lcp,
          firstPaint: data.vitals.fcp,
        },
      },

      exportOptions: {
        formats: ["JSON", "HTML", "CSV"],
        downloadLinks: {
          json: `/api/performance-report/export?format=json&timestamp=${data.timestamp}`,
          html: `/api/performance-report/export?format=html&timestamp=${data.timestamp}`,
          csv: `/api/performance-report/export?format=csv&timestamp=${data.timestamp}`,
        },
      },
    };

    return NextResponse.json({
      success: true,
      timestamp: data.timestamp,
      report,
      rawData: data,
    });
  } catch (error) {
    logError(error, "Performance report generation error");
    return NextResponse.json(
      { error: "Failed to generate performance report" },
      { status: 500 },
    );
  }
}

async function getHandler(_request: NextRequest) {
  return NextResponse.json({
    service: "Performance Report Generator",
    status: "operational",
    timestamp: new Date().toISOString(),
  });
}

// API route handler
export async function GET(request: NextRequest) {
  return withRateLimit(getHandler)(request);
}

export const POST = withRateLimit(postHandler);
