"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { showToast } from "@/components/ui/toast";
import { logWarning } from "@/lib/utils/dev-logger";

interface AutoDisableState {
  isAutoDisabled: boolean;
  lastAutoDisableTime: number;
  consecutiveLowFpsCount: number;
  cooldownActive: boolean;
}

interface FpsAutoDisableOptions {
  enabled?: boolean;
  safariThreshold?: number;
  standardThreshold?: number;
  durationThreshold?: number; // seconds
  cooldownDuration?: number; // minutes
  onAutoDisable?: () => void;
}

const AUTO_DISABLE_STORAGE_KEY = "fps-auto-disable-state";
const COOLDOWN_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Hook for automatically disabling animations when FPS drops below threshold
 * for a sustained period
 */
export function useFpsAutoDisable(
  currentFps: number,
  isSafari: boolean = false,
  options: FpsAutoDisableOptions = {},
) {
  const {
    enabled = true,
    safariThreshold = 20,
    standardThreshold = 25,
    durationThreshold = 5, // 5 seconds
    cooldownDuration = 30, // 30 minutes
    onAutoDisable,
  } = options;

  const [state, setState] = useState<AutoDisableState>(() => {
    if (typeof window === "undefined") {
      return {
        isAutoDisabled: false,
        lastAutoDisableTime: 0,
        consecutiveLowFpsCount: 0,
        cooldownActive: false,
      };
    }

    try {
      const stored = localStorage.getItem(AUTO_DISABLE_STORAGE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored) as AutoDisableState;
        const now = Date.now();
        const cooldownActive =
          parsedState.lastAutoDisableTime > 0 &&
          now - parsedState.lastAutoDisableTime < COOLDOWN_DURATION_MS;

        return {
          ...parsedState,
          consecutiveLowFpsCount: 0, // Reset on page load
          cooldownActive,
        };
      }
    } catch (error) {
      logWarning(
        `Failed to load auto-disable state: ${error}`,
        "fps-auto-disable:load-state",
      );
    }

    return {
      isAutoDisabled: false,
      lastAutoDisableTime: 0,
      consecutiveLowFpsCount: 0,
      cooldownActive: false,
    };
  });

  const lastCheckTimeRef = useRef<number>(Date.now());
  const toastShownRef = useRef<boolean>(false);

  // Persist state to localStorage
  const persistState = useCallback((newState: AutoDisableState) => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(AUTO_DISABLE_STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      logWarning(
        `Failed to persist auto-disable state: ${error}`,
        "fps-auto-disable:persist-state",
      );
    }
  }, []);

  // Get the appropriate threshold based on browser
  const getThreshold = useCallback(() => {
    return isSafari ? safariThreshold : standardThreshold;
  }, [isSafari, safariThreshold, standardThreshold]);

  // Force enable animations (for console command)
  const forceEnableAnimations = useCallback(() => {
    const newState: AutoDisableState = {
      isAutoDisabled: false,
      lastAutoDisableTime: 0,
      consecutiveLowFpsCount: 0,
      cooldownActive: false,
    };

    setState(newState);
    persistState(newState);
    toastShownRef.current = false;

    // Defer toast to avoid render cycle issues
    setTimeout(() => {
      showToast(
        "🎬 Animations force-enabled!\nCooldown period cleared.",
        "success",
        5000,
      );
    }, 0);
  }, [persistState]);

  // Check cooldown status
  const checkCooldown = useCallback(() => {
    if (state.lastAutoDisableTime === 0) return false;

    const now = Date.now();
    const timeSinceLastDisable = now - state.lastAutoDisableTime;
    return timeSinceLastDisable < COOLDOWN_DURATION_MS;
  }, [state.lastAutoDisableTime]);

  // Get remaining cooldown time in minutes
  const getRemainingCooldownTime = useCallback(() => {
    if (!state.cooldownActive || state.lastAutoDisableTime === 0) return 0;

    const now = Date.now();
    const elapsed = now - state.lastAutoDisableTime;
    const remaining = COOLDOWN_DURATION_MS - elapsed;
    return Math.max(0, Math.ceil(remaining / (60 * 1000))); // Convert to minutes
  }, [state.cooldownActive, state.lastAutoDisableTime]);

  // Main FPS monitoring effect
  useEffect(() => {
    if (!enabled || currentFps <= 0) return;

    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckTimeRef.current;

    // Only check every ~1 second (allow some tolerance)
    if (timeSinceLastCheck < 800) return;

    lastCheckTimeRef.current = now;

    const threshold = getThreshold();
    const isLowFps = currentFps < threshold;
    const cooldownActive = checkCooldown();

    setState((prevState) => {
      // If already auto-disabled or in cooldown, don't process further
      if (prevState.isAutoDisabled || cooldownActive) {
        return {
          ...prevState,
          cooldownActive,
        };
      }

      const newConsecutiveCount = isLowFps
        ? prevState.consecutiveLowFpsCount + 1
        : 0;

      // Check if we should auto-disable
      const shouldAutoDisable = newConsecutiveCount >= durationThreshold;

      if (shouldAutoDisable) {
        // Auto-disable animations
        const newState: AutoDisableState = {
          isAutoDisabled: true,
          lastAutoDisableTime: now,
          consecutiveLowFpsCount: newConsecutiveCount,
          cooldownActive: false,
        };

        // Show toast notification (only once) - defer to next tick to avoid render cycle issues
        if (!toastShownRef.current) {
          toastShownRef.current = true;
          const browserName = isSafari ? "Safari" : "this browser";

          // Use setTimeout to defer toast to next tick and avoid updating during render
          setTimeout(() => {
            showToast(
              `🎬 Performance Protection Active\n\nAnimations automatically disabled due to low FPS (${currentFps} < ${threshold}) for ${durationThreshold} seconds.\n\nThis helps preserve performance on ${browserName}.\n\nForce re-enable: Type "animation force" in console`,
              "warning",
              12000, // 12 seconds for important message
            );
          }, 0);
        }

        // Call the callback
        onAutoDisable?.();

        // Persist the new state
        persistState(newState);

        return newState;
      }

      // Normal state update
      const newState: AutoDisableState = {
        ...prevState,
        consecutiveLowFpsCount: newConsecutiveCount,
        cooldownActive,
      };

      // Only persist if something meaningful changed
      if (
        newState.consecutiveLowFpsCount !== prevState.consecutiveLowFpsCount ||
        newState.cooldownActive !== prevState.cooldownActive
      ) {
        persistState(newState);
      }

      return newState;
    });
  }, [
    enabled,
    currentFps,
    durationThreshold,
    getThreshold,
    checkCooldown,
    onAutoDisable,
    persistState,
    isSafari,
  ]);

  // Reset toast flag when auto-disable is cleared
  useEffect(() => {
    if (!state.isAutoDisabled) {
      toastShownRef.current = false;
    }
  }, [state.isAutoDisabled]);

  return {
    // State
    isAutoDisabled: state.isAutoDisabled,
    cooldownActive: state.cooldownActive,
    consecutiveLowFpsCount: state.consecutiveLowFpsCount,

    // Computed values
    threshold: getThreshold(),
    remainingCooldownMinutes: getRemainingCooldownTime(),
    progressToAutoDisable: Math.min(
      state.consecutiveLowFpsCount / durationThreshold,
      1,
    ),

    // Actions
    forceEnableAnimations,

    // Configuration
    durationThreshold,
    cooldownDuration,
  };
}
