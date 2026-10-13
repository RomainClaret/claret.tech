"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getSnapshot as getMotionGate,
  subscribe as subscribeMotionGate,
} from "@/lib/utils/motion-gate";
import { QUALITY_TUNING } from "@/lib/quality/decide";
import { useIsomorphicLayoutEffect } from "@/lib/hooks/useIsomorphicLayoutEffect";
import { showToast } from "@/components/ui/toast";
import { logWarning } from "@/lib/utils/dev-logger";

interface AutoDisableState {
  isAutoDisabled: boolean;
  /** When the cooldown began: the last auto-disable, or a force. */
  lastAutoDisableTime: number;
  consecutiveLowFpsCount: number;
  /** Within the cooldown: nothing is counted, so nothing switches off. */
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

/** One frame-rate reading, numbered (useFpsOnly's `sample`). */
interface FpsReading {
  fps: number;
  sample: number;
}

const AUTO_DISABLE_STORAGE_KEY = "fps-auto-disable-state";
const COOLDOWN_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Hook for automatically disabling animations when FPS drops below threshold
 * for a sustained period: `durationThreshold` samples in a row.
 */
export function useFpsAutoDisable(
  { fps: currentFps, sample }: FpsReading,
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

  // Not disabled, as the HTML was rendered: the page is generated once for
  // every visitor, so a disable stored for this session is restored after
  // hydration, before the browser paints. Read while rendering, it gave the
  // client's first render another state than the HTML.
  const [state, setState] = useState<AutoDisableState>({
    isAutoDisabled: false,
    lastAutoDisableTime: 0,
    consecutiveLowFpsCount: 0,
    cooldownActive: false,
  });

  useIsomorphicLayoutEffect(() => {
    try {
      // Per session. Kept in localStorage until 2026-10, a disable outlived
      // the visit that triggered it: one slow visit (a busy CPU, battery
      // saver) switched animations off on every later visit, with only a
      // console command to get them back. Clearing the old entry returns them.
      localStorage.removeItem(AUTO_DISABLE_STORAGE_KEY);
      const stored = sessionStorage.getItem(AUTO_DISABLE_STORAGE_KEY);
      if (!stored) return;
      const parsedState = JSON.parse(stored) as AutoDisableState;
      const now = Date.now();
      setState({
        ...parsedState,
        consecutiveLowFpsCount: 0, // Reset on page load
        cooldownActive:
          parsedState.lastAutoDisableTime > 0 &&
          now - parsedState.lastAutoDisableTime < COOLDOWN_DURATION_MS,
      });
    } catch (error) {
      logWarning(
        `Failed to load auto-disable state: ${error}`,
        "fps-auto-disable:load-state",
      );
    }
  }, []);

  // The last sample counted. Counting is per sample, not per run of the
  // effect below: it was keyed on the frame rate, so a steady one never ran
  // it again and the count stalled, and it only worked because the provider
  // passed a new onAutoDisable on every render. An 800 ms clock check stood
  // in for "a new sample", and miscounted when a render landed off the beat.
  const countedSampleRef = useRef(sample);
  const toastShownRef = useRef<boolean>(false);

  // The running tier, whether the page is hidden or covered, and since
  // when. The first seconds at a new tier are spent re-rendering for it,
  // and the quality loop ignores them (settleMs): counted here, the frames
  // the drop to battery itself cost could switch animations off before the
  // battery tier had a chance. The same goes for the first seconds after
  // the page shows again (a background tab, the splash, a modal), when
  // everything that held still restarts. The sampler pauses meanwhile, so
  // the settle could run out unseen, and slow samples from before the
  // pause joined the first one after it as if in a row. The quality loop
  // restarts its window there too.
  const settleRef = useRef({
    tier: getMotionGate().tier,
    suspended: getMotionGate().suspended,
    since: 0,
  });
  useEffect(() => {
    const restart = () => {
      const { tier, suspended } = getMotionGate();
      settleRef.current = { tier, suspended, since: Date.now() };
    };
    restart();
    return subscribeMotionGate(() => {
      const { tier, suspended } = getMotionGate();
      const current = settleRef.current;
      if (tier !== current.tier || suspended !== current.suspended) restart();
    });
  }, []);

  // Persist state for this session
  const persistState = useCallback((newState: AutoDisableState) => {
    if (typeof window === "undefined") return;

    try {
      sessionStorage.setItem(
        AUTO_DISABLE_STORAGE_KEY,
        JSON.stringify(newState),
      );
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

  // The terminal's "animations force", and "animations play" after an
  // auto-disable: a visitor asking for animations. They come back on and
  // the protection pauses for the cooldown, the pause starting now; it is
  // persisted, so a reload in this session keeps it. Clearing the cooldown
  // instead let a page still that slow switch them off again five seconds
  // later, although the terminal said the protection was bypassed.
  const forceEnableAnimations = useCallback(() => {
    const newState: AutoDisableState = {
      isAutoDisabled: false,
      lastAutoDisableTime: Date.now(),
      consecutiveLowFpsCount: 0,
      cooldownActive: true,
    };

    setState(newState);
    persistState(newState);
    toastShownRef.current = false;

    // Defer toast to avoid render cycle issues
    setTimeout(() => {
      showToast(
        `🎬 Animations back on.\nAuto-disable is paused for ${COOLDOWN_DURATION_MS / 60_000} minutes.`,
        "success",
        5000,
      );
    }, 0);
  }, [persistState]);

  // The pause ends on the clock, not on the next sample: samples are only
  // counted at the battery tier with animations on, so after a force at
  // another tier the stored pause outlived its 30 minutes, and the monitor
  // read "Auto-disable paused: 0m" for the rest of the visit.
  useEffect(() => {
    if (!state.cooldownActive || state.lastAutoDisableTime === 0) return;
    const end = () =>
      setState((prevState) => {
        if (!prevState.cooldownActive) return prevState;
        const newState = { ...prevState, cooldownActive: false };
        persistState(newState);
        return newState;
      });
    const left = state.lastAutoDisableTime + COOLDOWN_DURATION_MS - Date.now();
    if (left <= 0) {
      end();
      return;
    }
    const timer = setTimeout(end, left);
    return () => clearTimeout(timer);
  }, [state.cooldownActive, state.lastAutoDisableTime, persistState]);

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

  // Main FPS monitoring effect: once per new sample
  useEffect(() => {
    if (!enabled || currentFps <= 0) return;
    if (sample === countedSampleRef.current) return;
    countedSampleRef.current = sample;

    const now = Date.now();
    const threshold = getThreshold();
    // A last resort: it only counts once the quality loop has already
    // dropped to the battery tier, and that tier has settled. Above that,
    // lowering the tier is the remedy, and switching motion off would
    // pre-empt it.
    const { tier, since } = settleRef.current;
    const atLastResort =
      tier === "battery" && now - since >= QUALITY_TUNING.settleMs;
    const isLowFps = atLastResort && currentFps < threshold;
    const cooldownActive = checkCooldown();

    setState((prevState) => {
      // If already auto-disabled or in cooldown, don't process further
      if (prevState.isAutoDisabled || cooldownActive) {
        if (prevState.cooldownActive === cooldownActive) {
          // Nothing changed: bail out with the same reference so React
          // skips the re-render this per-second tick would otherwise cause.
          return prevState;
        }
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
              `🎬 Performance Protection Active\n\nAnimations automatically disabled due to low FPS (${currentFps} < ${threshold}) for ${durationThreshold} seconds.\n\nThis helps preserve performance on ${browserName}.\n\nTo switch them back on: type "animations force" in the terminal.`,
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

      // Normal path: bail out with the same reference when nothing changed
      // so the per-second FPS ticks stop re-rendering the provider.
      if (
        newConsecutiveCount === prevState.consecutiveLowFpsCount &&
        cooldownActive === prevState.cooldownActive
      ) {
        return prevState;
      }

      const newState: AutoDisableState = {
        ...prevState,
        consecutiveLowFpsCount: newConsecutiveCount,
        cooldownActive,
      };

      persistState(newState);

      return newState;
    });
  }, [
    enabled,
    currentFps,
    sample,
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
