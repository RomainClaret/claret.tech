"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useFpsOnly } from "@/lib/hooks/useFpsOnly";
import { showToast } from "@/components/ui/toast";
import { useTestMode } from "@/components/providers/test-mode-provider";

export enum QualityMode {
  BATTERY_SAVER = "battery",
  LOW = "low",
  BALANCED = "balanced",
  MAXIMUM = "maximum",
}

export interface ComponentConfig {
  animate: boolean;
  particleCount?: number;
  updateFrequency?: number;
  effects?: string[];
  strokeWidth?: number;
  opacity?: number;
  nodeScale?: number;
  connectionOpacity?: number;
  backgroundOpacity?: number;
}

export interface QualityProfile {
  battery: ComponentConfig;
  low: ComponentConfig;
  balanced: ComponentConfig;
  maximum: ComponentConfig;
}

interface QualityContextType {
  quality: QualityMode;
  setQuality: (quality: QualityMode) => void;
  isAuto: boolean;
  setIsAuto: (auto: boolean) => void;
  getConfig: (profile: QualityProfile) => ComponentConfig;

  // Performance metrics
  currentFps: number;
  qualityMetrics: {
    rafCalls: number;
    particles: number;
    shaders: boolean;
    blur: boolean;
    expectedFps: number;
  };
}

const QualityContext = createContext<QualityContextType | undefined>(undefined);

const QUALITY_METRICS = {
  [QualityMode.BATTERY_SAVER]: {
    rafCalls: 10, // 10 FPS for background
    particles: 0, // No particles
    shaders: false, // No WebGL shaders
    blur: false, // No blur effects
    expectedFps: 60, // Should maintain 60 FPS
  },
  [QualityMode.LOW]: {
    rafCalls: 16, // Safari's FPS limit
    particles: 0, // No particles (Safari-safe)
    shaders: false, // No WebGL shaders (Safari limitation)
    blur: false, // No blur effects (Safari limitation)
    expectedFps: 50, // Target 50+ FPS
  },
  [QualityMode.BALANCED]: {
    rafCalls: 30, // 30 FPS for smooth enough
    particles: 100, // Limited particles
    shaders: true, // Simple shaders only
    blur: false, // No expensive blur
    expectedFps: 45, // Target 45+ FPS
  },
  [QualityMode.MAXIMUM]: {
    rafCalls: 60, // Full 60 FPS
    particles: 500, // All particles
    shaders: true, // Complex shaders
    blur: true, // All effects
    expectedFps: 30, // Okay with 30+ FPS
  },
} as const;

export function QualityProvider({ children }: { children: ReactNode }) {
  const { isTestMode } = useTestMode();

  // Initialize with Safari-aware defaults
  const [quality, setQualityState] = useState<QualityMode>(() => {
    if (typeof window === "undefined") return QualityMode.BALANCED;

    // In test mode, use balanced quality without animations
    if (isTestMode) return QualityMode.BALANCED;

    // Check localStorage for saved preference first
    const saved = localStorage.getItem("quality-mode");
    if (saved && Object.values(QualityMode).includes(saved as QualityMode)) {
      return saved as QualityMode;
    }

    // Auto-detect Safari and default to LOW mode for better compatibility
    const isSafari =
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
      /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isSafari) {
      return QualityMode.LOW; // Safari gets low quality by default for better performance
    }

    return QualityMode.BALANCED;
  });

  const [isAuto, setIsAutoState] = useState(() => {
    if (typeof window === "undefined") return true;

    // Disable auto-adjust in test mode
    if (isTestMode) return false;

    const saved = localStorage.getItem("quality-auto");
    return saved ? JSON.parse(saved) : true;
  });

  // FPS monitoring for auto-adjustment
  const fpsData = useFpsOnly(typeof window !== "undefined");
  const [lastAdjustment, setLastAdjustment] = useState(0);

  // Auto-adjust quality based on performance
  useEffect(() => {
    if (!isAuto || typeof window === "undefined" || isTestMode) return;

    const ADJUSTMENT_COOLDOWN = 10000; // 10 seconds between adjustments

    const adjustQuality = () => {
      const now = Date.now();
      if (now - lastAdjustment < ADJUSTMENT_COOLDOWN) return;

      const fps = fpsData.fps || 60;

      // Downgrade if struggling
      if (fps < 20 && quality !== QualityMode.BATTERY_SAVER) {
        setQualityState(QualityMode.BATTERY_SAVER);
        setLastAdjustment(now);
        showToast(
          `🔋 Auto-switched to battery saver mode\nFPS: ${Math.round(fps)}`,
          "warning",
          4000,
        );
        return;
      }

      if (
        fps < 30 &&
        quality !== QualityMode.BATTERY_SAVER &&
        quality !== QualityMode.LOW
      ) {
        setQualityState(QualityMode.LOW);
        setLastAdjustment(now);
        showToast(
          `🔅 Auto-switched to low performance mode\nFPS: ${Math.round(fps)}`,
          "warning",
          4000,
        );
        return;
      }

      if (fps < 45 && quality === QualityMode.MAXIMUM) {
        setQualityState(QualityMode.BALANCED);
        setLastAdjustment(now);
        showToast(
          `⚖️ Auto-switched to balanced mode\nFPS: ${Math.round(fps)}`,
          "info",
          4000,
        );
        return;
      }

      // Upgrade if performing well
      if (fps > 55 && quality === QualityMode.BATTERY_SAVER) {
        setQualityState(QualityMode.LOW);
        setLastAdjustment(now);
        showToast(
          `🔅 Auto-upgraded to low performance mode\nFPS: ${Math.round(fps)}`,
          "success",
          4000,
        );
        return;
      }

      if (fps > 50 && quality === QualityMode.LOW) {
        setQualityState(QualityMode.BALANCED);
        setLastAdjustment(now);
        showToast(
          `⚖️ Auto-upgraded to balanced mode\nFPS: ${Math.round(fps)}`,
          "success",
          4000,
        );
        return;
      }

      if (fps > 50 && quality === QualityMode.BALANCED) {
        setQualityState(QualityMode.MAXIMUM);
        setLastAdjustment(now);
        showToast(
          `🚀 Auto-upgraded to maximum quality\nFPS: ${Math.round(fps)}`,
          "success",
          4000,
        );
        return;
      }
    };

    // Check every 5 seconds, not every frame
    const interval = setInterval(adjustQuality, 5000);
    return () => clearInterval(interval);
  }, [quality, isAuto, fpsData.fps, lastAdjustment, isTestMode]);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("quality-mode", quality);
    }
  }, [quality]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("quality-auto", JSON.stringify(isAuto));
    }
  }, [isAuto]);

  const setQuality = useCallback((newQuality: QualityMode) => {
    // Get current quality for comparison before updating
    setQualityState((currentQuality) => {
      // Show toast for manual quality changes - moved outside state updater
      if (typeof window !== "undefined" && currentQuality !== newQuality) {
        // Use setTimeout to move toast call outside of render phase
        setTimeout(() => {
          const qualityNames = {
            [QualityMode.BATTERY_SAVER]: "Battery Saver",
            [QualityMode.LOW]: "Low Performance",
            [QualityMode.BALANCED]: "Balanced",
            [QualityMode.MAXIMUM]: "Maximum Quality",
          };

          const qualityIcons = {
            [QualityMode.BATTERY_SAVER]: "🔋",
            [QualityMode.LOW]: "🔅",
            [QualityMode.BALANCED]: "⚖️",
            [QualityMode.MAXIMUM]: "🚀",
          };

          showToast(
            `${qualityIcons[newQuality]} Switched to ${qualityNames[newQuality]} mode`,
            "info",
            3000,
          );
        }, 0);
      }
      return newQuality;
    });
    setIsAutoState(false); // Manual selection disables auto
  }, []);

  const setIsAuto = useCallback(
    (auto: boolean) => {
      const wasAuto = isAuto;
      setIsAutoState(auto);

      // Show toast when enabling auto mode
      if (typeof window !== "undefined" && !wasAuto && auto) {
        showToast(
          "🤖 Auto quality adjustment enabled\nQuality will adjust based on performance",
          "info",
          4000,
        );
      }
    },
    [isAuto],
  );

  // Listen for terminal command events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleQualityChange = (event: CustomEvent) => {
      const newQuality = event.detail?.quality;
      if (Object.values(QualityMode).includes(newQuality)) {
        setQuality(newQuality); // Use setQuality to trigger toast
      }
    };

    const handleQualityAuto = () => {
      setIsAutoState(true);
    };

    window.addEventListener(
      "quality-change",
      handleQualityChange as EventListener,
    );
    window.addEventListener("quality-auto", handleQualityAuto);

    return () => {
      window.removeEventListener(
        "quality-change",
        handleQualityChange as EventListener,
      );
      window.removeEventListener("quality-auto", handleQualityAuto);
    };
  }, [setQuality]);

  const getConfig = useCallback(
    (profile: QualityProfile): ComponentConfig => {
      return profile[quality];
    },
    [quality],
  );

  return (
    <QualityContext.Provider
      value={{
        quality,
        setQuality,
        isAuto,
        setIsAuto,
        getConfig,
        currentFps: fpsData.fps || 60,
        qualityMetrics: QUALITY_METRICS[quality],
      }}
    >
      {children}
    </QualityContext.Provider>
  );
}

export function useQuality() {
  const context = useContext(QualityContext);

  // Return a fallback during SSR or when no provider is found
  if (context === undefined) {
    // Default fallback - balanced mode
    return {
      quality: QualityMode.BALANCED,
      setQuality: () => {},
      isAuto: false,
      setIsAuto: () => {},
      getConfig: (profile: QualityProfile): ComponentConfig => profile.balanced,
      currentFps: 60,
      qualityMetrics: QUALITY_METRICS[QualityMode.BALANCED],
    };
  }

  return context;
}

// Predefined quality profiles for common components
export const NEURAL_SIGNAL_PROFILE: QualityProfile = {
  battery: {
    animate: true, // Allow basic pathLength animation for signals
    particleCount: 0,
    strokeWidth: 1, // Ultra-thin lines
    opacity: 0.3, // Very faint
    effects: [],
  },
  low: {
    animate: true, // Animated travel (Safari-safe)
    particleCount: 0, // No particles (Safari-safe)
    strokeWidth: 2, // Thin but visible
    opacity: 0.5, // More visible than battery
    effects: [], // No effects (Safari limitation)
  },
  balanced: {
    animate: true, // Animated travel
    particleCount: 0,
    strokeWidth: 3, // Normal width
    opacity: 0.7, // Clearly visible
    effects: ["glow"],
  },
  maximum: {
    animate: true, // Animated travel
    particleCount: 8, // Many particles
    strokeWidth: 6, // Thick, dramatic lines
    opacity: 1.0, // Full brightness
    effects: ["glow", "blur"], // Rainbow removed to prevent node corruption
  },
};

export const NEURAL_BACKGROUND_PROFILE: QualityProfile = {
  battery: {
    animate: true, // Still animate but slower
    updateFrequency: 10, // 10 FPS
    nodeScale: 0.7, // Smaller nodes
    connectionOpacity: 0.15, // Very faint connections
    backgroundOpacity: 0.1, // Nearly invisible
    effects: [],
  },
  low: {
    animate: true, // Animated (Safari-safe)
    updateFrequency: 16, // Safari's FPS limit
    nodeScale: 0.85, // Slightly smaller nodes
    connectionOpacity: 0.25, // Faint connections
    backgroundOpacity: 0.2, // Subtle background
    effects: [], // No effects (Safari limitation)
  },
  balanced: {
    animate: true,
    updateFrequency: 30, // 30 FPS
    nodeScale: 1.0, // Normal size
    connectionOpacity: 0.4, // Normal connections
    backgroundOpacity: 0.3, // Visible background
    effects: ["glow"],
  },
  maximum: {
    animate: true,
    updateFrequency: 60, // 60 FPS
    nodeScale: 1.4, // Large nodes
    connectionOpacity: 0.8, // Bright connections
    backgroundOpacity: 0.5, // Prominent background
    effects: ["glow", "blur", "ripple"],
  },
};

export const NEURAL_CANVAS_PROFILE: QualityProfile = {
  battery: {
    animate: false,
    particleCount: 0,
    opacity: 0.05, // Very faint for battery saving
    nodeScale: 0.3,
  },
  low: {
    animate: true,
    particleCount: 0,
    opacity: 0.25, // Low visibility
    nodeScale: 0.6,
  },
  balanced: {
    animate: true,
    particleCount: 0, // Will be calculated as Math.floor(nodeCount * 0.3)
    opacity: 0.6, // Good visibility
    nodeScale: 1.0,
  },
  maximum: {
    animate: true,
    particleCount: 0, // Will be calculated as nodeCount
    opacity: 1.0, // Full brightness - very visible
    nodeScale: 1.5, // Larger nodes
  },
};

export const GRID_BACKGROUND_PROFILE: QualityProfile = {
  battery: {
    animate: false,
    opacity: 0.05, // Nearly invisible
    backgroundOpacity: 0.02,
    updateFrequency: 5,
  },
  low: {
    animate: true,
    opacity: 0.2, // Subtle but visible
    backgroundOpacity: 0.08,
    updateFrequency: 10,
  },
  balanced: {
    animate: true,
    opacity: 0.5, // Good visibility
    backgroundOpacity: 0.25,
    updateFrequency: 15,
  },
  maximum: {
    animate: true,
    opacity: 0.8, // Very visible
    backgroundOpacity: 0.5, // Prominent background
    updateFrequency: 30,
  },
};

export const TYPEWRITER_PROFILE: QualityProfile = {
  battery: {
    animate: false, // Static text, no typing animation
  },
  low: {
    animate: true, // Enable typing animation
  },
  balanced: {
    animate: true,
  },
  maximum: {
    animate: true,
  },
};

export const SHOOTING_STARS_PROFILE: QualityProfile = {
  battery: {
    animate: false, // No shooting stars
  },
  low: {
    animate: true, // Enable but slower
    updateFrequency: 5, // Fewer stars
  },
  balanced: {
    animate: true,
    updateFrequency: 10,
  },
  maximum: {
    animate: true,
    updateFrequency: 15, // More frequent stars
  },
};
