"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { PerformanceReportGenerator } from "./PerformanceReportGenerator";
import { logError } from "@/lib/utils/dev-logger";

// Local type definition for the performance report
interface PerformanceReportData {
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
}

interface PerformanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PerformanceReportModal({
  isOpen,
  onClose,
}: PerformanceReportModalProps) {
  // Removed unused context variables
  const [reportData, setReportData] = useState<PerformanceReportData | null>(
    null,
  );

  const reportGenerator = PerformanceReportGenerator({
    onReportGenerated: (report) => {
      setReportData(report);
      // Dispatch completion event
      window.dispatchEvent(new CustomEvent("performance-report-complete"));
    },
    onProgressUpdate: (phase, progress) => {
      // Dispatch progress event for terminal
      window.dispatchEvent(
        new CustomEvent("performance-report-progress", {
          detail: { phase, progress },
        }),
      );
    },
    onError: (error) => {
      logError(error, "performance-report-modal-generation");
      // Dispatch error event
      window.dispatchEvent(new CustomEvent("performance-report-error"));
    },
    _outputFormat: "ui",
  });

  // Auto-generate report when modal opens
  useEffect(() => {
    if (isOpen && !reportGenerator.isGenerating && !reportData) {
      reportGenerator.generateReport();
    }
  }, [isOpen, reportGenerator.isGenerating, reportData, reportGenerator]);

  // Listen for report generation trigger
  useEffect(() => {
    const handleGenerateReport = () => {
      if (isOpen) {
        setReportData(null); // Reset previous report
        reportGenerator.generateReport();
      }
    };

    window.addEventListener(
      "terminal-generate-performance-report",
      handleGenerateReport,
    );

    return () => {
      window.removeEventListener(
        "terminal-generate-performance-report",
        handleGenerateReport,
      );
    };
  }, [isOpen, reportGenerator]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReportData(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const downloadReport = (format: "json" | "html" | "csv") => {
    if (!reportData) return;

    let content = "";
    let filename = "";
    let mimeType = "";

    switch (format) {
      case "json":
        content = JSON.stringify(reportData, null, 2);
        filename = `performance-report-${new Date().toISOString().split("T")[0]}.json`;
        mimeType = "application/json";
        break;
      case "html":
        content = generateHTMLReport(reportData);
        filename = `performance-report-${new Date().toISOString().split("T")[0]}.html`;
        mimeType = "text/html";
        break;
      case "csv":
        content = generateCSVReport(reportData);
        filename = `performance-report-${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv";
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className={cn(
            "relative bg-background border border-border shadow-2xl",
            "w-[90vw] h-[90vh] max-w-4xl max-h-[90vh]",
            "flex flex-col overflow-hidden rounded-lg",
          )}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-purple-500/5">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Performance Report</h2>
              {reportData && (
                <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                  Score: {reportData.summary.overallScore}/100 (
                  {reportData.summary.grade})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Download Options */}
              {reportData && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => downloadReport("json")}
                    className="p-2 hover:bg-muted rounded-md transition-colors text-xs"
                    title="Download JSON"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => downloadReport("html")}
                    className="p-2 hover:bg-muted rounded-md transition-colors text-xs"
                    title="Download HTML"
                  >
                    HTML
                  </button>
                  <button
                    onClick={() => downloadReport("csv")}
                    className="p-2 hover:bg-muted rounded-md transition-colors text-xs"
                    title="Download CSV"
                  >
                    CSV
                  </button>
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded-md transition-colors"
                title="Close (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            <reportGenerator.ProgressUI />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper function to generate HTML report
function generateHTMLReport(reportData: PerformanceReportData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .score { font-size: 48px; font-weight: bold; color: ${reportData.summary.grade === "Excellent" ? "#22c55e" : reportData.summary.grade === "Good" ? "#3b82f6" : reportData.summary.grade === "Fair" ? "#f59e0b" : "#ef4444"}; }
        .grade { font-size: 24px; color: #666; margin-top: 10px; }
        .section { margin: 30px 0; }
        .section h2 { color: #333; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; }
        .metric { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
        .metric:last-child { border-bottom: none; }
        .recommendation { background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #3b82f6; border-radius: 4px; }
        .priority-high { border-left-color: #ef4444; }
        .priority-medium { border-left-color: #f59e0b; }
        .priority-low { border-left-color: #22c55e; }
        .status-excellent { color: #22c55e; font-weight: bold; }
        .status-good { color: #3b82f6; font-weight: bold; }
        .status-fair { color: #f59e0b; font-weight: bold; }
        .status-poor { color: #ef4444; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Report</h1>
            <div class="score">${reportData.summary.overallScore}</div>
            <div class="grade">${reportData.summary.grade}</div>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            <div class="metric">
                <span>Frame Rate (FPS)</span>
                <span class="status-${reportData.metrics.performance.fps.status.toLowerCase()}">${reportData.metrics.performance.fps.value} (${reportData.metrics.performance.fps.status})</span>
            </div>
            <div class="metric">
                <span>Memory Usage</span>
                <span class="status-${reportData.metrics.performance.memory.status.toLowerCase()}">${reportData.metrics.performance.memory.value.toFixed(1)}% (${reportData.metrics.performance.memory.status})</span>
            </div>
        </div>

        <div class="section">
            <h2>Core Web Vitals</h2>
            ${
              reportData.metrics.vitals.lcp.value
                ? `<div class="metric">
                <span>Largest Contentful Paint (LCP)</span>
                <span class="status-${reportData.metrics.vitals.lcp.status.toLowerCase().replace(" ", "-")}">${reportData.metrics.vitals.lcp.value}ms (${reportData.metrics.vitals.lcp.status})</span>
            </div>`
                : ""
            }
            ${
              reportData.metrics.vitals.fcp.value
                ? `<div class="metric">
                <span>First Contentful Paint (FCP)</span>
                <span class="status-${reportData.metrics.vitals.fcp.status.toLowerCase().replace(" ", "-")}">${reportData.metrics.vitals.fcp.value}ms (${reportData.metrics.vitals.fcp.status})</span>
            </div>`
                : ""
            }
            ${
              reportData.metrics.vitals.cls.value
                ? `<div class="metric">
                <span>Cumulative Layout Shift (CLS)</span>
                <span class="status-${reportData.metrics.vitals.cls.status.toLowerCase().replace(" ", "-")}">${reportData.metrics.vitals.cls.value.toFixed(3)} (${reportData.metrics.vitals.cls.status})</span>
            </div>`
                : ""
            }
        </div>

        <div class="section">
            <h2>Recommendations</h2>
            ${reportData.recommendations
              .map(
                (rec: PerformanceReportData["recommendations"][0]) => `
                <div class="recommendation priority-${rec.priority.toLowerCase()}">
                    <strong>[${rec.priority}] ${rec.issue}</strong>
                    <p>${rec.solution}</p>
                    <p><em>Impact: ${rec.impact}</em></p>
                </div>
            `,
              )
              .join("")}
        </div>

        <div class="section">
            <h2>Browser Optimizations (${reportData.browserOptimizations.currentBrowser})</h2>
            ${reportData.browserOptimizations.optimizations.map((opt: string) => `<p>• ${opt}</p>`).join("")}
        </div>
    </div>
</body>
</html>
  `;
}

// Helper function to generate CSV report
function generateCSVReport(reportData: PerformanceReportData): string {
  const lines = [
    "Metric,Value,Status,Target",
    `Overall Score,${reportData.summary.overallScore}/100,${reportData.summary.grade},90+`,
    `FPS,${reportData.metrics.performance.fps.value},${reportData.metrics.performance.fps.status},${reportData.metrics.performance.fps.target}`,
    `Memory Usage,${reportData.metrics.performance.memory.value.toFixed(1)}%,${reportData.metrics.performance.memory.status},${reportData.metrics.performance.memory.target}%`,
  ];

  if (reportData.metrics.vitals.lcp.value) {
    lines.push(
      `LCP,${reportData.metrics.vitals.lcp.value}ms,${reportData.metrics.vitals.lcp.status},${reportData.metrics.vitals.lcp.target}ms`,
    );
  }

  if (reportData.metrics.vitals.fcp.value) {
    lines.push(
      `FCP,${reportData.metrics.vitals.fcp.value}ms,${reportData.metrics.vitals.fcp.status},${reportData.metrics.vitals.fcp.target}ms`,
    );
  }

  if (reportData.metrics.vitals.cls.value) {
    lines.push(
      `CLS,${reportData.metrics.vitals.cls.value.toFixed(3)},${reportData.metrics.vitals.cls.status},${reportData.metrics.vitals.cls.target}`,
    );
  }

  lines.push("");
  lines.push("Recommendations");
  lines.push("Priority,Issue,Solution,Impact");
  reportData.recommendations.forEach(
    (rec: PerformanceReportData["recommendations"][0]) => {
      lines.push(
        `${rec.priority},"${rec.issue}","${rec.solution}","${rec.impact}"`,
      );
    },
  );

  return lines.join("\n");
}
