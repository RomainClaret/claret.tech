/**
 * Performance logging utilities for Safari optimization analysis
 */

import { logWarning } from "@/lib/utils/dev-logger";

interface PerformanceLog {
  timestamp: number;
  fps: number;
  averageFps: number;
  minFps: number;
  maxFps: number;
  activeAnimations: number;
  gpuLayers: number;
  browser: string;
  optimizationStatus: string;
  page: string;
  userAgent: string;
}

interface PerformanceSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  logs: PerformanceLog[];
  browserInfo: {
    name: string;
    isSafari: boolean;
    optimizationsEnabled: boolean;
  };
  summary?: {
    averageFps: number;
    minFps: number;
    maxFps: number;
    averageAnimations: number;
    averageGpuLayers: number;
    lowFpsEvents: number;
    highAnimationEvents: number;
  } | null;
}

class PerformanceLogger {
  private session: PerformanceSession | null = null;
  private logInterval: NodeJS.Timeout | null = null;
  private readonly LOG_INTERVAL = 2000; // Log every 2 seconds

  startLogging(browserInfo: {
    name: string;
    isSafari: boolean;
    optimizationsEnabled: boolean;
  }) {
    this.session = {
      sessionId: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      logs: [],
      browserInfo,
    };

    // Log initial state
    this.logCurrentState();

    // Start periodic logging
    this.logInterval = setInterval(() => {
      this.logCurrentState();
    }, this.LOG_INTERVAL);
  }

  stopLogging() {
    if (this.logInterval) {
      clearInterval(this.logInterval);
      this.logInterval = null;
    }

    if (this.session) {
      this.exportToConsole();
      this.session = null;
    }
  }

  private logCurrentState() {
    if (!this.session) return;

    // Gather current performance metrics - only count if animations are enabled
    const activeAnimations = document.body.classList.contains(
      "enable-animations",
    )
      ? document.querySelectorAll('[style*="animation"], .animate-').length
      : 0;
    const gpuLayers = document.body.classList.contains("enable-animations")
      ? document.querySelectorAll(
          '[style*="will-change"], [style*="translateZ"], [style*="translate3d"], .gpu-layer',
        ).length
      : 0;

    // Get FPS from performance monitor if available
    const performanceMonitor = (
      window as unknown as {
        __performanceMonitor?: {
          fps?: number;
          averageFps?: number;
          minFps?: number;
          maxFps?: number;
        };
      }
    ).__performanceMonitor;

    const log: PerformanceLog = {
      timestamp: Date.now(),
      fps: performanceMonitor?.fps || 60,
      averageFps: performanceMonitor?.averageFps || 60,
      minFps: performanceMonitor?.minFps || 60,
      maxFps: performanceMonitor?.maxFps || 60,
      activeAnimations,
      gpuLayers,
      browser: this.session.browserInfo.name,
      optimizationStatus: this.session.browserInfo.optimizationsEnabled
        ? "Optimized"
        : "Standard",
      page: window.location.pathname,
      userAgent: navigator.userAgent,
    };

    this.session.logs.push(log);

    // Log significant events
    if (log.fps < 30) {
      logWarning(
        "Performance degradation detected: FPS below 30",
        "Performance Logger",
      );
    }
  }

  private getSessionAverageFps(): number {
    if (!this.session || this.session.logs.length === 0) return 0;

    const totalFps = this.session.logs.reduce((sum, log) => sum + log.fps, 0);
    return Math.round(totalFps / this.session.logs.length);
  }

  private getSessionSummary() {
    if (!this.session || this.session.logs.length === 0) return null;

    const logs = this.session.logs;
    const fpsList = logs.map((log) => log.fps);
    const animationsList = logs.map((log) => log.activeAnimations);
    const gpuLayersList = logs.map((log) => log.gpuLayers);

    return {
      averageFps: Math.round(
        fpsList.reduce((a, b) => a + b, 0) / fpsList.length,
      ),
      minFps: Math.min(...fpsList),
      maxFps: Math.max(...fpsList),
      averageAnimations: Math.round(
        animationsList.reduce((a, b) => a + b, 0) / animationsList.length,
      ),
      averageGpuLayers: Math.round(
        gpuLayersList.reduce((a, b) => a + b, 0) / gpuLayersList.length,
      ),
      lowFpsEvents: fpsList.filter((fps) => fps < 30).length,
      highAnimationEvents: animationsList.filter((count) => count > 15).length,
    };
  }

  private exportToConsole() {
    if (!this.session) return;
  }

  // Get detailed session data for export
  getSessionData() {
    if (!this.session) return null;

    return {
      sessionId: this.session.sessionId,
      startTime: this.session.startTime,
      endTime: Date.now(),
      duration: (Date.now() - this.session.startTime) / 1000,
      browserInfo: this.session.browserInfo,
      logs: this.session.logs,
      summary: this.getSessionSummary(),
    };
  }

  // Export session data to file
  exportSessionData() {
    const data = this.getSessionData();
    if (!data) return null;

    const exportData = {
      ...data,
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      deviceMemory:
        (navigator as unknown as { deviceMemory?: number }).deviceMemory ||
        "Unknown",
      hardwareConcurrency: navigator.hardwareConcurrency || "Unknown",
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Comparison utility for before/after optimization analysis
  static compareResults(
    beforeResults: ReturnType<PerformanceLogger["getSessionSummary"]>,
    afterResults: ReturnType<PerformanceLogger["getSessionSummary"]>,
  ) {
    console.group("🔍 Before vs After Optimization Comparison");

    if (!beforeResults || !afterResults) {
      logWarning(
        "Invalid results provided for comparison",
        "Performance Logger",
      );
      console.groupEnd();
      return null;
    }

    const improvement = {
      fpsImprovement: afterResults.averageFps - beforeResults.averageFps,
      fpsImprovementPercent: (
        ((afterResults.averageFps - beforeResults.averageFps) /
          beforeResults.averageFps) *
        100
      ).toFixed(1),
      animationReduction:
        beforeResults.averageAnimations - afterResults.averageAnimations,
      gpuLayerReduction:
        beforeResults.averageGpuLayers - afterResults.averageGpuLayers,
      lowFpsReduction: beforeResults.lowFpsEvents - afterResults.lowFpsEvents,
    };

    return improvement;
  }

  // Compare two exported session files
  static compareSessions(
    session1: PerformanceSession,
    session2: PerformanceSession,
  ) {
    console.group("📊 Session Comparison Analysis");

    if (!session1.summary || !session2.summary) {
      logWarning(
        "Invalid session summaries provided for comparison",
        "Performance Logger",
      );
      console.groupEnd();
      return null;
    }

    const comparison = {
      session1: {
        browser: session1.browserInfo.name,
        optimized: session1.browserInfo.optimizationsEnabled,
        duration: session1.duration,
        summary: session1.summary,
      },
      session2: {
        browser: session2.browserInfo.name,
        optimized: session2.browserInfo.optimizationsEnabled,
        duration: session2.duration,
        summary: session2.summary,
      },
      improvements: {
        fpsGain: session2.summary.averageFps - session1.summary.averageFps,
        fpsGainPercent: (
          ((session2.summary.averageFps - session1.summary.averageFps) /
            session1.summary.averageFps) *
          100
        ).toFixed(1),
        minFpsGain: session2.summary.minFps - session1.summary.minFps,
        lowFpsReduction:
          session1.summary.lowFpsEvents - session2.summary.lowFpsEvents,
        animationReduction:
          session1.summary.averageAnimations -
          session2.summary.averageAnimations,
        gpuLayerReduction:
          session1.summary.averageGpuLayers - session2.summary.averageGpuLayers,
      },
    };

    return comparison;
  }
}

// Create singleton instance
export const performanceLogger = new PerformanceLogger();
