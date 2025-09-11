"use client";

import { useState, useEffect } from "react";
import { usePerformanceMonitor } from "./usePerformanceMonitor";
import { useSafari } from "./useSafari";

type PerformanceMode = "full" | "reduced" | "minimal";

interface AdaptivePerformanceConfig {
  mode: PerformanceMode;
  shouldReduceAnimations: boolean;
  maxConcurrentAnimations: number;
  maxGpuLayers: number;
  allowInfiniteAnimations: boolean;
  allowComplexBlur: boolean;
  allowHeavyTransforms: boolean;
}

/**
 * Adaptive performance system that automatically adjusts animation quality
 * based on real-time FPS and browser capabilities
 */
export function useAdaptivePerformance() {
  const { fps, averageFps, isLagging, browserInfo } = usePerformanceMonitor();
  const { isSafari } = useSafari();

  const [performanceMode, setPerformanceMode] =
    useState<PerformanceMode>("full");
  const [adaptiveConfig, setAdaptiveConfig] =
    useState<AdaptivePerformanceConfig>({
      mode: "full",
      shouldReduceAnimations: false,
      maxConcurrentAnimations: 20,
      maxGpuLayers: 50,
      allowInfiniteAnimations: true,
      allowComplexBlur: true,
      allowHeavyTransforms: true,
    });

  // Adaptive performance thresholds
  const thresholds = {
    excellent: 55, // Full performance mode
    good: 40, // Reduced performance mode
    minimal: 25, // Minimal performance mode
  };

  // Safari-specific thresholds (more aggressive)
  const safariThresholds = {
    excellent: 50,
    good: 35,
    minimal: 20,
  };

  const activeThresholds = isSafari ? safariThresholds : thresholds;

  useEffect(() => {
    // Determine performance mode based on FPS
    let newMode: PerformanceMode = "full";

    if (averageFps < activeThresholds.minimal) {
      newMode = "minimal";
    } else if (averageFps < activeThresholds.good) {
      newMode = "reduced";
    } else if (averageFps >= activeThresholds.excellent) {
      newMode = "full";
    }

    // Override for Safari - always start with reduced mode
    if (isSafari && newMode === "full") {
      newMode = "reduced";
    }

    // Update mode if changed
    if (newMode !== performanceMode) {
      setPerformanceMode(newMode);
    }

    // Update adaptive config based on mode
    const newConfig: AdaptivePerformanceConfig = (() => {
      switch (newMode) {
        case "minimal":
          return {
            mode: "minimal",
            shouldReduceAnimations: true,
            maxConcurrentAnimations: isSafari ? 1 : 3,
            maxGpuLayers: isSafari ? 5 : 10,
            allowInfiniteAnimations: false,
            allowComplexBlur: false,
            allowHeavyTransforms: false,
          };

        case "reduced":
          return {
            mode: "reduced",
            shouldReduceAnimations: true,
            maxConcurrentAnimations: isSafari ? 3 : 8,
            maxGpuLayers: isSafari ? 10 : 20,
            allowInfiniteAnimations: false,
            allowComplexBlur: !isSafari,
            allowHeavyTransforms: !isSafari,
          };

        case "full":
        default:
          return {
            mode: "full",
            shouldReduceAnimations: isSafari, // Still reduce for Safari even in "full" mode
            maxConcurrentAnimations: isSafari ? 5 : 20,
            maxGpuLayers: isSafari ? 15 : 50,
            allowInfiniteAnimations: !isSafari,
            allowComplexBlur: !isSafari,
            allowHeavyTransforms: true,
          };
      }
    })();

    setAdaptiveConfig(newConfig);
  }, [
    fps,
    averageFps,
    performanceMode,
    isSafari,
    browserInfo,
    activeThresholds,
  ]);

  // Performance recommendations
  const getRecommendations = () => {
    const recommendations: string[] = [];

    if (fps < activeThresholds.good) {
      recommendations.push("Consider reducing animation complexity");
    }

    if (adaptiveConfig.maxConcurrentAnimations < 5) {
      recommendations.push("Limit simultaneous animations");
    }

    if (!adaptiveConfig.allowInfiniteAnimations) {
      recommendations.push("Use finite animations only");
    }

    if (!adaptiveConfig.allowComplexBlur) {
      recommendations.push("Avoid backdrop-filter and complex blur effects");
    }

    if (isSafari) {
      recommendations.push("Safari-specific optimizations active");
    }

    return recommendations;
  };

  // Performance improvement suggestions
  const getImprovementSuggestions = () => {
    const suggestions: string[] = [];

    if (performanceMode === "minimal") {
      suggestions.push(
        "Performance is critical - consider disabling non-essential animations",
      );
      suggestions.push("Reduce GPU layers and complex transforms");
    } else if (performanceMode === "reduced") {
      suggestions.push("Moderate performance issues detected");
      suggestions.push("Consider conditional animation rendering");
    }

    if (isSafari) {
      suggestions.push(
        "Safari browser detected - using optimized rendering path",
      );
    }

    return suggestions;
  };

  return {
    // Current state
    performanceMode,
    config: adaptiveConfig,
    isLagging,

    // Computed properties
    shouldReduceAnimations: adaptiveConfig.shouldReduceAnimations,
    canAnimate: (priority: "low" | "medium" | "high" = "low") => {
      if (performanceMode === "minimal" && priority === "low") return false;
      if (performanceMode === "reduced" && priority === "low" && fps < 35)
        return false;
      return true;
    },

    // Utility functions
    getRecommendations,
    getImprovementSuggestions,

    // Animation helpers
    getAnimationConfig: (type: "pulse" | "fade" | "slide" | "complex") => {
      const baseConfig = {
        duration: type === "complex" ? 2000 : 1000,
        iterations: adaptiveConfig.allowInfiniteAnimations ? "infinite" : 1,
        easing: "ease-in-out",
      };

      if (performanceMode === "minimal") {
        return {
          ...baseConfig,
          duration: baseConfig.duration * 2, // Slower animations
          iterations: 1, // No infinite animations
        };
      }

      if (performanceMode === "reduced") {
        return {
          ...baseConfig,
          duration: baseConfig.duration * 1.5,
          iterations: type === "complex" ? 1 : baseConfig.iterations,
        };
      }

      return baseConfig;
    },

    // Style helpers
    getOptimizedStyles: (element: "background" | "card" | "text" | "image") => {
      const baseStyles: Record<string, string | number> = {};

      if (!adaptiveConfig.allowHeavyTransforms) {
        baseStyles.transform = "none";
        baseStyles.willChange = "auto";
      }

      if (!adaptiveConfig.allowComplexBlur && element === "background") {
        baseStyles.backdropFilter = "none";
        baseStyles.filter = "none";
      }

      return baseStyles;
    },
  };
}
