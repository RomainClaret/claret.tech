/**
 * Performance History Tracking System
 * Manages performance metrics, trends, and regression detection
 */

import fs from "fs";
import path from "path";
import { logError, logWarning } from "@/lib/utils/dev-logger";

export interface PerformanceMetric {
  id: string;
  timestamp: string;
  browserName: string;
  testType: "lighthouse" | "playwright" | "real-user" | "load-test";

  // Core metrics
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };

  // Core Web Vitals
  vitals: {
    fcp: number;
    lcp: number;
    cls: number;
    fid?: number;
    inp?: number;
    ttfb: number;
    tbt: number;
    si: number;
    tti: number;
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

  // Performance metrics
  runtime: {
    fps?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    gpuUsage?: number;
    longTasks: number;
  };

  // Test context
  context: {
    url: string;
    viewport: { width: number; height: number };
    connectionType?: string;
    userAgent?: string;
    buildVersion?: string;
    commitHash?: string;
  };

  // Budget violations
  budgetViolations: Array<{
    metric: string;
    actual: number;
    budget: number;
    severity: "error" | "warning";
  }>;
}

export interface PerformanceTrend {
  metric: string;
  browserName: string;
  dataPoints: Array<{
    timestamp: string;
    value: number;
  }>;
  trend: "improving" | "degrading" | "stable";
  changePercent: number;
  currentValue: number;
  baselineValue: number;
}

export interface RegressionDetection {
  hasRegression: boolean;
  regressions: Array<{
    metric: string;
    current: number;
    baseline: number;
    changePercent: number;
    severity: "critical" | "major" | "minor";
    threshold: number;
  }>;
  timestamp: string;
  browserName: string;
}

export class PerformanceTracker {
  private historyFile: string;
  private resultsDir: string;

  // Regression thresholds
  private static readonly REGRESSION_THRESHOLDS = {
    critical: 0.2, // 20% degradation
    major: 0.15, // 15% degradation
    minor: 0.1, // 10% degradation
  };

  // Performance baselines for different browsers
  private static readonly PERFORMANCE_BASELINES = {
    chromium: {
      performance: 90,
      fcp: 1800,
      lcp: 2500,
      cls: 0.1,
      tbt: 300,
      tti: 3800,
      fps: 60,
    },
    webkit: {
      performance: 85,
      fcp: 2000,
      lcp: 3000,
      cls: 0.15,
      tbt: 400,
      tti: 4000,
      fps: 55,
    },
    firefox: {
      performance: 88,
      fcp: 1900,
      lcp: 2700,
      cls: 0.1,
      tbt: 350,
      tti: 3900,
      fps: 58,
    },
  };

  constructor(resultsDir: string = "test-results/performance") {
    this.resultsDir = path.resolve(resultsDir);
    this.historyFile = path.join(this.resultsDir, "performance-history.json");

    // Ensure directories exist
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Record a performance metric
   */
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    const history = this.loadHistory();

    // Add unique ID if not provided
    if (!metric.id) {
      metric.id = await this.generateMetricId(metric);
    }

    history.push(metric);

    // Keep only last 1000 records to prevent file bloat
    const trimmedHistory = history.slice(-1000);

    this.saveHistory(trimmedHistory);

    // Also save individual metric file
    this.saveIndividualMetric(metric);
  }

  /**
   * Get performance history for a specific browser
   */
  getHistory(browserName?: string, limit?: number): PerformanceMetric[] {
    const history = this.loadHistory();

    const filtered = browserName
      ? history.filter((m) => m.browserName === browserName)
      : history;

    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(
    currentMetric: PerformanceMetric,
    baselineCount: number = 10,
  ): RegressionDetection {
    const history = this.getHistory(
      currentMetric.browserName,
      baselineCount + 1,
    );

    if (history.length < 2) {
      return {
        hasRegression: false,
        regressions: [],
        timestamp: currentMetric.timestamp,
        browserName: currentMetric.browserName,
      };
    }

    // Calculate baseline from recent history (excluding current)
    const baseline = this.calculateBaseline(history.slice(0, -1));
    const regressions: RegressionDetection["regressions"] = [];

    // Check performance score
    const perfChange = this.calculateChangePercent(
      baseline.scores.performance,
      currentMetric.scores.performance,
    );
    if (Math.abs(perfChange) > PerformanceTracker.REGRESSION_THRESHOLDS.minor) {
      regressions.push({
        metric: "Performance Score",
        current: currentMetric.scores.performance,
        baseline: baseline.scores.performance,
        changePercent: perfChange,
        severity: this.getSeverity(Math.abs(perfChange)),
        threshold: PerformanceTracker.REGRESSION_THRESHOLDS.minor,
      });
    }

    // Check Core Web Vitals
    const vitalChecks = [
      {
        name: "FCP",
        current: currentMetric.vitals.fcp,
        baseline: baseline.vitals.fcp,
      },
      {
        name: "LCP",
        current: currentMetric.vitals.lcp,
        baseline: baseline.vitals.lcp,
      },
      {
        name: "CLS",
        current: currentMetric.vitals.cls,
        baseline: baseline.vitals.cls,
      },
      {
        name: "TBT",
        current: currentMetric.vitals.tbt,
        baseline: baseline.vitals.tbt,
      },
      {
        name: "TTI",
        current: currentMetric.vitals.tti,
        baseline: baseline.vitals.tti,
      },
    ];

    vitalChecks.forEach((check) => {
      const change = this.calculateChangePercent(check.baseline, check.current);
      if (Math.abs(change) > PerformanceTracker.REGRESSION_THRESHOLDS.minor) {
        regressions.push({
          metric: check.name,
          current: check.current,
          baseline: check.baseline,
          changePercent: change,
          severity: this.getSeverity(Math.abs(change)),
          threshold: PerformanceTracker.REGRESSION_THRESHOLDS.minor,
        });
      }
    });

    // Check FPS if available
    if (currentMetric.runtime.fps && baseline.runtime.fps) {
      const fpsChange = this.calculateChangePercent(
        baseline.runtime.fps,
        currentMetric.runtime.fps,
      );
      if (
        Math.abs(fpsChange) > PerformanceTracker.REGRESSION_THRESHOLDS.minor
      ) {
        regressions.push({
          metric: "FPS",
          current: currentMetric.runtime.fps,
          baseline: baseline.runtime.fps,
          changePercent: fpsChange,
          severity: this.getSeverity(Math.abs(fpsChange)),
          threshold: PerformanceTracker.REGRESSION_THRESHOLDS.minor,
        });
      }
    }

    return {
      hasRegression: regressions.length > 0,
      regressions,
      timestamp: currentMetric.timestamp,
      browserName: currentMetric.browserName,
    };
  }

  /**
   * Generate performance trends
   */
  generateTrends(browserName: string, days: number = 30): PerformanceTrend[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const history = this.getHistory(browserName)
      .filter((m) => new Date(m.timestamp) >= cutoffDate)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    if (history.length < 2) {
      return [];
    }

    const trends: PerformanceTrend[] = [];

    // Performance score trend
    trends.push(
      this.calculateTrend(
        "Performance Score",
        browserName,
        history,
        (m) => m.scores.performance,
      ),
    );

    // Core Web Vitals trends
    trends.push(
      this.calculateTrend("FCP", browserName, history, (m) => m.vitals.fcp),
    );
    trends.push(
      this.calculateTrend("LCP", browserName, history, (m) => m.vitals.lcp),
    );
    trends.push(
      this.calculateTrend("CLS", browserName, history, (m) => m.vitals.cls),
    );
    trends.push(
      this.calculateTrend("TBT", browserName, history, (m) => m.vitals.tbt),
    );
    trends.push(
      this.calculateTrend("TTI", browserName, history, (m) => m.vitals.tti),
    );

    // FPS trend if available
    const fpsData = history.filter((m) => m.runtime.fps !== undefined);
    if (fpsData.length >= 2) {
      trends.push(
        this.calculateTrend("FPS", browserName, fpsData, (m) => m.runtime.fps!),
      );
    }

    return trends;
  }

  /**
   * Generate cross-browser comparison
   */
  generateCrossBrowserComparison(): {
    timestamp: string;
    browsers: Record<string, PerformanceMetric | null>;
    summary: {
      bestPerformance: string;
      worstPerformance: string;
      avgPerformanceScore: number;
      criticalIssues: string[];
    };
  } {
    const browsers = ["chromium", "webkit", "firefox"];
    const latestMetrics: Record<string, PerformanceMetric | null> = {};

    // Get latest metrics for each browser
    browsers.forEach((browser) => {
      const browserHistory = this.getHistory(browser, 1);
      latestMetrics[browser] =
        browserHistory.length > 0 ? browserHistory[0] : null;
    });

    const validMetrics = Object.values(latestMetrics).filter(
      Boolean,
    ) as PerformanceMetric[];

    const summary = {
      bestPerformance: "unknown",
      worstPerformance: "unknown",
      avgPerformanceScore: 0,
      criticalIssues: [] as string[],
    };

    if (validMetrics.length > 0) {
      // Calculate average performance score
      summary.avgPerformanceScore =
        validMetrics.reduce((sum, m) => sum + m.scores.performance, 0) /
        validMetrics.length;

      // Find best and worst performers
      const sortedByPerf = validMetrics.sort(
        (a, b) => b.scores.performance - a.scores.performance,
      );
      summary.bestPerformance = sortedByPerf[0].browserName;
      summary.worstPerformance =
        sortedByPerf[sortedByPerf.length - 1].browserName;

      // Identify critical issues
      validMetrics.forEach((metric) => {
        if (metric.scores.performance < 80) {
          summary.criticalIssues.push(
            `${metric.browserName}: Performance score below 80 (${metric.scores.performance})`,
          );
        }
        if (metric.vitals.lcp > 4000) {
          summary.criticalIssues.push(
            `${metric.browserName}: LCP above 4s (${metric.vitals.lcp.toFixed(0)}ms)`,
          );
        }
        if (metric.vitals.cls > 0.25) {
          summary.criticalIssues.push(
            `${metric.browserName}: CLS above 0.25 (${metric.vitals.cls.toFixed(3)})`,
          );
        }
        if (metric.runtime.fps && metric.runtime.fps < 30) {
          summary.criticalIssues.push(
            `${metric.browserName}: FPS below 30 (${metric.runtime.fps.toFixed(1)})`,
          );
        }
      });
    }

    return {
      timestamp: new Date().toISOString(),
      browsers: latestMetrics,
      summary,
    };
  }

  /**
   * Export performance data for external analysis
   */
  exportData(format: "json" | "csv" = "json", browserName?: string): string {
    const history = this.getHistory(browserName);

    if (format === "csv") {
      return this.convertToCSV(history);
    }

    return JSON.stringify(history, null, 2);
  }

  /**
   * Clear old performance data
   */
  cleanup(daysToKeep: number = 90): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const history = this.loadHistory().filter(
      (m) => new Date(m.timestamp) >= cutoffDate,
    );

    this.saveHistory(history);

    // Clean up individual metric files
    this.cleanupIndividualMetrics(cutoffDate);
  }

  // Private helper methods
  private loadHistory(): PerformanceMetric[] {
    if (!fs.existsSync(this.historyFile)) {
      return [];
    }

    try {
      const data = fs.readFileSync(this.historyFile, "utf8");
      return JSON.parse(data);
    } catch {
      logWarning("Failed to load performance history", "Performance Tracker");
      return [];
    }
  }

  private saveHistory(history: PerformanceMetric[]): void {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      logError(error, "Performance Tracker - History Save");
    }
  }

  private saveIndividualMetric(metric: PerformanceMetric): void {
    const filename = `${metric.browserName}-${metric.timestamp.replace(/[:.]/g, "-")}.json`;
    const filepath = path.join(this.resultsDir, "individual", filename);

    // Ensure individual directory exists
    const individualDir = path.dirname(filepath);
    if (!fs.existsSync(individualDir)) {
      fs.mkdirSync(individualDir, { recursive: true });
    }

    try {
      fs.writeFileSync(filepath, JSON.stringify(metric, null, 2));
    } catch {
      logWarning("Failed to save individual metric", "Performance Tracker");
    }
  }

  private async generateMetricId(metric: PerformanceMetric): Promise<string> {
    const timestamp = new Date(metric.timestamp).getTime();
    const crypto = await import("node:crypto");
    const hash = crypto
      .createHash("md5")
      .update(`${metric.browserName}-${metric.testType}-${timestamp}`)
      .digest("hex")
      .substring(0, 8);
    return `${metric.browserName}-${metric.testType}-${hash}`;
  }

  private calculateBaseline(history: PerformanceMetric[]): PerformanceMetric {
    if (history.length === 0) {
      throw new Error("Cannot calculate baseline from empty history");
    }

    // Create average baseline from recent history
    const baseline: PerformanceMetric = {
      id: "baseline",
      timestamp: new Date().toISOString(),
      browserName: history[0].browserName,
      testType: "lighthouse",
      scores: {
        performance: this.average(history, (m) => m.scores.performance),
        accessibility: this.average(history, (m) => m.scores.accessibility),
        bestPractices: this.average(history, (m) => m.scores.bestPractices),
        seo: this.average(history, (m) => m.scores.seo),
      },
      vitals: {
        fcp: this.average(history, (m) => m.vitals.fcp),
        lcp: this.average(history, (m) => m.vitals.lcp),
        cls: this.average(history, (m) => m.vitals.cls),
        ttfb: this.average(history, (m) => m.vitals.ttfb),
        tbt: this.average(history, (m) => m.vitals.tbt),
        si: this.average(history, (m) => m.vitals.si),
        tti: this.average(history, (m) => m.vitals.tti),
      },
      resources: {
        totalSize: this.average(history, (m) => m.resources.totalSize),
        scriptSize: this.average(history, (m) => m.resources.scriptSize),
        styleSize: this.average(history, (m) => m.resources.styleSize),
        imageSize: this.average(history, (m) => m.resources.imageSize),
        fontSize: this.average(history, (m) => m.resources.fontSize),
        requestCount: this.average(history, (m) => m.resources.requestCount),
      },
      runtime: {
        fps: this.average(history, (m) => m.runtime.fps || 0) || undefined,
        cpuUsage:
          this.average(history, (m) => m.runtime.cpuUsage || 0) || undefined,
        memoryUsage:
          this.average(history, (m) => m.runtime.memoryUsage || 0) || undefined,
        gpuUsage:
          this.average(history, (m) => m.runtime.gpuUsage || 0) || undefined,
        longTasks: this.average(history, (m) => m.runtime.longTasks),
      },
      context: history[0].context, // Use most recent context
      budgetViolations: [],
    };

    return baseline;
  }

  private average(
    items: PerformanceMetric[],
    selector: (item: PerformanceMetric) => number,
  ): number {
    const values = items
      .map(selector)
      .filter((v) => v !== undefined && v !== null);
    return values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  }

  private calculateChangePercent(baseline: number, current: number): number {
    if (baseline === 0) return 0;
    return ((current - baseline) / baseline) * 100;
  }

  private getSeverity(changePercent: number): "critical" | "major" | "minor" {
    if (changePercent >= PerformanceTracker.REGRESSION_THRESHOLDS.critical)
      return "critical";
    if (changePercent >= PerformanceTracker.REGRESSION_THRESHOLDS.major)
      return "major";
    return "minor";
  }

  private calculateTrend(
    metricName: string,
    browserName: string,
    history: PerformanceMetric[],
    valueExtractor: (metric: PerformanceMetric) => number,
  ): PerformanceTrend {
    const dataPoints = history.map((m) => ({
      timestamp: m.timestamp,
      value: valueExtractor(m),
    }));

    const firstValue = dataPoints[0].value;
    const lastValue = dataPoints[dataPoints.length - 1].value;
    const changePercent = this.calculateChangePercent(firstValue, lastValue);

    let trend: "improving" | "degrading" | "stable";
    if (Math.abs(changePercent) < 5) {
      trend = "stable";
    } else if (metricName === "Performance Score" || metricName === "FPS") {
      // Higher is better for these metrics
      trend = changePercent > 0 ? "improving" : "degrading";
    } else {
      // Lower is better for timing metrics
      trend = changePercent < 0 ? "improving" : "degrading";
    }

    return {
      metric: metricName,
      browserName,
      dataPoints,
      trend,
      changePercent,
      currentValue: lastValue,
      baselineValue: firstValue,
    };
  }

  private convertToCSV(history: PerformanceMetric[]): string {
    if (history.length === 0) return "";

    const headers = [
      "timestamp",
      "browserName",
      "testType",
      "performance",
      "accessibility",
      "bestPractices",
      "seo",
      "fcp",
      "lcp",
      "cls",
      "tbt",
      "tti",
      "fps",
      "totalSize",
      "requestCount",
    ];

    const rows = history.map((m) => [
      m.timestamp,
      m.browserName,
      m.testType,
      m.scores.performance,
      m.scores.accessibility,
      m.scores.bestPractices,
      m.scores.seo,
      m.vitals.fcp,
      m.vitals.lcp,
      m.vitals.cls,
      m.vitals.tbt,
      m.vitals.tti,
      m.runtime.fps || "",
      m.resources.totalSize,
      m.resources.requestCount,
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  private cleanupIndividualMetrics(cutoffDate: Date): void {
    const individualDir = path.join(this.resultsDir, "individual");
    if (!fs.existsSync(individualDir)) return;

    try {
      const files = fs.readdirSync(individualDir);
      files.forEach((file) => {
        const filepath = path.join(individualDir, file);
        const stats = fs.statSync(filepath);
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filepath);
        }
      });
    } catch {
      logWarning("Failed to cleanup individual metrics", "Performance Tracker");
    }
  }
}
