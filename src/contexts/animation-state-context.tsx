"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useCallback,
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

  // Playing, as the HTML was rendered: the page is generated once for every
  // visitor, so neither their stored choice nor their browser can go into
  // the first render. Both are settled in the effect below.
  const [userAnimationPreference, setUserAnimationPreference] = useState(true);

  // FPS auto-disable logic
  const autoDisableState = useFpsAutoDisable(
    { fps: fpsData.fps || 60, sample: fpsData.sample },
    isSafari,
    {
      enabled: shouldMonitorFps && userAnimationPreference, // Only monitor when animations are enabled
      onAutoDisable: () => {
        // When auto-disabled, we don't change user preference, just the effective state
        // This way when the user manually enables animations, their preference is preserved
      },
    },
  );

  // The actual animation state is user preference AND not auto-disabled
  const areAnimationsPlaying =
    userAnimationPreference && !autoDisableState.isAutoDisabled;

  // Once the browser is settled (the Safari provider's mount, which sets
  // isHydrated with the detected browser): the stored choice, or the
  // browser's default. Before that, a check for a changed browser would
  // compare a Safari visitor's stored choice with the page's default and
  // throw it away.
  useEffect(() => {
    if (!isHydrated) return;
    if (shouldResetAnimationPreference(isSafari)) {
      clearAnimationPreference();
    }
    const preference = getAnimationPreference();
    const currentBrowser = isSafari ? "safari" : "other";
    if (preference?.isUserPreference) {
      setUserAnimationPreference(preference.value);
    } else if (preference && preference.browser === currentBrowser) {
      // A browser default stored by an older version of the site.
      setUserAnimationPreference(preference.value);
    } else {
      if (preference) clearAnimationPreference();
      setUserAnimationPreference(!isSafari); // Safari: stopped; others: playing
    }
  }, [isHydrated, isSafari]);

  // Only a visitor's own choice is stored, by the controls below; the
  // browser default is worked out again on every load. An effect here
  // stored every change as "not the visitor's choice", overwriting what a
  // control had just saved, so the next load reset the animations to the
  // browser default.

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
      // Saved as the visitor's choice like the others: unsaved, the sync
      // effect above put a Safari visitor straight back to the default.
      storeAnimationPreference(true, isSafari, true);
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

  const playAnimations = useCallback(() => {
    setUserAnimationPreference(true);
    // Mark as user preference when explicitly changed
    if (typeof window !== "undefined") {
      storeAnimationPreference(true, isSafari, true);
    }
  }, [isSafari]);

  const stopAnimations = useCallback(() => {
    setUserAnimationPreference(false);
    // Mark as user preference when explicitly changed
    if (typeof window !== "undefined") {
      storeAnimationPreference(false, isSafari, true);
    }
  }, [isSafari]);

  const toggleAnimations = useCallback(() => {
    const newValue = !userAnimationPreference;
    setUserAnimationPreference(newValue);
    // Mark as user preference when explicitly changed
    if (typeof window !== "undefined") {
      storeAnimationPreference(newValue, isSafari, true);
    }
  }, [userAnimationPreference, isSafari]);

  // Stable function from the hook (wrapped in useCallback there), pulled out
  // so the dependency below is a plain identifier.
  const clearAutoDisable = autoDisableState.forceEnableAnimations;

  const forceEnableAnimations = useCallback(() => {
    // Clear auto-disable state and enable animations
    clearAutoDisable();
    setUserAnimationPreference(true);
    if (typeof window !== "undefined") {
      storeAnimationPreference(true, isSafari, true);
    }
  }, [clearAutoDisable, isSafari]);

  // Memoize the context value: the FPS hook updates its state every second,
  // so without this every provider render handed all ~12 consumers a fresh
  // object and re-rendered the whole consumer tree at 1Hz forever.
  const value = useMemo<AnimationStateContextType>(
    () => ({
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
      // Deliberately not reactive (excluded from the deps below): fps
      // jitters every second and no consumer reads live fps from this
      // context, so a dependency here would recreate the exact 1Hz
      // re-render storm this memo exists to stop.
      currentFps: fpsData.fps || 60,
      consecutiveLowFpsCount: autoDisableState.consecutiveLowFpsCount,
      progressToAutoDisable: autoDisableState.progressToAutoDisable,

      // Force enable method
      forceEnableAnimations,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      areAnimationsPlaying,
      playAnimations,
      stopAnimations,
      toggleAnimations,
      forceEnableAnimations,
      autoDisableState.isAutoDisabled,
      autoDisableState.cooldownActive,
      autoDisableState.remainingCooldownMinutes,
      autoDisableState.threshold,
      autoDisableState.consecutiveLowFpsCount,
      autoDisableState.progressToAutoDisable,
    ],
  );

  return (
    <AnimationStateContext.Provider value={value}>
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

// Non-throwing variant for shared UI (e.g. HolographicCard) that must also
// render without the provider (tests, isolated tools). Callers treat an
// undefined context as "animations playing".
export function useAnimationStateOptional():
  | AnimationStateContextType
  | undefined {
  return useContext(AnimationStateContext);
}
