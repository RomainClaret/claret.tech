"use client";

import { useState } from "react";
import {
  usePerformanceMonitor,
  type MonitoringOptions,
} from "@/lib/hooks/usePerformanceMonitor";
import { performanceLogger } from "@/lib/utils/performance-logger";
import { usePerformanceMonitorContext } from "@/contexts/performance-monitor-context";
import { useAnimationState } from "@/contexts/animation-state-context";
import { cn } from "@/lib/utils";

type TabType =
  | "overview"
  | "vitals"
  | "memory"
  | "network"
  | "resources"
  | "timeline"
  | "system";

interface PerformanceMonitorProps {
  className?: string;
}

/**
 * Real-time performance monitor overlay
 * Shows FPS, GPU layers, animations, and browser optimization status
 */
export function PerformanceMonitor({ className }: PerformanceMonitorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  const {
    isMonitorActive,
    hidePerformanceMonitor,
    monitoringOptions,
    toggleMonitoringOption,
    enableAllMonitoring,
    disableAllMonitoring,
  } = usePerformanceMonitorContext();

  // Animation state for auto-disable information
  const {
    areAnimationsPlaying,
    isAutoDisabled,
    cooldownActive,
    remainingCooldownMinutes,
    fpsThreshold,
    consecutiveLowFpsCount,
    progressToAutoDisable,
  } = useAnimationState();

  const {
    fps,
    averageFps,
    minFps,
    maxFps,
    activeAnimations,
    isLagging,
    browserInfo,
    shouldReduceAnimations,
    getOptimizationStatus,
    getPerformanceGrade,
    // Enhanced metrics
    lcp,
    inp,
    cls,
    fcp,
    ttfb,
    memoryUsed,
    memoryLimit,
    memoryPercentage,
    connectionType,
    effectiveBandwidth,
    rtt,
    saveData,
    resourceCount,
    longTaskCount,
    totalTransferSize,
    fpsHistory,
    memoryHistory,
    // CPU/GPU metrics
    cpuCores,
    cpuUsage,
    cpuScore,
    cpuHistory,
    gpuVendor,
    gpuRenderer,
    gpuUsage,
    gpuScore,
    gpuTier,
    gpuHistory,
    deviceMemory,
    // Helper functions
    getWebVitalGrade,
    getWebVitalsScore,
    getMemoryStatus,
    getNetworkQuality,
    getRecommendations,
    getCpuStatus,
    getCpuGrade,
    getGpuStatus,
    getGpuGrade,
    getGpuTierLabel,
    getThermalState,
  } = usePerformanceMonitor(isMonitorActive, monitoringOptions);

  const getFpsColor = (fpsValue: number) => {
    if (fpsValue >= 55) return "text-green-400";
    if (fpsValue >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "Excellent":
        return "text-green-400";
      case "Good":
        return "text-blue-400";
      case "Fair":
        return "text-yellow-400";
      case "Poor":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getWebVitalColor = (grade: string) => {
    switch (grade) {
      case "Good":
        return "text-green-400";
      case "Needs Improvement":
        return "text-yellow-400";
      case "Poor":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getUsageColor = (usage: number | null) => {
    if (usage === null) return "text-gray-400";
    if (usage < 30) return "text-green-400";
    if (usage < 60) return "text-yellow-400";
    if (usage < 80) return "text-orange-400";
    return "text-red-400";
  };

  const getThermalStateColor = (state: string) => {
    switch (state) {
      case "nominal":
        return "text-green-400";
      case "fair":
        return "text-yellow-400";
      case "serious":
        return "text-orange-400";
      case "critical":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const MiniGraph = ({
    data,
    color = "rgb(59, 130, 246)",
  }: {
    data: number[];
    color?: string;
  }) => {
    if (data.length < 2)
      return <div className="w-16 h-4 bg-gray-800 rounded" />;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    return (
      <svg width="64" height="16" className="bg-gray-800 rounded">
        <polyline
          points={data
            .map(
              (value, index) =>
                `${(index / (data.length - 1)) * 64},${16 - ((value - min) / range) * 14}`,
            )
            .join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1"
        />
      </svg>
    );
  };

  const tabs = [
    { id: "overview", label: "Overview", count: null },
    { id: "vitals", label: "Web Vitals", count: getWebVitalsScore() },
    {
      id: "memory",
      label: "Memory",
      count: memoryPercentage ? `${Math.round(memoryPercentage)}%` : null,
    },
    { id: "network", label: "Network", count: connectionType },
    { id: "resources", label: "Resources", count: resourceCount },
    {
      id: "timeline",
      label: "Timeline",
      count: fpsHistory.length > 0 ? `${fpsHistory.length}s` : null,
    },
    {
      id: "system",
      label: "System",
      count: `${cpuCores}C`,
    },
  ] as const;

  const startPerformanceTest = () => {
    setIsTestRunning(true);
    setTestStartTime(Date.now());

    // Start manual performance logging
    performanceLogger.startLogging({
      name: browserInfo,
      isSafari: browserInfo === "Safari",
      optimizationsEnabled: shouldReduceAnimations,
    });
  };

  const stopPerformanceTest = () => {
    setIsTestRunning(false);
    performanceLogger.stopLogging();
    setTestStartTime(null);
  };

  const getTestDuration = () => {
    if (!testStartTime) return 0;
    return Math.floor((Date.now() - testStartTime) / 1000);
  };

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-[9999] bg-black/90 backdrop-blur-sm border border-gray-600 rounded-lg font-mono text-xs select-none",
        "shadow-lg transition-all duration-200",
        isExpanded ? "w-[400px] max-h-[80vh] overflow-hidden" : "w-36 p-2",
        className,
      )}
      data-performance-monitor-active={isMonitorActive ? "true" : undefined}
    >
      {/* Compact View */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-2 cursor-pointer flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              isLagging ? "bg-red-400 animate-pulse" : "bg-green-400",
            )}
          />
          <span className={getFpsColor(fps)}>{fps} FPS</span>
          {isExpanded && (
            <div className="flex items-center gap-1 ml-2">
              <span
                className={getGradeColor(getPerformanceGrade())}
                title="Performance Grade"
              >
                {getPerformanceGrade()}
              </span>
              {getWebVitalsScore() && (
                <span className="text-blue-400" title="Web Vitals Score">
                  {getWebVitalsScore()}%
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div
            className="text-gray-400 text-[10px] cursor-pointer hover:text-gray-200 px-1"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "−" : "+"}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              hidePerformanceMonitor();
            }}
            className="text-gray-400 hover:text-red-400 text-[10px] px-1 transition-colors"
            title="Close performance monitor (ESC)"
          >
            ×
          </button>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-700 pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "px-2 py-1 text-[10px] rounded transition-colors",
                  activeTab === tab.id
                    ? "bg-blue-800 text-blue-200"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700",
                )}
              >
                {tab.label}
                {tab.count && (
                  <span className="ml-1 text-[9px] opacity-75">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Monitoring Controls */}
          <div className="mb-4 p-3 bg-gray-900 rounded border border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300 text-[11px] font-medium">
                Monitoring Controls
              </span>
              <div className="flex gap-1">
                <button
                  onClick={enableAllMonitoring}
                  className="px-2 py-1 text-[9px] bg-green-800 text-green-200 rounded hover:bg-green-700 transition-colors"
                >
                  All
                </button>
                <button
                  onClick={disableAllMonitoring}
                  className="px-2 py-1 text-[9px] bg-red-800 text-red-200 rounded hover:bg-red-700 transition-colors"
                >
                  FPS Only
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(monitoringOptions).map(([key, enabled]) => {
                if (key === "fps") return null; // FPS is always enabled
                return (
                  <label
                    key={key}
                    className="flex items-center gap-1 cursor-pointer text-[10px]"
                  >
                    <input
                      type="checkbox"
                      id={`monitoring-${key}`}
                      name={`monitoring-${key}`}
                      autoComplete="off"
                      checked={enabled}
                      onChange={() =>
                        toggleMonitoringOption(key as keyof MonitoringOptions)
                      }
                      className="w-3 h-3 rounded"
                    />
                    <span
                      className={enabled ? "text-gray-200" : "text-gray-500"}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-3">
            {activeTab === "overview" && (
              <div className="space-y-3">
                {/* Current Status */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div className="text-gray-400">FPS</div>
                    <div className={getFpsColor(fps)}>{fps}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Grade</div>
                    <div className={getGradeColor(getPerformanceGrade())}>
                      {getPerformanceGrade()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">CPU</div>
                    <div className={getUsageColor(cpuUsage)}>
                      {cpuUsage !== null ? `${cpuUsage}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">GPU</div>
                    <div className={getUsageColor(gpuUsage)}>
                      {gpuUsage !== null ? `${gpuUsage}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Memory</div>
                    <div
                      className={
                        memoryPercentage && memoryPercentage > 80
                          ? "text-red-400"
                          : "text-gray-300"
                      }
                    >
                      {memoryPercentage
                        ? `${Math.round(memoryPercentage)}%`
                        : "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Thermal</div>
                    <div className={getThermalStateColor(getThermalState())}>
                      {getThermalState()}
                    </div>
                  </div>
                </div>

                {/* Browser Status */}
                <div className="p-2 bg-gray-900 rounded border border-gray-700">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 text-[11px]">
                      {browserInfo}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] px-2 py-1 rounded",
                        shouldReduceAnimations
                          ? "bg-green-900 text-green-300"
                          : "bg-yellow-900 text-yellow-300",
                      )}
                    >
                      {getOptimizationStatus()}
                    </span>
                  </div>
                </div>

                {/* Animation Auto-Disable Status */}
                <div className="p-2 bg-gray-900 rounded border border-gray-700">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 text-[11px]">
                      Animation Status
                    </span>
                    <span
                      className={cn(
                        "text-[9px] px-2 py-1 rounded",
                        isAutoDisabled
                          ? "bg-red-900 text-red-300"
                          : areAnimationsPlaying
                            ? "bg-green-900 text-green-300"
                            : "bg-gray-700 text-gray-300",
                      )}
                    >
                      {isAutoDisabled
                        ? "Auto-Disabled"
                        : areAnimationsPlaying
                          ? "Playing"
                          : "Stopped"}
                    </span>
                  </div>

                  {/* Auto-disable details */}
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-gray-400">FPS Threshold:</span>
                      <span className="text-gray-300">{fpsThreshold}</span>
                    </div>

                    {consecutiveLowFpsCount > 0 && !isAutoDisabled && (
                      <div className="flex justify-between">
                        <span className="text-yellow-400">Low FPS Count:</span>
                        <span className="text-yellow-300">
                          {consecutiveLowFpsCount}/5s
                        </span>
                      </div>
                    )}

                    {progressToAutoDisable > 0 && !isAutoDisabled && (
                      <div className="w-full bg-gray-700 rounded-full h-1">
                        <div
                          className="h-1 rounded-full bg-yellow-400 transition-all"
                          style={{ width: `${progressToAutoDisable * 100}%` }}
                        />
                      </div>
                    )}

                    {cooldownActive && (
                      <div className="flex justify-between">
                        <span className="text-blue-400">Cooldown:</span>
                        <span className="text-blue-300">
                          {remainingCooldownMinutes}m
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Recommendations */}
                {getRecommendations().length > 0 && (
                  <div className="p-2 bg-blue-900/20 rounded border border-blue-700/30">
                    <div className="text-blue-300 text-[10px] font-semibold mb-1">
                      Recommendations
                    </div>
                    <ul className="text-[9px] text-blue-200 space-y-1">
                      {getRecommendations()
                        .slice(0, 3)
                        .map((rec, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === "vitals" && (
              <div className="space-y-3">
                {/* Web Vitals Score */}
                {getWebVitalsScore() && (
                  <div className="text-center p-3 bg-gray-900 rounded border border-gray-700">
                    <div className="text-2xl font-bold text-blue-400">
                      {getWebVitalsScore()}%
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Web Vitals Score
                    </div>
                  </div>
                )}

                {/* Core Web Vitals */}
                <div className="grid grid-cols-1 gap-2 text-[11px]">
                  {[
                    {
                      key: "lcp",
                      label: "Largest Contentful Paint",
                      target: "< 2.5s",
                      format: formatTime,
                    },
                    {
                      key: "inp",
                      label: "Interaction to Next Paint",
                      target: "< 200ms",
                      format: formatTime,
                    },
                    {
                      key: "cls",
                      label: "Cumulative Layout Shift",
                      target: "< 0.1",
                      format: (v: number) => v.toFixed(3),
                    },
                    {
                      key: "fcp",
                      label: "First Contentful Paint",
                      target: "< 1.8s",
                      format: formatTime,
                    },
                    {
                      key: "ttfb",
                      label: "Time to First Byte",
                      target: "< 800ms",
                      format: formatTime,
                    },
                  ].map(({ key, label, target, format }) => {
                    const metricsTyped = { lcp, inp, cls, fcp, ttfb };
                    const value =
                      metricsTyped[key as keyof typeof metricsTyped];
                    const grade = getWebVitalGrade(
                      key as "lcp" | "inp" | "cls" | "fcp" | "ttfb",
                    );
                    return (
                      <div
                        key={key}
                        className="flex justify-between items-center p-2 bg-gray-900 rounded"
                      >
                        <div>
                          <div className="text-gray-300">{label}</div>
                          <div className="text-[9px] text-gray-500">
                            {target}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={getWebVitalColor(grade)}>
                            {value !== null ? format(value) : "—"}
                          </div>
                          <div
                            className={cn(
                              "text-[9px]",
                              getWebVitalColor(grade),
                            )}
                          >
                            {grade}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "memory" && (
              <div className="space-y-3">
                {/* Memory Usage */}
                <div className="p-3 bg-gray-900 rounded border border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300 text-[11px]">
                      Memory Usage
                    </span>
                    <span
                      className={cn(
                        "text-[11px]",
                        getMemoryStatus() === "High"
                          ? "text-red-400"
                          : getMemoryStatus() === "Moderate"
                            ? "text-yellow-400"
                            : "text-green-400",
                      )}
                    >
                      {getMemoryStatus()}
                    </span>
                  </div>

                  {memoryPercentage !== null && (
                    <>
                      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                        <div
                          className={cn(
                            "h-2 rounded-full transition-all",
                            memoryPercentage > 80
                              ? "bg-red-400"
                              : memoryPercentage > 50
                                ? "bg-yellow-400"
                                : "bg-green-400",
                          )}
                          style={{
                            width: `${Math.min(memoryPercentage, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <div className="text-gray-400">Used</div>
                          <div className="text-gray-300">
                            {memoryUsed ? formatBytes(memoryUsed) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Limit</div>
                          <div className="text-gray-300">
                            {memoryLimit ? formatBytes(memoryLimit) : "—"}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {memoryHistory.length > 1 && (
                    <div className="mt-3">
                      <div className="text-gray-400 text-[10px] mb-1">
                        Memory Timeline
                      </div>
                      <MiniGraph
                        data={memoryHistory}
                        color={
                          memoryPercentage && memoryPercentage > 80
                            ? "rgb(248, 113, 113)"
                            : "rgb(34, 197, 94)"
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "network" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-gray-900 rounded">
                    <div className="text-gray-400">Connection</div>
                    <div
                      className={cn(
                        getNetworkQuality() === "Excellent"
                          ? "text-green-400"
                          : getNetworkQuality() === "Good"
                            ? "text-blue-400"
                            : getNetworkQuality() === "Poor"
                              ? "text-red-400"
                              : "text-gray-300",
                      )}
                    >
                      {connectionType || "Unknown"}
                    </div>
                    <div className="text-[9px] text-gray-500">
                      {getNetworkQuality()}
                    </div>
                  </div>

                  <div className="p-2 bg-gray-900 rounded">
                    <div className="text-gray-400">Bandwidth</div>
                    <div className="text-gray-300">
                      {effectiveBandwidth ? `${effectiveBandwidth} Mbps` : "—"}
                    </div>
                  </div>

                  <div className="p-2 bg-gray-900 rounded">
                    <div className="text-gray-400">RTT</div>
                    <div className="text-gray-300">
                      {rtt ? `${rtt}ms` : "—"}
                    </div>
                  </div>

                  <div className="p-2 bg-gray-900 rounded">
                    <div className="text-gray-400">Save Data</div>
                    <div
                      className={saveData ? "text-yellow-400" : "text-gray-300"}
                    >
                      {saveData ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "resources" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-gray-900 rounded">
                    <div className="text-gray-400">Resources</div>
                    <div className="text-gray-300">{resourceCount}</div>
                  </div>

                  <div className="p-2 bg-gray-900 rounded">
                    <div className="text-gray-400">Transfer Size</div>
                    <div className="text-gray-300">
                      {formatBytes(totalTransferSize)}
                    </div>
                  </div>

                  <div className="p-2 bg-gray-900 rounded">
                    <div className="text-gray-400">Long Tasks</div>
                    <div
                      className={
                        longTaskCount > 10 ? "text-red-400" : "text-gray-300"
                      }
                    >
                      {longTaskCount}
                    </div>
                  </div>

                  <div className="p-2 bg-gray-900 rounded">
                    <div className="text-gray-400">Animations</div>
                    <div
                      className={
                        activeAnimations > 10
                          ? "text-yellow-400"
                          : "text-gray-300"
                      }
                    >
                      {activeAnimations}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-3">
                {fpsHistory.length > 1 && (
                  <div className="p-3 bg-gray-900 rounded border border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-300 text-[11px]">
                        FPS Timeline
                      </span>
                      <span className="text-gray-400 text-[9px]">
                        {fpsHistory.length}s history
                      </span>
                    </div>
                    <MiniGraph
                      data={fpsHistory}
                      color={
                        averageFps >= 55
                          ? "rgb(34, 197, 94)"
                          : averageFps >= 40
                            ? "rgb(251, 191, 36)"
                            : "rgb(248, 113, 113)"
                      }
                    />
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                      <div>
                        <div className="text-gray-400">Min</div>
                        <div className={getFpsColor(minFps)}>{minFps}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Avg</div>
                        <div className={getFpsColor(averageFps)}>
                          {averageFps}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Max</div>
                        <div className={getFpsColor(maxFps)}>{maxFps}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual Performance Test Controls */}
                <div className="p-3 bg-gray-900 rounded border border-gray-700">
                  <div className="text-gray-300 text-[11px] mb-2">
                    Performance Test
                  </div>
                  <div className="flex gap-2">
                    {!isTestRunning ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startPerformanceTest();
                        }}
                        className="flex-1 bg-green-800 hover:bg-green-700 text-green-200 text-[10px] px-2 py-1 rounded transition-colors"
                      >
                        Start Test
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          stopPerformanceTest();
                        }}
                        className="flex-1 bg-red-800 hover:bg-red-700 text-red-200 text-[10px] px-2 py-1 rounded transition-colors"
                      >
                        Stop ({getTestDuration()}s)
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const exportData = JSON.stringify(
                          {
                            timestamp: new Date().toISOString(),
                            browser: browserInfo,
                            metrics: {
                              fps: {
                                current: fps,
                                average: averageFps,
                                min: minFps,
                                max: maxFps,
                              },
                              webVitals: { lcp, inp, cls, fcp, ttfb },
                              memory: {
                                used: memoryUsed,
                                limit: memoryLimit,
                                percentage: memoryPercentage,
                              },
                              network: {
                                type: connectionType,
                                bandwidth: effectiveBandwidth,
                                rtt,
                              },
                              resources: {
                                count: resourceCount,
                                transferSize: totalTransferSize,
                                longTasks: longTaskCount,
                              },
                              cpu: {
                                cores: cpuCores,
                                usage: cpuUsage,
                                score: cpuScore,
                                status: getCpuStatus(),
                              },
                              gpu: {
                                vendor: gpuVendor,
                                renderer: gpuRenderer,
                                tier: gpuTier,
                                usage: gpuUsage,
                                score: gpuScore,
                                status: getGpuStatus(),
                              },
                              system: {
                                deviceMemory: deviceMemory,
                                thermalState: getThermalState(),
                              },
                            },
                            timeline: {
                              fps: fpsHistory,
                              memory: memoryHistory,
                              cpu: cpuHistory,
                              gpu: gpuHistory,
                            },
                            recommendations: getRecommendations(),
                          },
                          null,
                          2,
                        );

                        const blob = new Blob([exportData], {
                          type: "application/json",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `performance-${browserInfo}-${new Date().toISOString().slice(0, 19)}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="bg-blue-800 hover:bg-blue-700 text-blue-200 text-[10px] px-2 py-1 rounded transition-colors"
                    >
                      Export
                    </button>
                  </div>
                  {isTestRunning && (
                    <div className="text-yellow-400 text-[9px] mt-2 flex items-center gap-1">
                      <div className="w-1 h-1 bg-yellow-400 rounded-full animate-pulse" />
                      Recording metrics...
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "system" && (
              <div className="space-y-3">
                {/* CPU Information */}
                <div className="p-3 bg-gray-900 rounded border border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300 text-[11px]">CPU</span>
                    <span
                      className={cn(
                        "text-[11px]",
                        getGradeColor(getCpuGrade()),
                      )}
                    >
                      {getCpuGrade()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                    <div>
                      <div className="text-gray-400">Cores</div>
                      <div className="text-gray-300">{cpuCores}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Usage</div>
                      <div className={getUsageColor(cpuUsage)}>
                        {cpuUsage !== null ? `${cpuUsage}%` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Score</div>
                      <div className="text-gray-300">
                        {cpuScore !== null ? cpuScore : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Status</div>
                      <div className={getUsageColor(cpuUsage)}>
                        {getCpuStatus()}
                      </div>
                    </div>
                  </div>

                  {cpuHistory.length > 1 && (
                    <div>
                      <div className="text-gray-400 text-[10px] mb-1">
                        CPU Usage Timeline
                      </div>
                      <MiniGraph
                        data={cpuHistory}
                        color={
                          cpuUsage && cpuUsage > 70
                            ? "rgb(248, 113, 113)"
                            : "rgb(34, 197, 94)"
                        }
                      />
                    </div>
                  )}
                </div>

                {/* GPU Information */}
                <div className="p-3 bg-gray-900 rounded border border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300 text-[11px]">GPU</span>
                    <span
                      className={cn(
                        "text-[11px]",
                        getGradeColor(getGpuGrade()),
                      )}
                    >
                      {getGpuGrade()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                    <div>
                      <div className="text-gray-400">Vendor</div>
                      <div
                        className="text-gray-300 truncate"
                        title={gpuVendor || "Unknown"}
                      >
                        {gpuVendor || "Unknown"}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Tier</div>
                      <div
                        className={cn(
                          gpuTier === "high"
                            ? "text-green-400"
                            : gpuTier === "medium"
                              ? "text-blue-400"
                              : gpuTier === "low"
                                ? "text-yellow-400"
                                : "text-gray-300",
                        )}
                      >
                        {getGpuTierLabel()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Usage</div>
                      <div className={getUsageColor(gpuUsage)}>
                        {gpuUsage !== null ? `${gpuUsage}%` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Score</div>
                      <div className="text-gray-300">
                        {gpuScore !== null ? gpuScore : "—"}
                      </div>
                    </div>
                  </div>

                  {gpuRenderer && (
                    <div className="mb-2">
                      <div className="text-gray-400 text-[10px]">Renderer</div>
                      <div
                        className="text-gray-300 text-[9px] truncate"
                        title={gpuRenderer}
                      >
                        {gpuRenderer}
                      </div>
                    </div>
                  )}

                  {gpuHistory.length > 1 && (
                    <div>
                      <div className="text-gray-400 text-[10px] mb-1">
                        GPU Usage Timeline
                      </div>
                      <MiniGraph
                        data={gpuHistory}
                        color={
                          gpuUsage && gpuUsage > 80
                            ? "rgb(248, 113, 113)"
                            : "rgb(59, 130, 246)"
                        }
                      />
                    </div>
                  )}
                </div>

                {/* System Health */}
                <div className="p-3 bg-gray-900 rounded border border-gray-700">
                  <div className="text-gray-300 text-[11px] mb-2">
                    System Health
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <div className="text-gray-400">Thermal State</div>
                      <div className={getThermalStateColor(getThermalState())}>
                        {getThermalState().charAt(0).toUpperCase() +
                          getThermalState().slice(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Device Memory</div>
                      <div className="text-gray-300">
                        {deviceMemory ? `${deviceMemory} GB` : "Unknown"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hardware Summary */}
                <div className="p-2 bg-blue-900/20 rounded border border-blue-700/30">
                  <div className="text-blue-300 text-[10px] font-semibold mb-1">
                    Hardware Summary
                  </div>
                  <div className="text-[9px] text-blue-200 space-y-1">
                    <div>
                      • {cpuCores}-core CPU{" "}
                      {cpuUsage !== null ? `at ${cpuUsage}% usage` : ""}
                    </div>
                    <div>
                      • {getGpuTierLabel()} GPU{" "}
                      {gpuUsage !== null ? `at ${gpuUsage}% usage` : ""}
                    </div>
                    <div>
                      •{" "}
                      {memoryPercentage
                        ? `${Math.round(memoryPercentage)}% memory used`
                        : "Memory usage unknown"}
                    </div>
                    <div>• Thermal state: {getThermalState()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 mt-3 border-t border-gray-700 text-gray-500 text-[9px] text-center">
            {process.env.NODE_ENV === "development"
              ? "Dev Mode"
              : "Terminal: fps"}{" "}
            • ESC to close
          </div>
        </div>
      )}
    </div>
  );
}
