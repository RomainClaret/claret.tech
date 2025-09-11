"use client";

import { useState, useEffect, useRef } from "react";
import { useSafari } from "./useSafari";
import { onCLS, onFCP, onLCP, onTTFB, onINP, type Metric } from "web-vitals";
import { GpuEstimator } from "@/lib/utils/gpu-estimator";
import { HardwareDetector } from "@/lib/utils/hardware-detector";
import { logWarning } from "@/lib/utils/dev-logger";
import type {
  NavigatorWithConnection,
  PerformanceWithMemory,
  PerformanceEntryWithTransferSize,
} from "@/types/browser-api";

export interface MonitoringOptions {
  fps: boolean;
  webVitals: boolean;
  cpu: boolean;
  gpu: boolean;
  memory: boolean;
  network: boolean;
  resources: boolean;
  longTasks: boolean;
  hardware: boolean;
}

interface PerformanceMetrics {
  fps: number;
  averageFps: number;
  minFps: number;
  maxFps: number;
  activeAnimations: number;
  gpuLayers: number;
  isLagging: boolean;
  browserInfo: string;
}

interface EnhancedPerformanceMetrics extends PerformanceMetrics {
  // Core Web Vitals
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;

  // Memory metrics
  memoryUsed: number | null;
  memoryLimit: number | null;
  memoryPercentage: number | null;

  // Network metrics
  connectionType: string | null;
  effectiveBandwidth: number | null;
  rtt: number | null;
  saveData: boolean;

  // Resource metrics
  resourceCount: number;
  longTaskCount: number;
  totalTransferSize: number;

  // CPU metrics
  cpuCores: number;
  cpuUsage: number | null;
  cpuScore: number | null;
  cpuBaseline: number | null;

  // GPU metrics
  gpuVendor: string | null;
  gpuRenderer: string | null;
  gpuUsage: number | null;
  gpuScore: number | null;
  gpuTier: "low" | "medium" | "high" | "unknown";

  // Hardware info
  deviceMemory: number | null;
  thermalState: "nominal" | "fair" | "serious" | "critical" | "unknown";

  // Timeline data for graphs
  fpsHistory: number[];
  memoryHistory: number[];
  cpuHistory: number[];
  gpuHistory: number[];
}

/**
 * Hook for real-time performance monitoring
 * Tracks FPS, GPU layers, animations, and browser-specific metrics
 * Only consumes resources when isMonitoring is true
 */
export function usePerformanceMonitor(
  isMonitoring: boolean = true,
  options: Partial<MonitoringOptions> = {},
) {
  // Default monitoring options - only FPS enabled by default for performance
  const monitoringOptions: MonitoringOptions = {
    fps: true,
    webVitals: false,
    cpu: false,
    gpu: false,
    memory: false,
    network: false,
    resources: false,
    longTasks: false,
    hardware: false,
    ...options,
  };
  const { isSafari, isChrome, isFirefox, isEdge, shouldReduceAnimations } =
    useSafari();

  const [metrics, setMetrics] = useState<EnhancedPerformanceMetrics>({
    // Basic metrics
    fps: 60,
    averageFps: 60,
    minFps: 60,
    maxFps: 60,
    activeAnimations: 0,
    gpuLayers: 0,
    isLagging: false,
    browserInfo: "Unknown",

    // Core Web Vitals
    lcp: null,
    inp: null,
    cls: null,
    fcp: null,
    ttfb: null,

    // Memory metrics
    memoryUsed: null,
    memoryLimit: null,
    memoryPercentage: null,

    // Network metrics
    connectionType: null,
    effectiveBandwidth: null,
    rtt: null,
    saveData: false,

    // Resource metrics
    resourceCount: 0,
    longTaskCount: 0,
    totalTransferSize: 0,

    // CPU metrics
    cpuCores: navigator.hardwareConcurrency || 4,
    cpuUsage: null,
    cpuScore: null,
    cpuBaseline: null,

    // GPU metrics
    gpuVendor: null,
    gpuRenderer: null,
    gpuUsage: null,
    gpuScore: null,
    gpuTier: "unknown",

    // Hardware info
    deviceMemory: null,
    thermalState: "unknown",

    // Timeline data
    fpsHistory: [],
    memoryHistory: [],
    cpuHistory: [],
    gpuHistory: [],
  });

  const animationFrameRef = useRef<number>();
  const longTaskObserverRef = useRef<PerformanceObserver | null>(null);
  const webVitalsInitialized = useRef(false);
  const webVitalsCleanup = useRef<(() => void)[]>([]);
  const cpuWorkerRef = useRef<Worker | null>(null);
  const gpuEstimatorRef = useRef<GpuEstimator | null>(null);
  const hardwareDetectorRef = useRef<HardwareDetector | null>(null);

  // Initialize Web Vitals monitoring
  useEffect(() => {
    if (!isMonitoring || !monitoringOptions.webVitals) {
      // Clean up any existing Web Vitals listeners
      webVitalsCleanup.current.forEach((cleanup) => cleanup());
      webVitalsCleanup.current = [];
      webVitalsInitialized.current = false;
      return;
    }

    if (webVitalsInitialized.current) return;
    webVitalsInitialized.current = true;

    const handleMetric = (metric: Metric) => {
      setMetrics((prev) => ({
        ...prev,
        [metric.name.toLowerCase()]: metric.value,
      }));
    };

    // Core Web Vitals monitoring with cleanup functions
    const lcpCleanup = onLCP(handleMetric);
    const inpCleanup = onINP(handleMetric);
    const clsCleanup = onCLS(handleMetric);
    const fcpCleanup = onFCP(handleMetric);
    const ttfbCleanup = onTTFB(handleMetric);

    // Store cleanup functions (filter out undefined/void returns)
    const cleanups = [
      lcpCleanup,
      inpCleanup,
      clsCleanup,
      fcpCleanup,
      ttfbCleanup,
    ];

    webVitalsCleanup.current = cleanups.filter(
      (cleanup) =>
        cleanup !== undefined &&
        cleanup !== null &&
        typeof cleanup === "function",
    ) as (() => void)[];

    return () => {
      // Clean up Web Vitals listeners
      webVitalsCleanup.current.forEach((cleanup) => cleanup());
      webVitalsCleanup.current = [];
      webVitalsInitialized.current = false;
    };
  }, [isMonitoring, monitoringOptions.webVitals]);

  // Initialize long task monitoring
  useEffect(() => {
    if (!isMonitoring || !monitoringOptions.longTasks) {
      if (longTaskObserverRef.current) {
        longTaskObserverRef.current.disconnect();
        longTaskObserverRef.current = null;
      }
      return;
    }

    if ("PerformanceObserver" in window) {
      try {
        longTaskObserverRef.current = new PerformanceObserver((list) => {
          setMetrics((prev) => ({
            ...prev,
            longTaskCount: prev.longTaskCount + list.getEntries().length,
          }));
        });

        longTaskObserverRef.current.observe({
          type: "longtask",
          buffered: true,
        });
      } catch (error) {
        logWarning(
          `Long task monitoring not supported: ${error}`,
          "performance-monitor:longtask",
        );
      }
    }

    return () => {
      if (longTaskObserverRef.current) {
        longTaskObserverRef.current.disconnect();
        longTaskObserverRef.current = null;
      }
    };
  }, [isMonitoring, monitoringOptions.longTasks]);

  // Get network information
  const getNetworkInfo = () => {
    const navWithConnection = navigator as NavigatorWithConnection;
    const connection =
      navWithConnection.connection ||
      navWithConnection.mozConnection ||
      navWithConnection.webkitConnection;

    return {
      connectionType: connection?.effectiveType || null,
      effectiveBandwidth: connection?.downlink || null,
      rtt: connection?.rtt || null,
      saveData: connection?.saveData || false,
    };
  };

  // Get memory information
  const getMemoryInfo = () => {
    const memoryInfo = (performance as PerformanceWithMemory).memory;
    if (!memoryInfo)
      return { memoryUsed: null, memoryLimit: null, memoryPercentage: null };

    const used = memoryInfo.usedJSHeapSize;
    const limit = memoryInfo.jsHeapSizeLimit;
    const percentage = limit > 0 ? (used / limit) * 100 : null;

    return {
      memoryUsed: used,
      memoryLimit: limit,
      memoryPercentage: percentage,
    };
  };

  // Get resource information
  const getResourceInfo = () => {
    const entries = performance.getEntriesByType("resource");
    const transferSize = entries.reduce(
      (total, entry: PerformanceEntryWithTransferSize) => {
        return total + (entry.transferSize || 0);
      },
      0,
    );

    return {
      resourceCount: entries.length,
      totalTransferSize: transferSize,
    };
  };

  // Initialize CPU monitoring
  useEffect(() => {
    if (!isMonitoring || !monitoringOptions.cpu) {
      if (cpuWorkerRef.current) {
        cpuWorkerRef.current.postMessage({ type: "stop" });
        cpuWorkerRef.current.terminate();
        cpuWorkerRef.current = null;
      }
      return;
    }

    try {
      cpuWorkerRef.current = new Worker("/cpu-benchmark-worker.js");

      cpuWorkerRef.current.onmessage = (event) => {
        const { type, data } = event.data;

        switch (type) {
          case "cpu-usage":
            setMetrics((prev) => ({
              ...prev,
              cpuUsage: data.cpuUsage,
              cpuScore: data.score,
              cpuBaseline: data.baseline,
              cpuHistory: [
                ...(prev.cpuHistory || []).slice(-59),
                data.cpuUsage || 0,
              ],
            }));
            break;
          case "baseline-established":
            setMetrics((prev) => ({
              ...prev,
              cpuBaseline: data.baseline,
            }));
            break;
          case "worker-ready":
            cpuWorkerRef.current?.postMessage({ type: "start" });
            break;
          case "error":
            logWarning(
              `CPU monitoring error: ${data.message}`,
              "performance-monitor:cpu",
            );
            break;
        }
      };

      cpuWorkerRef.current.onerror = (error) => {
        logWarning(
          `CPU worker error: ${error}`,
          "performance-monitor:cpu-worker",
        );
      };
    } catch (error) {
      logWarning(
        `Failed to initialize CPU monitoring: ${error}`,
        "performance-monitor:cpu-init",
      );
    }

    return () => {
      if (cpuWorkerRef.current) {
        cpuWorkerRef.current.postMessage({ type: "stop" });
        cpuWorkerRef.current.terminate();
        cpuWorkerRef.current = null;
      }
    };
  }, [isMonitoring, monitoringOptions.cpu]);

  // Initialize GPU monitoring
  useEffect(() => {
    if (!isMonitoring || !monitoringOptions.gpu) {
      if (gpuEstimatorRef.current) {
        gpuEstimatorRef.current.stopMonitoring();
        gpuEstimatorRef.current.destroy();
        gpuEstimatorRef.current = null;
      }
      return;
    }

    try {
      gpuEstimatorRef.current = new GpuEstimator();

      if (gpuEstimatorRef.current.isWebGLSupported()) {
        // Get GPU info
        const gpuInfo = gpuEstimatorRef.current.getGpuInfo();

        setMetrics((prev) => ({
          ...prev,
          gpuVendor: gpuInfo.vendor,
          gpuRenderer: gpuInfo.renderer,
        }));

        // Establish baseline
        gpuEstimatorRef.current.establishBaseline().then(() => {
          // Start monitoring
          gpuEstimatorRef.current?.startMonitoring((performance) => {
            setMetrics((prev) => ({
              ...prev,
              gpuUsage: performance.usage,
              gpuScore: performance.score,
              gpuHistory: [
                ...(prev.gpuHistory || []).slice(-59),
                performance.usage || 0,
              ],
            }));
          });
        });
      }
    } catch (error) {
      logWarning(
        `Failed to initialize GPU monitoring: ${error}`,
        "performance-monitor:gpu-init",
      );
    }

    return () => {
      if (gpuEstimatorRef.current) {
        gpuEstimatorRef.current.stopMonitoring();
        gpuEstimatorRef.current.destroy();
        gpuEstimatorRef.current = null;
      }
    };
  }, [isMonitoring, monitoringOptions.gpu]);

  // Initialize hardware detection
  useEffect(() => {
    if (!isMonitoring || !monitoringOptions.hardware) return;

    try {
      hardwareDetectorRef.current = HardwareDetector.getInstance();

      hardwareDetectorRef.current.detectHardware().then((hardwareInfo) => {
        setMetrics((prev) => ({
          ...prev,
          cpuCores: hardwareInfo.cpu.cores,
          deviceMemory: hardwareInfo.memory.deviceMemory,
          gpuTier: hardwareInfo.gpu.tier,
          gpuVendor: prev.gpuVendor || hardwareInfo.gpu.vendor,
          gpuRenderer: prev.gpuRenderer || hardwareInfo.gpu.renderer,
        }));
      });
    } catch (error) {
      logWarning(
        `Failed to initialize hardware detection: ${error}`,
        "performance-monitor:hardware-init",
      );
    }
  }, [isMonitoring, monitoringOptions.hardware]);

  useEffect(() => {
    // Set browser info immediately
    const browserInfo = isSafari
      ? "Safari"
      : isChrome
        ? "Chrome"
        : isFirefox
          ? "Firefox"
          : isEdge
            ? "Edge"
            : "Unknown";

    // Update browser info in metrics
    setMetrics((prev) => ({ ...prev, browserInfo }));

    // Only start performance monitoring if requested
    if (!isMonitoring || !monitoringOptions.fps) {
      return;
    }

    let frames = 0;
    let lastTime = performance.now();
    const fpsHistory: number[] = [];

    function measureFPS() {
      frames++;
      const currentTime = performance.now();

      // Calculate FPS every second
      if (currentTime >= lastTime + 1000) {
        const currentFPS = Math.round(
          (frames * 1000) / (currentTime - lastTime),
        );

        // Add to history (keep last 10 readings)
        fpsHistory.push(currentFPS);
        if (fpsHistory.length > 10) {
          fpsHistory.shift();
        }

        // Calculate average, min, max
        const averageFps = Math.round(
          fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length,
        );
        const minFps = Math.min(...fpsHistory);
        const maxFps = Math.max(...fpsHistory);

        // Count active animations - only count if animations are enabled
        const activeAnimations = document.body.classList.contains(
          "enable-animations",
        )
          ? document.querySelectorAll('[style*="animation"], .animate-').length
          : 0;

        // Estimate GPU layers - only count if animations are enabled
        const gpuLayers = document.body.classList.contains("enable-animations")
          ? document.querySelectorAll(
              '[style*="will-change"], [style*="translateZ"], [style*="translate3d"], .gpu-layer',
            ).length
          : 0;

        // Get additional metrics conditionally
        const networkInfo = monitoringOptions.network
          ? getNetworkInfo()
          : {
              connectionType: null,
              effectiveBandwidth: null,
              rtt: null,
              saveData: false,
            };
        const memoryInfo = monitoringOptions.memory
          ? getMemoryInfo()
          : { memoryUsed: null, memoryLimit: null, memoryPercentage: null };
        const resourceInfo = monitoringOptions.resources
          ? getResourceInfo()
          : { resourceCount: 0, totalTransferSize: 0 };

        setMetrics((prev) => ({
          // Basic FPS metrics
          fps: currentFPS,
          averageFps,
          minFps,
          maxFps,
          activeAnimations,
          gpuLayers,
          isLagging: currentFPS < (isSafari ? 30 : 45), // Lower threshold for Safari
          browserInfo,

          // Keep existing Web Vitals data
          lcp: prev.lcp,
          inp: prev.inp,
          cls: prev.cls,
          fcp: prev.fcp,
          ttfb: prev.ttfb,

          // Memory metrics
          ...memoryInfo,

          // Network metrics
          ...networkInfo,

          // Resource metrics
          ...resourceInfo,
          longTaskCount: prev.longTaskCount, // Keep accumulated count

          // Preserve CPU metrics (updated separately by CPU monitoring effect)
          cpuCores: prev.cpuCores,
          cpuUsage: prev.cpuUsage,
          cpuScore: prev.cpuScore,
          cpuBaseline: prev.cpuBaseline,

          // Preserve GPU metrics (updated separately by GPU monitoring effect)
          gpuVendor: prev.gpuVendor,
          gpuRenderer: prev.gpuRenderer,
          gpuUsage: prev.gpuUsage,
          gpuScore: prev.gpuScore,
          gpuTier: prev.gpuTier,

          // Preserve hardware info (updated separately by hardware detection effect)
          deviceMemory: prev.deviceMemory,
          thermalState: prev.thermalState,

          // Update timeline data (keep last 60 readings for 1-minute history)
          fpsHistory: [...prev.fpsHistory.slice(-59), currentFPS],
          memoryHistory:
            memoryInfo.memoryPercentage !== null
              ? [...prev.memoryHistory.slice(-59), memoryInfo.memoryPercentage]
              : prev.memoryHistory,
          // Preserve CPU/GPU history arrays (updated separately by their respective effects)
          cpuHistory: prev.cpuHistory || [],
          gpuHistory: prev.gpuHistory || [],
        }));

        frames = 0;
        lastTime = currentTime;
      }

      // Only continue measuring if still monitoring
      if (isMonitoring) {
        animationFrameRef.current = requestAnimationFrame(measureFPS);
      }
    }

    animationFrameRef.current = requestAnimationFrame(measureFPS);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    isSafari,
    isChrome,
    isFirefox,
    isEdge,
    isMonitoring,
    monitoringOptions.fps,
    monitoringOptions.memory,
    monitoringOptions.network,
    monitoringOptions.resources,
  ]);

  return {
    ...metrics,
    shouldReduceAnimations,

    // Helper methods
    getOptimizationStatus: () => {
      if (isSafari && shouldReduceAnimations) {
        return "Safari Optimized";
      } else if (isSafari && !shouldReduceAnimations) {
        return "Safari Unoptimized";
      }
      return "Standard";
    },

    getPerformanceGrade: () => {
      if (metrics.fps >= 55) return "Excellent";
      if (metrics.fps >= 40) return "Good";
      if (metrics.fps >= 25) return "Fair";
      return "Poor";
    },

    // Web Vitals helpers
    getWebVitalGrade: (metric: "lcp" | "inp" | "cls" | "fcp" | "ttfb") => {
      const value = metrics[metric];
      if (value === null) return "Measuring...";

      switch (metric) {
        case "lcp":
          return value <= 2500
            ? "Good"
            : value <= 4000
              ? "Needs Improvement"
              : "Poor";
        case "inp":
          return value <= 200
            ? "Good"
            : value <= 500
              ? "Needs Improvement"
              : "Poor";
        case "cls":
          return value <= 0.1
            ? "Good"
            : value <= 0.25
              ? "Needs Improvement"
              : "Poor";
        case "fcp":
          return value <= 1800
            ? "Good"
            : value <= 3000
              ? "Needs Improvement"
              : "Poor";
        case "ttfb":
          return value <= 800
            ? "Good"
            : value <= 1800
              ? "Needs Improvement"
              : "Poor";
        default:
          return "Unknown";
      }
    },

    // Overall Web Vitals score
    getWebVitalsScore: () => {
      const scores = {
        lcp:
          metrics.lcp !== null
            ? metrics.lcp <= 2500
              ? 100
              : metrics.lcp <= 4000
                ? 75
                : 50
            : null,
        inp:
          metrics.inp !== null
            ? metrics.inp <= 200
              ? 100
              : metrics.inp <= 500
                ? 75
                : 50
            : null,
        cls:
          metrics.cls !== null
            ? metrics.cls <= 0.1
              ? 100
              : metrics.cls <= 0.25
                ? 75
                : 50
            : null,
      };

      const validScores = Object.values(scores).filter(
        (score) => score !== null,
      ) as number[];
      if (validScores.length === 0) return null;

      const average =
        validScores.reduce((a, b) => a + b, 0) / validScores.length;
      return Math.round(average);
    },

    // Memory helpers
    getMemoryStatus: () => {
      if (metrics.memoryPercentage === null) return "Unknown";
      if (metrics.memoryPercentage < 50) return "Good";
      if (metrics.memoryPercentage < 80) return "Moderate";
      return "High";
    },

    // Network helpers
    getNetworkQuality: () => {
      const type = metrics.connectionType;
      if (!type) return "Unknown";

      switch (type) {
        case "4g":
          return "Excellent";
        case "3g":
          return "Good";
        case "2g":
          return "Poor";
        case "slow-2g":
          return "Very Poor";
        default:
          return "Unknown";
      }
    },

    // Performance recommendations
    getRecommendations: () => {
      const recommendations: string[] = [];

      if (metrics.fps < 30) {
        recommendations.push(
          "Consider reducing animation complexity or enabling performance mode",
        );
      }

      if (metrics.memoryPercentage && metrics.memoryPercentage > 80) {
        recommendations.push(
          "High memory usage detected - check for memory leaks",
        );
      }

      if (metrics.lcp && metrics.lcp > 2500) {
        recommendations.push(
          "Optimize largest contentful paint - compress images, reduce render-blocking resources",
        );
      }

      if (metrics.inp && metrics.inp > 200) {
        recommendations.push(
          "Improve interaction responsiveness - reduce JavaScript execution time",
        );
      }

      if (metrics.cls && metrics.cls > 0.1) {
        recommendations.push(
          "Reduce layout shifts - specify image dimensions, avoid inserting content",
        );
      }

      if (metrics.longTaskCount > 10) {
        recommendations.push(
          "Break up long tasks - consider code splitting or yielding to main thread",
        );
      }

      // CPU recommendations
      if (metrics.cpuUsage && metrics.cpuUsage > 80) {
        recommendations.push(
          "High CPU usage detected - consider reducing computational load",
        );
      }

      // GPU recommendations
      if (metrics.gpuUsage && metrics.gpuUsage > 90) {
        recommendations.push(
          "High GPU usage detected - reduce visual complexity or lower quality settings",
        );
      }

      if (metrics.gpuTier === "low") {
        recommendations.push(
          "Low-end GPU detected - consider simplified graphics for better performance",
        );
      }

      return recommendations;
    },

    // CPU helpers
    getCpuStatus: () => {
      if (metrics.cpuUsage === null) return "Unknown";
      if (metrics.cpuUsage < 30) return "Low";
      if (metrics.cpuUsage < 60) return "Moderate";
      if (metrics.cpuUsage < 80) return "High";
      return "Critical";
    },

    getCpuGrade: () => {
      if (metrics.cpuUsage === null) return "Unknown";
      if (metrics.cpuUsage < 30) return "Excellent";
      if (metrics.cpuUsage < 50) return "Good";
      if (metrics.cpuUsage < 70) return "Fair";
      return "Poor";
    },

    // GPU helpers
    getGpuStatus: () => {
      if (metrics.gpuUsage === null) return "Unknown";
      if (metrics.gpuUsage < 40) return "Low";
      if (metrics.gpuUsage < 70) return "Moderate";
      if (metrics.gpuUsage < 90) return "High";
      return "Critical";
    },

    getGpuGrade: () => {
      if (metrics.gpuUsage === null) return "Unknown";
      if (metrics.gpuUsage < 40) return "Excellent";
      if (metrics.gpuUsage < 60) return "Good";
      if (metrics.gpuUsage < 80) return "Fair";
      return "Poor";
    },

    getGpuTierLabel: () => {
      switch (metrics.gpuTier) {
        case "high":
          return "High-end";
        case "medium":
          return "Mid-range";
        case "low":
          return "Entry-level";
        default:
          return "Unknown";
      }
    },

    // System thermal state estimation
    getThermalState: () => {
      // Estimate thermal state based on performance degradation
      const cpuPoor = metrics.cpuUsage && metrics.cpuUsage > 80;
      const gpuPoor = metrics.gpuUsage && metrics.gpuUsage > 90;
      const fpsPoor = metrics.fps < 30;

      if (cpuPoor && gpuPoor && fpsPoor) return "critical";
      if ((cpuPoor && gpuPoor) || (cpuPoor && fpsPoor) || (gpuPoor && fpsPoor))
        return "serious";
      if (cpuPoor || gpuPoor || fpsPoor) return "fair";
      return "nominal";
    },

    // Hardware info helpers
    getHardwareInfo: () => {
      const getCpuStatusValue = () => {
        if (metrics.cpuUsage === null) return "Unknown";
        if (metrics.cpuUsage < 30) return "Low";
        if (metrics.cpuUsage < 60) return "Moderate";
        if (metrics.cpuUsage < 80) return "High";
        return "Critical";
      };

      const getGpuStatusValue = () => {
        if (metrics.gpuUsage === null) return "Unknown";
        if (metrics.gpuUsage < 40) return "Low";
        if (metrics.gpuUsage < 70) return "Moderate";
        if (metrics.gpuUsage < 90) return "High";
        return "Critical";
      };

      return {
        cpu: {
          cores: metrics.cpuCores,
          usage: metrics.cpuUsage,
          score: metrics.cpuScore,
          status: getCpuStatusValue(),
        },
        gpu: {
          vendor: metrics.gpuVendor,
          renderer: metrics.gpuRenderer,
          tier: metrics.gpuTier,
          usage: metrics.gpuUsage,
          score: metrics.gpuScore,
          status: getGpuStatusValue(),
        },
        memory: {
          device: metrics.deviceMemory,
          used: metrics.memoryUsed,
          limit: metrics.memoryLimit,
          percentage: metrics.memoryPercentage,
        },
      };
    },
  };
}
