"use client";

import { useState, useCallback } from "react";
import { usePerformanceMonitor } from "@/lib/hooks/usePerformanceMonitor";
import {
  MultiPhaseProgress,
  generateASCIIProgressBar,
} from "@/components/ui/progress-bar";
import { logWarning } from "@/lib/utils/dev-logger";

interface ReportPhase {
  name: string;
  progress: number;
  status: "pending" | "active" | "completed" | "error";
}

interface PerformanceMetrics {
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
}

interface PerformanceRecommendation {
  category: "Performance" | "Memory" | "Network" | "Browser";
  priority: "High" | "Medium" | "Low";
  issue: string;
  solution: string;
  impact: string;
}

interface BrowserOptimizations {
  currentBrowser: string;
  optimizations: string[];
  browserSpecificIssues: string[];
}

interface TechnicalDetails {
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
}

interface ExportOptions {
  formats: string[];
  downloadLinks: {
    json: string;
    html: string;
    csv: string;
  };
}

interface PerformanceReport {
  summary: {
    overallScore: number;
    grade: "Excellent" | "Good" | "Fair" | "Poor";
    primaryIssues: string[];
    strengths: string[];
  };
  metrics: PerformanceMetrics;
  recommendations: PerformanceRecommendation[];
  browserOptimizations: BrowserOptimizations;
  technicalDetails: TechnicalDetails;
  exportOptions: ExportOptions;
}

interface PerformanceReportGeneratorProps {
  onReportGenerated?: (report: PerformanceReport) => void;
  onProgressUpdate?: (phase: string, progress: number) => void;
  onError?: (error: string) => void;
  _outputFormat?: "terminal" | "ui" | "both";
}

export function PerformanceReportGenerator({
  onReportGenerated,
  onProgressUpdate,
  onError,
  _outputFormat = "ui",
}: PerformanceReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performanceData = usePerformanceMonitor(true);

  const [phases, setPhases] = useState<ReportPhase[]>([
    {
      name: "Initializing performance collection",
      progress: 0,
      status: "pending",
    },
    { name: "Collecting browser metrics", progress: 0, status: "pending" },
    { name: "Measuring Core Web Vitals", progress: 0, status: "pending" },
    { name: "Analyzing resource usage", progress: 0, status: "pending" },
    { name: "Generating recommendations", progress: 0, status: "pending" },
    { name: "Finalizing report", progress: 0, status: "pending" },
  ]);

  const updatePhaseProgress = useCallback(
    (
      phaseIndex: number,
      progress: number,
      status?: "pending" | "active" | "completed" | "error",
    ) => {
      // Ensure progress is always between 0 and 100
      const clampedProgress = Math.max(0, Math.min(100, progress));

      setPhases((prev) =>
        prev.map((phase, index) => {
          if (index === phaseIndex) {
            return {
              ...phase,
              progress: clampedProgress,
              status: status || phase.status,
            };
          }
          return phase;
        }),
      );

      if (onProgressUpdate) {
        onProgressUpdate(phases[phaseIndex]?.name || "", clampedProgress);
      }
    },
    [phases, onProgressUpdate],
  );

  // Helper function for safe progress increments
  const safeProgressIncrement = useCallback(
    (currentProgress: number, increment: number, maxIterations: number) => {
      const targetProgress = Math.min(
        100,
        currentProgress + 100 / maxIterations,
      );
      return Math.min(100, targetProgress);
    },
    [],
  );

  const collectBrowserMetrics = useCallback(async () => {
    return new Promise<{
      fps: number;
      averageFps: number;
      minFps: number;
      maxFps: number;
      memoryUsage: number | null;
      memoryLimit: number | null;
    }>((resolve) => {
      // Simulate collection time with real data gathering
      let progress = 0;
      let iteration = 0;
      const maxIterations = 5;

      const interval = setInterval(() => {
        iteration++;
        progress = safeProgressIncrement(progress, 0, maxIterations);
        updatePhaseProgress(1, progress, "active");

        if (iteration >= maxIterations) {
          clearInterval(interval);
          updatePhaseProgress(1, 100, "completed");

          // Collect actual performance metrics with enhanced memory collection
          let memoryUsage = performanceData.memoryUsed || null;
          let memoryLimit = performanceData.memoryLimit || null;

          // Try to get memory directly from performance.memory API if available
          try {
            const memoryInfo = (
              performance as Performance & {
                memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
              }
            ).memory;
            if (
              memoryInfo &&
              memoryInfo.usedJSHeapSize &&
              memoryInfo.jsHeapSizeLimit
            ) {
              memoryUsage = memoryInfo.usedJSHeapSize;
              memoryLimit = memoryInfo.jsHeapSizeLimit;
            }
          } catch {
            logWarning(
              "Memory API not available",
              "performance-report-memory-api",
            );
          }

          const metrics = {
            fps: performanceData.fps,
            averageFps: performanceData.averageFps,
            minFps: performanceData.minFps,
            maxFps: performanceData.maxFps,
            memoryUsage,
            memoryLimit,
            cpuUsage: performanceData.cpuUsage,
            gpuUsage: performanceData.gpuUsage,
          };

          resolve(metrics);
        }
      }, 200);
    });
  }, [performanceData, updatePhaseProgress, safeProgressIncrement]);

  const collectWebVitals = useCallback(async () => {
    return new Promise<{
      lcp: number | null;
      fcp: number | null;
      cls: number | null;
      inp: number | null;
      ttfb: number | null;
    }>((resolve) => {
      let progress = 0;
      let iteration = 0;
      const maxIterations = 4;

      const interval = setInterval(() => {
        iteration++;
        progress = safeProgressIncrement(progress, 0, maxIterations);
        updatePhaseProgress(2, progress, "active");

        if (iteration >= maxIterations) {
          clearInterval(interval);
          updatePhaseProgress(2, 100, "completed");

          const vitals = {
            lcp: performanceData.lcp,
            fcp: performanceData.fcp,
            cls: performanceData.cls,
            inp: performanceData.inp,
            ttfb: performanceData.ttfb,
          };

          resolve(vitals);
        }
      }, 150);
    });
  }, [performanceData, updatePhaseProgress, safeProgressIncrement]);

  const analyzeResources = useCallback(async () => {
    return new Promise<{
      totalSize: number;
      scriptSize: number;
      styleSize: number;
      imageSize: number;
      fontSize: number;
      requestCount: number;
    }>((resolve) => {
      let progress = 0;
      let iteration = 0;
      const maxIterations = 3;

      const interval = setInterval(() => {
        iteration++;
        progress = safeProgressIncrement(progress, 0, maxIterations);
        updatePhaseProgress(3, progress, "active");

        if (iteration >= maxIterations) {
          clearInterval(interval);
          updatePhaseProgress(3, 100, "completed");

          // Get resource timing data
          const resourceEntries = performance.getEntriesByType(
            "resource",
          ) as PerformanceResourceTiming[];

          let scriptSize = 0;
          let styleSize = 0;
          let imageSize = 0;
          let fontSize = 0;
          let totalSize = 0;

          resourceEntries.forEach((entry) => {
            const size = entry.transferSize || 0;
            totalSize += size;

            if (
              entry.name.includes(".js") ||
              entry.name.includes("javascript")
            ) {
              scriptSize += size;
            } else if (
              entry.name.includes(".css") ||
              entry.name.includes("stylesheet")
            ) {
              styleSize += size;
            } else if (entry.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
              imageSize += size;
            } else if (entry.name.match(/\.(woff|woff2|ttf|eot)$/i)) {
              fontSize += size;
            }
          });

          const resources = {
            totalSize,
            scriptSize,
            styleSize,
            imageSize,
            fontSize,
            requestCount: resourceEntries.length,
          };

          resolve(resources);
        }
      }, 100);
    });
  }, [updatePhaseProgress, safeProgressIncrement]);

  const generateReport = useCallback(async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setCurrentPhase(0);

    try {
      // Phase 0: Initialize
      updatePhaseProgress(0, 50, "active");
      await new Promise((resolve) => setTimeout(resolve, 300));
      updatePhaseProgress(0, 100, "completed");
      setCurrentPhase(1);

      // Phase 1: Collect browser metrics
      setCurrentPhase(1);
      const performanceMetrics = await collectBrowserMetrics();
      setCurrentPhase(2);

      // Phase 2: Collect Core Web Vitals
      const vitals = await collectWebVitals();
      setCurrentPhase(3);

      // Phase 3: Analyze resources
      const resources = await analyzeResources();
      setCurrentPhase(4);

      // Phase 4: Generate recommendations
      updatePhaseProgress(4, 50, "active");

      const reportData = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        vitals,
        performance: performanceMetrics,
        network: {
          connectionType: performanceData.connectionType,
          effectiveBandwidth: performanceData.effectiveBandwidth,
          rtt: performanceData.rtt,
          saveData: performanceData.saveData,
        },
        resources,
        browser: {
          name: performanceData.browserInfo,
          version: "Unknown",
          engine: "Unknown",
          platform: navigator.platform,
        },
        device: {
          cores: performanceData.cpuCores,
          deviceMemory: performanceData.deviceMemory,
          maxTouchPoints: navigator.maxTouchPoints,
          platform: navigator.platform,
        },
      };

      updatePhaseProgress(4, 80, "active");

      // Call API to generate comprehensive report
      const response = await fetch("/api/performance-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.statusText}`);
      }

      const result = await response.json();
      updatePhaseProgress(4, 100, "completed");
      setCurrentPhase(5);

      // Phase 5: Finalize
      updatePhaseProgress(5, 50, "active");
      await new Promise((resolve) => setTimeout(resolve, 200));
      updatePhaseProgress(5, 100, "completed");

      setReport(result.report);

      if (onReportGenerated) {
        onReportGenerated(result.report);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      updatePhaseProgress(currentPhase, 0, "error");

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [
    isGenerating,
    performanceData,
    currentPhase,
    updatePhaseProgress,
    collectBrowserMetrics,
    collectWebVitals,
    analyzeResources,
    onReportGenerated,
    onError,
  ]);

  // Helper function to format report for terminal display
  const formatReportForTerminal = useCallback(
    (report: PerformanceReport): string => {
      const lines: string[] = [];

      lines.push(
        "╔═══════════════════════════════════════════════════════════════╗",
      );
      lines.push(
        "║                    PERFORMANCE REPORT                        ║",
      );
      lines.push(
        "╠═══════════════════════════════════════════════════════════════╣",
      );
      lines.push(
        `║ Overall Score: ${report.summary.overallScore}/100 (${report.summary.grade})${" ".repeat(Math.max(0, 35 - report.summary.grade.length))}║`,
      );
      lines.push(
        "╠═══════════════════════════════════════════════════════════════╣",
      );

      // Performance Metrics
      lines.push(
        "║ PERFORMANCE METRICS                                           ║",
      );
      lines.push(
        "╠═══════════════════════════════════════════════════════════════╣",
      );
      lines.push(
        `║ FPS: ${report.metrics.performance.fps.value} (${report.metrics.performance.fps.status})${" ".repeat(Math.max(0, 43 - report.metrics.performance.fps.status.length))}║`,
      );
      lines.push(
        `║ Memory: ${report.metrics.performance.memory.value.toFixed(1)}% (${report.metrics.performance.memory.status})${" ".repeat(Math.max(0, 40 - report.metrics.performance.memory.status.length))}║`,
      );

      // Core Web Vitals
      lines.push(
        "╠═══════════════════════════════════════════════════════════════╣",
      );
      lines.push(
        "║ CORE WEB VITALS                                               ║",
      );
      lines.push(
        "╠═══════════════════════════════════════════════════════════════╣",
      );

      if (report.metrics.vitals.lcp.value) {
        lines.push(
          `║ LCP: ${report.metrics.vitals.lcp.value}ms (${report.metrics.vitals.lcp.status})${" ".repeat(Math.max(0, 40 - report.metrics.vitals.lcp.status.length))}║`,
        );
      }
      if (report.metrics.vitals.fcp.value) {
        lines.push(
          `║ FCP: ${report.metrics.vitals.fcp.value}ms (${report.metrics.vitals.fcp.status})${" ".repeat(Math.max(0, 40 - report.metrics.vitals.fcp.status.length))}║`,
        );
      }
      if (report.metrics.vitals.cls.value) {
        lines.push(
          `║ CLS: ${report.metrics.vitals.cls.value.toFixed(3)} (${report.metrics.vitals.cls.status})${" ".repeat(Math.max(0, 42 - report.metrics.vitals.cls.status.length))}║`,
        );
      }

      // Recommendations
      if (report.recommendations.length > 0) {
        lines.push(
          "╠═══════════════════════════════════════════════════════════════╣",
        );
        lines.push(
          "║ TOP RECOMMENDATIONS                                           ║",
        );
        lines.push(
          "╠═══════════════════════════════════════════════════════════════╣",
        );

        report.recommendations.slice(0, 3).forEach((rec, index) => {
          const priority = `[${rec.priority}]`;
          const issue = rec.issue.substring(0, 50);
          lines.push(
            `║ ${index + 1}. ${priority} ${issue}${" ".repeat(Math.max(0, 58 - priority.length - issue.length))}║`,
          );
        });
      }

      lines.push(
        "╚═══════════════════════════════════════════════════════════════╝",
      );
      lines.push("");
      lines.push(
        "Use 'performance' command to open full dashboard for detailed analysis.",
      );

      return lines.join("\n");
    },
    [],
  );

  // Generate ASCII progress bar for terminal
  const getTerminalProgress = useCallback(() => {
    if (!isGenerating) return "";

    const currentPhaseData = phases[currentPhase];
    if (!currentPhaseData) return "";

    const overallProgress = Math.round(
      (currentPhase * 100 + currentPhaseData.progress) / phases.length,
    );

    const progressBar = generateASCIIProgressBar(overallProgress, 50);

    return `\n${currentPhaseData.name}...\n${progressBar}\n`;
  }, [isGenerating, phases, currentPhase]);

  return {
    // State
    isGenerating,
    currentPhase,
    phases,
    report,
    error,

    // Actions
    generateReport,

    // Formatters
    formatReportForTerminal,
    getTerminalProgress,

    // UI Component (for modal display)
    ProgressUI: () => {
      if (!isGenerating && !report && !error) return null;

      return (
        <div className="space-y-6">
          {isGenerating && (
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Generating Performance Report
              </h3>
              <MultiPhaseProgress
                phases={phases}
                currentPhase={currentPhase}
                className="mb-4"
              />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <h4 className="text-red-500 font-semibold mb-2">Error</h4>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {report && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <h4 className="text-green-500 font-semibold mb-2">
                  Report Generated Successfully
                </h4>
                <p className="text-sm text-green-400">
                  Overall Score: {report.summary.overallScore}/100 (
                  {report.summary.grade})
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <h5 className="font-semibold text-sm mb-1">Strengths</h5>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {report.summary.strengths.map((strength, index) => (
                      <li key={index}>• {strength}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <h5 className="font-semibold text-sm mb-1">Issues</h5>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {report.summary.primaryIssues.map((issue, index) => (
                      <li key={index}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <h5 className="font-semibold text-sm mb-2">
                  Top Recommendations
                </h5>
                <div className="space-y-2">
                  {report.recommendations.slice(0, 3).map((rec, index) => (
                    <div key={index} className="text-xs">
                      <span
                        className={`inline-block px-2 py-1 rounded text-white text-xs ${
                          rec.priority === "High"
                            ? "bg-red-500"
                            : rec.priority === "Medium"
                              ? "bg-yellow-500"
                              : "bg-blue-500"
                        }`}
                      >
                        {rec.priority}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {rec.issue}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    },
  };
}
