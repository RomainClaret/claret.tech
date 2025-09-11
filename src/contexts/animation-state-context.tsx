"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useSafariContext } from "@/contexts/safari-context";
import {
  getAnimationPreference,
  storeAnimationPreference,
  shouldResetAnimationPreference,
  clearAnimationPreference,
} from "@/lib/utils/safari-detection";
import { useFpsOnly } from "@/lib/hooks/useFpsOnly";
import { useFpsAutoDisable } from "@/lib/hooks/useFpsAutoDisable";

interface AnimationStateContextType {
  areAnimationsPlaying: boolean;
  playAnimations: () => void;
  stopAnimations: () => void;
  toggleAnimations: () => void;

  // Auto-disable related properties
  isAutoDisabled: boolean;
  cooldownActive: boolean;
  remainingCooldownMinutes: number;
  fpsThreshold: number;
  currentFps: number;
  consecutiveLowFpsCount: number;
  progressToAutoDisable: number;

  // Force enable method (for console command)
  forceEnableAnimations: () => void;
}

const AnimationStateContext = createContext<
  AnimationStateContextType | undefined
>(undefined);

export function AnimationStateProvider({ children }: { children: ReactNode }) {
  const { isSafari, isHydrated } = useSafariContext();

  // Lightweight FPS tracking (only for auto-disable)
  const shouldMonitorFps = isHydrated && typeof window !== "undefined";
  const fpsData = useFpsOnly(shouldMonitorFps);

  // Initialize user animation preference state with hydration-safe defaults
  const [userAnimationPreference, setUserAnimationPreference] = useState(() => {
    // During SSR, always return true to avoid hydration mismatch
    if (typeof window === "undefined") {
      return true;
    }

    // On client, use browser-appropriate defaults
    const browserDefault = !isSafari; // Safari = false (stopped), others = true (playing)

    // Check if browser changed and clear preference if needed
    if (shouldResetAnimationPreference(isSafari)) {
      clearAnimationPreference();
      return browserDefault;
    }

    // Check for existing preference
    const preference = getAnimationPreference();
    if (preference && preference.isUserPreference) {
      return preference.value;
    }

    // If we have a stored preference but it's a browser default, validate it matches current browser
    if (preference && !preference.isUserPreference) {
      const currentBrowser = isSafari ? "safari" : "other";
      if (preference.browser === currentBrowser) {
        return preference.value;
      } else {
        // Browser changed but wasn't caught by shouldResetAnimationPreference
        clearAnimationPreference();
      }
    }

    // Use browser default
    return browserDefault;
  });

  // FPS auto-disable logic
  const autoDisableState = useFpsAutoDisable(fpsData.fps || 60, isSafari, {
    enabled: shouldMonitorFps && userAnimationPreference, // Only monitor when animations are enabled
    onAutoDisable: () => {
      // When auto-disabled, we don't change user preference, just the effective state
      // This way when the user manually enables animations, their preference is preserved
    },
  });

  // The actual animation state is user preference AND not auto-disabled
  const areAnimationsPlaying =
    userAnimationPreference && !autoDisableState.isAutoDisabled;

  // Sync animation preference after hydration
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;

    // On first hydration, set correct browser default if no user preference exists
    const preference = getAnimationPreference();
    if (!preference || !preference.isUserPreference) {
      const correctDefault = !isSafari;
      if (userAnimationPreference !== correctDefault) {
        setUserAnimationPreference(correctDefault);
      }
    }
  }, [isHydrated, isSafari, userAnimationPreference]);

  // Store animation preference when it changes
  useEffect(() => {
    // Only store after hydration to ensure consistency
    if (isHydrated && typeof window !== "undefined") {
      // Store as browser default (not user preference)
      // Will be marked as user preference when user explicitly changes it
      storeAnimationPreference(userAnimationPreference, isSafari, false);
    }
  }, [userAnimationPreference, isHydrated, isSafari]);

  // Listen for terminal command events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAnimationPlay = () => {
      setUserAnimationPreference(true);
      // Store preference immediately for better sync
      if (typeof window !== "undefined") {
        storeAnimationPreference(true, isSafari, true);
      }
      // Also force enable if auto-disabled to make play command more reliable
      if (autoDisableState.isAutoDisabled) {
        autoDisableState.forceEnableAnimations();
      }
    };

    const handleAnimationStop = () => {
      setUserAnimationPreference(false);
      // Store preference immediately for better sync
      if (typeof window !== "undefined") {
        storeAnimationPreference(false, isSafari, true);
      }
    };

    const handleAnimationForce = () => {
      // Force enable through auto-disable system
      autoDisableState.forceEnableAnimations();
      setUserAnimationPreference(true);
    };

    window.addEventListener("animation-play", handleAnimationPlay);
    window.addEventListener("animation-stop", handleAnimationStop);
    window.addEventListener("animation-force", handleAnimationForce);

    return () => {
      window.removeEventListener("animation-play", handleAnimationPlay);
      window.removeEventListener("animation-stop", handleAnimationStop);
      window.removeEventListener("animation-force", handleAnimationForce);
    };
  }, [autoDisableState, isSafari]);

  const playAnimations = () => {
    setUserAnimationPreference(true);
    // Mark as user preference when explicitly changed
    if (typeof window !== "undefined") {
      storeAnimationPreference(true, isSafari, true);
    }
  };

  const stopAnimations = () => {
    setUserAnimationPreference(false);
    // Mark as user preference when explicitly changed
    if (typeof window !== "undefined") {
      storeAnimationPreference(false, isSafari, true);
    }
  };

  const toggleAnimations = () => {
    const newValue = !userAnimationPreference;
    setUserAnimationPreference(newValue);
    // Mark as user preference when explicitly changed
    if (typeof window !== "undefined") {
      storeAnimationPreference(newValue, isSafari, true);
    }
  };

  const forceEnableAnimations = () => {
    // Clear auto-disable state and enable animations
    autoDisableState.forceEnableAnimations();
    setUserAnimationPreference(true);
    if (typeof window !== "undefined") {
      storeAnimationPreference(true, isSafari, true);
    }
  };

  return (
    <AnimationStateContext.Provider
      value={{
        // Basic animation state
        areAnimationsPlaying,
        playAnimations,
        stopAnimations,
        toggleAnimations,

        // Auto-disable related properties
        isAutoDisabled: autoDisableState.isAutoDisabled,
        cooldownActive: autoDisableState.cooldownActive,
        remainingCooldownMinutes: autoDisableState.remainingCooldownMinutes,
        fpsThreshold: autoDisableState.threshold,
        currentFps: fpsData.fps || 60,
        consecutiveLowFpsCount: autoDisableState.consecutiveLowFpsCount,
        progressToAutoDisable: autoDisableState.progressToAutoDisable,

        // Force enable method
        forceEnableAnimations,
      }}
    >
      {children}
    </AnimationStateContext.Provider>
  );
}

export function useAnimationState() {
  const context = useContext(AnimationStateContext);
  if (context === undefined) {
    throw new Error(
      "useAnimationState must be used within an AnimationStateProvider",
    );
  }
  return context;
}
