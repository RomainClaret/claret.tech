"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Zap,
  Monitor,
  Smartphone,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Globe,
  Timer,
  Eye,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePerformanceMonitor } from "@/lib/hooks/usePerformanceMonitor";

interface PerformanceMetric {
  label: string;
  value: number | string;
  unit?: string;
  status: "excellent" | "good" | "fair" | "poor";
  trend?: "up" | "down" | "stable";
  target?: number;
  description?: string;
}

interface BrowserPerformance {
  name: string;
  icon: React.ReactNode;
  metrics: PerformanceMetric[];
  overallScore: number;
  isActive: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "excellent":
      return "text-green-500";
    case "good":
      return "text-blue-500";
    case "fair":
      return "text-yellow-500";
    case "poor":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
};

const getStatusBg = (status: string) => {
  switch (status) {
    case "excellent":
      return "bg-green-500/10";
    case "good":
      return "bg-blue-500/10";
    case "fair":
      return "bg-yellow-500/10";
    case "poor":
      return "bg-red-500/10";
    default:
      return "bg-gray-500/10";
  }
};

const getTrendIcon = (trend?: string) => {
  switch (trend) {
    case "up":
      return <TrendingUp className="w-3 h-3 text-green-500" />;
    case "down":
      return <TrendingDown className="w-3 h-3 text-red-500" />;
    case "stable":
      return <Minus className="w-3 h-3 text-gray-400" />;
    default:
      return null;
  }
};

const MetricCard = ({ metric }: { metric: PerformanceMetric }) => (
  <motion.div
    className={cn(
      "p-4 rounded-lg border border-border/50 transition-all duration-300",
      getStatusBg(metric.status),
      "hover:border-border",
    )}
    whileHover={{ scale: 1.02 }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        {metric.label}
      </h4>
      {getTrendIcon(metric.trend)}
    </div>
    <div className="flex items-baseline gap-1">
      <span className={cn("text-2xl font-bold", getStatusColor(metric.status))}>
        {metric.value}
      </span>
      {metric.unit && (
        <span className="text-sm text-muted-foreground">{metric.unit}</span>
      )}
    </div>
    {metric.target && (
      <div className="mt-2 text-xs text-muted-foreground">
        Target: {metric.target}
        {metric.unit}
      </div>
    )}
    {metric.description && (
      <div className="mt-2 text-xs text-muted-foreground">
        {metric.description}
      </div>
    )}
  </motion.div>
);

const BrowserCard = ({ browser }: { browser: BrowserPerformance }) => (
  <motion.div
    className={cn(
      "p-6 rounded-xl border transition-all duration-300",
      browser.isActive
        ? "border-primary bg-primary/5"
        : "border-border bg-card",
      "hover:border-primary/50",
    )}
    whileHover={{ scale: 1.02 }}
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
  >
    <div className="flex items-center gap-3 mb-4">
      {browser.icon}
      <div>
        <h3 className="font-semibold">{browser.name}</h3>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-2xl font-bold",
              getStatusColor(
                browser.overallScore >= 90
                  ? "excellent"
                  : browser.overallScore >= 80
                    ? "good"
                    : browser.overallScore >= 70
                      ? "fair"
                      : "poor",
              ),
            )}
          >
            {browser.overallScore}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
          {browser.isActive && (
            <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
              Active
            </span>
          )}
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {browser.metrics.map((metric, index) => (
        <MetricCard key={index} metric={metric} />
      ))}
    </div>
  </motion.div>
);

const PerformanceChart = ({
  data,
  title,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  title: string;
}) => (
  <div className="p-6 rounded-xl border border-border bg-card">
    <h3 className="font-semibold mb-4 flex items-center gap-2">
      <BarChart3 className="w-5 h-5" />
      {title}
    </h3>
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-20 text-sm text-muted-foreground truncate">
            {item.label}
          </div>
          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: item.color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(item.value, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <div className="w-12 text-sm font-medium text-right">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export function PerformanceDashboard() {
  const [isVisible, setIsVisible] = useState(false);
  const performanceData = usePerformanceMonitor(isVisible);

  useEffect(() => {
    // Only start monitoring when dashboard is visible
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );

    const dashboardElement = document.getElementById("performance-dashboard");
    if (dashboardElement) {
      observer.observe(dashboardElement);
    }

    return () => observer.disconnect();
  }, []);

  // Mock data for demonstration (in real app, this would come from PerformanceTracker)
  interface PerformanceHistory {
    crossBrowserComparison: {
      timestamp: string;
      browsers: Record<
        string,
        {
          scores: {
            performance: number;
            accessibility: number;
            bestPractices: number;
            seo: number;
          };
          vitals: {
            fcp: number;
            lcp: number;
            cls: number;
            tbt: number;
            tti: number;
          };
        }
      >;
      summary: {
        bestPerformance: string;
        worstPerformance: string;
        avgPerformanceScore: number;
        criticalIssues: string[];
      };
    };
  }
  const [performanceHistory, setPerformanceHistory] =
    useState<PerformanceHistory | null>(null);

  useEffect(() => {
    // Simulate loading performance history
    const mockHistory = {
      crossBrowserComparison: {
        timestamp: new Date().toISOString(),
        browsers: {
          chromium: {
            scores: {
              performance: 92,
              accessibility: 96,
              bestPractices: 91,
              seo: 98,
            },
            vitals: { fcp: 1650, lcp: 2100, cls: 0.08, tbt: 180, tti: 3200 },
          },
          webkit: {
            scores: {
              performance: 87,
              accessibility: 94,
              bestPractices: 89,
              seo: 96,
            },
            vitals: { fcp: 1850, lcp: 2650, cls: 0.12, tbt: 290, tti: 3800 },
          },
          firefox: {
            scores: {
              performance: 89,
              accessibility: 95,
              bestPractices: 90,
              seo: 97,
            },
            vitals: { fcp: 1720, lcp: 2350, cls: 0.09, tbt: 220, tti: 3450 },
          },
        },
        summary: {
          bestPerformance: "chromium",
          worstPerformance: "webkit",
          avgPerformanceScore: 89.3,
          criticalIssues: [],
        },
      },
    };
    setPerformanceHistory(mockHistory);
  }, []);

  if (!performanceHistory) {
    return (
      <div
        id="performance-dashboard"
        className="min-h-[400px] flex items-center justify-center"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="w-5 h-5 animate-pulse" />
          Loading performance data...
        </div>
      </div>
    );
  }

  const currentBrowserData = performanceHistory.crossBrowserComparison.browsers;

  const browsers: BrowserPerformance[] = [
    {
      name: "Chrome",
      icon: <Globe className="w-6 h-6 text-blue-500" />,
      overallScore: currentBrowserData.chromium?.scores.performance || 0,
      isActive: performanceData.browserInfo === "Chrome",
      metrics: [
        {
          label: "FCP",
          value: currentBrowserData.chromium?.vitals.fcp || 0,
          unit: "ms",
          status:
            (currentBrowserData.chromium?.vitals.fcp || 0) < 1800
              ? "excellent"
              : "good",
          target: 1800,
          description: "First Contentful Paint",
        },
        {
          label: "LCP",
          value: currentBrowserData.chromium?.vitals.lcp || 0,
          unit: "ms",
          status:
            (currentBrowserData.chromium?.vitals.lcp || 0) < 2500
              ? "excellent"
              : "good",
          target: 2500,
          description: "Largest Contentful Paint",
        },
        {
          label: "CLS",
          value: (currentBrowserData.chromium?.vitals.cls || 0).toFixed(3),
          status:
            (currentBrowserData.chromium?.vitals.cls || 0) < 0.1
              ? "excellent"
              : "good",
          target: 0.1,
          description: "Cumulative Layout Shift",
        },
        {
          label: "TBT",
          value: currentBrowserData.chromium?.vitals.tbt || 0,
          unit: "ms",
          status:
            (currentBrowserData.chromium?.vitals.tbt || 0) < 300
              ? "excellent"
              : "good",
          target: 300,
          description: "Total Blocking Time",
        },
      ],
    },
    {
      name: "Safari",
      icon: <Smartphone className="w-6 h-6 text-blue-600" />,
      overallScore: currentBrowserData.webkit?.scores.performance || 0,
      isActive: performanceData.browserInfo === "Safari",
      metrics: [
        {
          label: "FCP",
          value: currentBrowserData.webkit?.vitals.fcp || 0,
          unit: "ms",
          status:
            (currentBrowserData.webkit?.vitals.fcp || 0) < 2000
              ? "excellent"
              : "good",
          target: 2000,
          description: "First Contentful Paint",
        },
        {
          label: "LCP",
          value: currentBrowserData.webkit?.vitals.lcp || 0,
          unit: "ms",
          status:
            (currentBrowserData.webkit?.vitals.lcp || 0) < 3000
              ? "excellent"
              : "good",
          target: 3000,
          description: "Largest Contentful Paint",
        },
        {
          label: "CLS",
          value: (currentBrowserData.webkit?.vitals.cls || 0).toFixed(3),
          status:
            (currentBrowserData.webkit?.vitals.cls || 0) < 0.15
              ? "excellent"
              : "good",
          target: 0.15,
          description: "Cumulative Layout Shift",
        },
        {
          label: "FPS",
          value: performanceData.fps || 60,
          status: (performanceData.fps || 60) >= 55 ? "excellent" : "fair",
          target: 55,
          description: "Frames Per Second",
        },
      ],
    },
    {
      name: "Firefox",
      icon: <Monitor className="w-6 h-6 text-orange-500" />,
      overallScore: currentBrowserData.firefox?.scores.performance || 0,
      isActive: performanceData.browserInfo === "Firefox",
      metrics: [
        {
          label: "FCP",
          value: currentBrowserData.firefox?.vitals.fcp || 0,
          unit: "ms",
          status:
            (currentBrowserData.firefox?.vitals.fcp || 0) < 1900
              ? "excellent"
              : "good",
          target: 1900,
          description: "First Contentful Paint",
        },
        {
          label: "LCP",
          value: currentBrowserData.firefox?.vitals.lcp || 0,
          unit: "ms",
          status:
            (currentBrowserData.firefox?.vitals.lcp || 0) < 2700
              ? "excellent"
              : "good",
          target: 2700,
          description: "Largest Contentful Paint",
        },
        {
          label: "CLS",
          value: (currentBrowserData.firefox?.vitals.cls || 0).toFixed(3),
          status:
            (currentBrowserData.firefox?.vitals.cls || 0) < 0.1
              ? "excellent"
              : "good",
          target: 0.1,
          description: "Cumulative Layout Shift",
        },
        {
          label: "TBT",
          value: currentBrowserData.firefox?.vitals.tbt || 0,
          unit: "ms",
          status:
            (currentBrowserData.firefox?.vitals.tbt || 0) < 350
              ? "excellent"
              : "good",
          target: 350,
          description: "Total Blocking Time",
        },
      ],
    },
  ];

  const performanceChartData = [
    {
      label: "Chrome",
      value: currentBrowserData.chromium?.scores.performance || 0,
      color: "#3b82f6",
    },
    {
      label: "Safari",
      value: currentBrowserData.webkit?.scores.performance || 0,
      color: "#1d4ed8",
    },
    {
      label: "Firefox",
      value: currentBrowserData.firefox?.scores.performance || 0,
      color: "#f97316",
    },
  ];

  const vitalChartData = [
    {
      label: "FCP",
      value: Math.min(
        ((2000 - (performanceData.fcp || 1800)) / 2000) * 100,
        100,
      ),
      color: "#10b981",
    },
    {
      label: "LCP",
      value: Math.min(
        ((4000 - (performanceData.lcp || 2500)) / 4000) * 100,
        100,
      ),
      color: "#3b82f6",
    },
    {
      label: "CLS",
      value: Math.min(
        ((0.25 - (performanceData.cls || 0.1)) / 0.25) * 100,
        100,
      ),
      color: "#8b5cf6",
    },
    {
      label: "FPS",
      value: Math.min(((performanceData.fps || 60) / 60) * 100, 100),
      color: "#f59e0b",
    },
  ];

  return (
    <div id="performance-dashboard" className="space-y-8">
      {/* Header */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Performance Dashboard
        </h2>
        <p className="text-muted-foreground mt-2">
          Real-time cross-browser performance monitoring and metrics
        </p>
      </motion.div>

      {/* Overall Status */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-medium">Overall Score</span>
          </div>
          <div className="text-2xl font-bold text-primary">
            {performanceHistory.crossBrowserComparison.summary.avgPerformanceScore.toFixed(
              1,
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Cross-browser average
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium">Current FPS</span>
          </div>
          <div className="text-2xl font-bold text-blue-500">
            {performanceData.fps}
          </div>
          <div className="text-xs text-muted-foreground">
            {performanceData.getPerformanceGrade()}
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium">Web Vitals</span>
          </div>
          <div className="text-2xl font-bold text-green-500">
            {performanceData.getWebVitalsScore() || "..."}
          </div>
          <div className="text-xs text-muted-foreground">
            Core metrics score
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium">System Load</span>
          </div>
          <div className="text-2xl font-bold text-purple-500">
            {performanceData.cpuUsage
              ? `${performanceData.cpuUsage.toFixed(0)}%`
              : "N/A"}
          </div>
          <div className="text-xs text-muted-foreground">
            {performanceData.getCpuStatus()}
          </div>
        </div>
      </motion.div>

      {/* Critical Issues Alert */}
      {performanceHistory.crossBrowserComparison.summary.criticalIssues.length >
        0 && (
        <motion.div
          className="p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="font-semibold text-red-700 dark:text-red-300">
              Critical Issues Detected
            </span>
          </div>
          <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
            {performanceHistory.crossBrowserComparison.summary.criticalIssues.map(
              (issue: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                  {issue}
                </li>
              ),
            )}
          </ul>
        </motion.div>
      )}

      {/* Performance Charts */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <PerformanceChart
          title="Browser Performance Scores"
          data={performanceChartData}
        />
        <PerformanceChart
          title="Core Web Vitals Performance"
          data={vitalChartData}
        />
      </motion.div>

      {/* Browser Performance Cards */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {browsers.map((browser, index) => (
          <BrowserCard key={index} browser={browser} />
        ))}
      </motion.div>

      {/* Performance Recommendations */}
      <motion.div
        className="p-6 rounded-xl border border-border bg-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          Performance Recommendations
        </h3>
        <div className="space-y-3">
          {performanceData.getRecommendations().length > 0 ? (
            performanceData
              .getRecommendations()
              .map((recommendation, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{recommendation}</span>
                </div>
              ))
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">
                All performance metrics are within optimal ranges!
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Real-time Metrics Footer */}
      <motion.div
        className="text-center text-xs text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Last updated: {new Date().toLocaleTimeString()} • Browser:{" "}
        {performanceData.browserInfo} •
        {performanceData.shouldReduceAnimations &&
          " Reduced animations enabled"}
      </motion.div>
    </div>
  );
}
