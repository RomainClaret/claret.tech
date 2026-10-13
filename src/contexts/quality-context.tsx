"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useFpsOnly } from "@/lib/hooks/useFpsOnly";
import { useAnimationStateOptional } from "@/contexts/animation-state-context";
import { readStorage, writeStorage } from "@/lib/utils/safe-storage";
import { loadBackoff, saveBackoff, type Backoff } from "@/lib/quality/backoff";
import {
  getSnapshot as getMotionGate,
  setMotionTier,
} from "@/lib/utils/motion-gate";
import { whenIdle } from "@/lib/utils/when-idle";
import { probeDeviceOnce } from "@/lib/quality/probe";
import { showToast } from "@/components/ui/toast";
import { useTestMode } from "@/components/providers/test-mode-provider";
import { useIsomorphicLayoutEffect } from "@/lib/hooks/useIsomorphicLayoutEffect";
import { QualityMode } from "@/lib/quality/mode";
import {
  decideQuality,
  initialQualityState,
  QUALITY_TUNING,
  rebaseOnTier,
  restartWindow,
  type QualityDecisionState,
} from "@/lib/quality/decide";

// Imported for use below and re-exported, so every existing
// `import { QualityMode } from "@/contexts/quality-context"` keeps working.
// It is declared in lib so the pure decision logic can use it without
// importing this context, which would be a cycle.
export { QualityMode };

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

/** The loop's first state, carrying what failed earlier this session. */
const sessionState = (
  tier: QualityMode,
  now: number,
): QualityDecisionState => ({
  ...initialQualityState(tier, now),
  ...loadBackoff(),
});

/** Set once the startup check has started this session at LOW. */
const PROBE_APPLIED_KEY = "quality-probe-applied";

export function QualityProvider({ children }: { children: ReactNode }) {
  const { isTestMode } = useTestMode();

  // The tier and the auto switch the HTML was rendered with. The page is
  // generated for every visitor, so its first render uses the defaults; the
  // visitor's own (storage, browser) are restored by the layout effect
  // below, before the browser paints. Read while rendering, they gave the
  // client's first render other values than the HTML.
  const [quality, setQualityState] = useState<QualityMode>(
    QualityMode.BALANCED,
  );
  const [isAuto, setIsAutoState] = useState(true);
  // Set once the visitor's values are in place. The effects that save,
  // publish or act on the tier wait for it: run with the defaults first,
  // they overwrote the stored choice and probed or adjusted a tier that was
  // never the visitor's.
  const [restored, setRestored] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (isTestMode) {
      // Balanced, without automatic changes.
      setIsAutoState(false);
      setRestored(true);
      return;
    }
    // A tier the visitor chose (auto off) is remembered across visits. A
    // tier the automatic loop chose is remembered for this session only:
    // kept across visits, one slow visit (a busy CPU, battery saver) lowered
    // the site on every visit after it. Through readStorage: where the
    // browser blocks storage, touching it throws.
    const manual = readStorage("local", "quality-auto") === "false";
    const saved = readStorage(manual ? "local" : "session", "quality-mode");
    if (saved && Object.values(QualityMode).includes(saved as QualityMode)) {
      setQualityState(saved as QualityMode);
    } else if (
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
      /iPad|iPhone|iPod/.test(navigator.userAgent)
    ) {
      // Safari gets low quality by default for better performance.
      setQualityState(QualityMode.LOW);
    }
    // Off only when switched off: anything else, including a value that is
    // not JSON (which JSON.parse threw on), means automatic.
    setIsAutoState(!manual);
    setRestored(true);
    // The values a test-mode switch below sets, it sets after this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An end-to-end run's test mode is read from the URL after hydration too
  // (test-mode-provider.tsx): balanced, without automatic changes, as soon
  // as it is known.
  useEffect(() => {
    if (!isTestMode) return;
    setQualityState(QualityMode.BALANCED);
    setIsAutoState(false);
  }, [isTestMode]);

  // The loop below measures the page while it animates. With animations
  // off (Safari's default, the terminal's "animations stop", auto-disable)
  // the page hardly moves, so its frame rate measured the sampler and
  // nothing else, and the loop raised a still page tier after tier on it:
  // a Safari visit went from LOW to BALANCED in its first 20 s. It holds
  // the tier until they play again. AnimationStateProvider sits above this
  // provider; without it (tests, isolated tools) they count as playing.
  const animationsPlaying =
    useAnimationStateOptional()?.areAnimationsPlaying ?? true;
  const loopRuns = restored && isAuto && !isTestMode && animationsPlaying;

  // FPS monitoring for auto-adjustment, and only while the loop below runs:
  // nothing else here reads it. The sampler is a frame callback on every
  // display refresh (120 a second on a 120Hz panel), and each one makes the
  // page run a rendering update. Sampled always, a visitor on a tier of
  // their own paid that all visit for readings nothing used.
  const fpsData = useFpsOnly(loopRuns);
  // Latest fps for the polling interval below WITHOUT being an effect
  // dependency: keying the effect on fps tore down and recreated the poll
  // every second, so the adjustment could starve.
  //
  // Deliberately NOT `|| 60`. rAF is paused in a background tab, so the first
  // frame count after returning divides about one frame by a multi-second gap
  // and rounds to zero; the old fallback turned that worst-case sample into a
  // perfect score and triggered an upgrade. decideQuality discards implausible
  // readings instead, which is only possible if it sees the real value.
  const latestFpsRef = useRef(0);
  latestFpsRef.current = fpsData.fps;
  // The sampler publishes once a second on its own clock; the tick below
  // feeds only a sample it has not fed yet, never the same one twice.
  const latestSampleRef = useRef(0);
  latestSampleRef.current = fpsData.sample;
  const fedSampleRef = useRef(0);
  // What the display can do, as opposed to what the page is achieving. The
  // gap between the two is the headroom the upgrade gate is really asking
  // about.
  const refreshRateRef = useRef<number | null>(null);
  refreshRateRef.current = fpsData.refreshRate;
  // All the auto-adjust bookkeeping (sample window, consecutive counts, per
  // tier backoff, toast rate limit) lives in a ref rather than state: none of
  // it should trigger a render, and keeping it out of the dependency array is
  // what lets the interval run uninterrupted.
  const decisionRef = useRef<QualityDecisionState | null>(null);
  // Set while the auto loop below is stopped (auto off, test mode, or
  // animations off).
  const loopStoppedRef = useRef(false);
  // The backoff last saved (lib/quality/backoff.ts), so the loop, which
  // ticks every second, writes only when a demotion, the recovery owed or
  // the last toast's time changes.
  const savedBackoffRef = useRef<Backoff | null>(null);
  const setDecision = useCallback((state: QualityDecisionState) => {
    decisionRef.current = state;
    const saved = savedBackoffRef.current;
    if (
      saved?.demotions === state.demotions &&
      saved.recoverTo === state.recoverTo &&
      saved.lastToastAt === state.lastToastAt
    ) {
      return;
    }
    savedBackoffRef.current = {
      demotions: state.demotions,
      recoverTo: state.recoverTo,
      lastToastAt: state.lastToastAt,
    };
    saveBackoff(state);
  }, []);

  // Auto-adjust quality based on performance.
  //
  // A thin driver: every decision lives in decideQuality, which is pure and
  // unit tested. The logic this replaced was a guaranteed oscillation
  // (BALANCED up at 50, MAXIMUM down at 45, with the switch itself moving the
  // frame rate across that band) that nothing could observe because it was
  // buried in this effect.
  useEffect(() => {
    if (!restored) return;
    if (!loopRuns || typeof window === "undefined") {
      loopStoppedRef.current = true;
      return;
    }
    // Auto, or animations, switched back on: the window still holds samples
    // from before, and on the same tier the tick's re-base keeps them,
    // so a drop could follow from evidence minutes old. Start it over. Only
    // then: this effect also restarts on the loop's own tier changes, which
    // reset the window already and may have just recorded a recovery owed.
    // After a reload with auto off there is no state in memory yet: restart
    // from the session's, or its saved debt came back with the tier picked
    // by hand, as if still owed.
    if (loopStoppedRef.current) {
      const now = Date.now();
      setDecision(
        restartWindow(
          decisionRef.current ?? sessionState(quality, now),
          quality,
          now,
        ),
      );
    }
    loopStoppedRef.current = false;

    const tick = () => {
      const now = Date.now();
      const stored = decisionRef.current ?? sessionState(quality, now);
      // Quality can change without going through this loop: a manual switch,
      // or a value restored from storage. Re-base on it.
      const current = rebaseOnTier(stored, quality, now);

      // A page covered by the splash or a modal is treated like a hidden
      // one: the frame sampler pauses then, so the reading would be stale,
      // and the page's own motion is suspended anyway.
      const hidden =
        (typeof document !== "undefined" && document.hidden) ||
        getMotionGate().suspended;
      // Visible but no new sample since the last tick (the two clocks drift,
      // and the sampler restarts after a pause): nothing to decide on.
      if (!hidden && latestSampleRef.current === fedSampleRef.current) return;
      fedSampleRef.current = latestSampleRef.current;

      const decision = decideQuality(current, {
        fps: latestFpsRef.current,
        now,
        hidden,
        measuredRefreshRate: refreshRateRef.current,
      });
      setDecision(decision.state);

      if (!decision.next) return;
      setQualityState(decision.next);

      if (!decision.notify) return;
      const isRescue = decision.next === QualityMode.BATTERY_SAVER;
      showToast(
        isRescue
          ? "🔋 Switched to battery saver to keep the site responsive"
          : "🚀 Performance recovered, quality restored",
        isRescue ? "warning" : "success",
        4000,
      );
    };

    // One sample per second, matching what useFpsOnly produces. The decision
    // function does its own smoothing and rate limiting, so polling faster
    // than the data arrives would only discard samples.
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [quality, loopRuns, setDecision, restored]);

  // Save preferences to localStorage
  // Manual choices persist; automatic ones last the session (see above). An
  // automatic tier left in localStorage by an earlier version is dropped.
  useEffect(() => {
    if (!restored) return;
    try {
      if (isAuto) {
        sessionStorage.setItem("quality-mode", quality);
        localStorage.removeItem("quality-mode");
      } else {
        localStorage.setItem("quality-mode", quality);
      }
    } catch {
      // Storage blocked: the tier still applies for this page view.
    }
  }, [quality, isAuto, restored]);

  // Publish the tier to CSS (html[data-quality]) and to the motion gate, so
  // CSS loops and gated components can follow it without React.
  useEffect(() => {
    if (!restored) return;
    document.documentElement.dataset.quality = quality;
    setMotionTier(quality);
  }, [quality, restored]);

  // Read by the startup check's idle callback, which runs after the visitor
  // may have picked a tier by hand.
  const isAutoRef = useRef(isAuto);
  isAutoRef.current = isAuto;
  // And the tier running then, to label the state it saves.
  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  // Machines that may not keep up (software rendering, no WebGL, Save Data)
  // start at LOW instead of measuring seconds of stutter first. Probed once
  // per session, in idle time, which the splash covers. Not on Safari, which
  // starts at LOW already, not in test mode, and never over a manual choice.
  const probedRef = useRef(false);
  useEffect(() => {
    if (!restored || probedRef.current) return;
    probedRef.current = true;
    if (!isAuto || isTestMode) return;
    const isSafari =
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
      /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isSafari) return;
    return whenIdle(() => {
      // A tier picked by hand since mount wins. Forced to LOW anyway, the
      // pick was then saved as LOW, the visitor's "choice".
      if (!isAutoRef.current) return;
      const probe = probeDeviceOnce();
      if (!probe.weak) return;
      // Start at LOW. Where the browser reports software rendering, stay
      // there: LOW runs smoothly on such a machine, which the loop would read
      // as headroom and upgrade straight back into the tier it cannot
      // sustain, so BALANCED is blocked for the session, as if it had already
      // failed here. No WebGL (often a policy, or a hardened browser such as
      // LibreWolf or Tor) and Save-Data (a bandwidth preference) say nothing
      // about speed, since the site draws with Canvas 2D, SVG and CSS: those
      // are blocked for the first backoff step only, then the loop may raise
      // them like any machine. Pinned for the session, a fast desktop with
      // WebGL off ran LOW until it chose a tier by hand.
      //
      // software-webgl is such a report, not WebGL alone in software. Only
      // Chromium fails failIfMajorPerformanceCaveat (Safari ignores it, and
      // Firefox does by default), only when WebGL runs on SwiftShader or
      // WARP, and it then composites and rasterizes in software too
      // (chrome://gpu: "Compositing: Software only"). The perf harness's
      // headless Chromium is one (S7, S8).
      const software =
        probe.reason === "software-renderer" ||
        probe.reason === "software-webgl";
      // Software rendering is applied on every page view: that repeats the
      // block the session's saved backoff restored (lib/quality/backoff.ts)
      // and lowers any tier above LOW. The others are started at LOW once
      // per session. Applied again on reload, they threw away the tier the
      // loop had raised them to and blocked it for another minute.
      if (!software) {
        if (readStorage("session", PROBE_APPLIED_KEY) === "1") return;
        writeStorage("session", PROBE_APPLIED_KEY, "1");
      }
      const now = Date.now();
      // Labelled with the tier this leaves running (LOW where it forces
      // LOW). Labelled LOW whatever ran, a session restored at battery
      // saver was re-based on the next tick, which cleared the recovery the
      // visitor was still owed.
      const running = qualityRef.current;
      const tier =
        running === QualityMode.BALANCED || running === QualityMode.MAXIMUM
          ? QualityMode.LOW
          : running;
      const base = decisionRef.current ?? sessionState(tier, now);
      setDecision({
        ...base,
        demotions: {
          ...base.demotions,
          [QualityMode.BALANCED]: software
            ? {
                count: Number.POSITIVE_INFINITY,
                blockedUntil: Number.POSITIVE_INFINITY,
              }
            : { count: 1, blockedUntil: now + QUALITY_TUNING.backoffMs[0] },
        },
      });
      setQualityState((current) =>
        current === QualityMode.BALANCED || current === QualityMode.MAXIMUM
          ? QualityMode.LOW
          : current,
      );
    });
    // Once per mount, with the visitor's values: re-probing on every auto
    // toggle buys nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  useEffect(() => {
    if (!restored) return;
    writeStorage("local", "quality-auto", String(isAuto));
  }, [isAuto, restored]);

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

  // Memoize the context value so per-second FPS state updates in this
  // provider stop re-rendering every quality consumer.
  const value = useMemo<QualityContextType>(
    () => ({
      quality,
      setQuality,
      isAuto,
      setIsAuto,
      getConfig,
      // Deliberately not reactive (excluded from the deps below): no
      // consumer reads live fps from this context, and a 1Hz dependency
      // would re-render every consumer each second.
      currentFps: fpsData.fps || 60,
      qualityMetrics: QUALITY_METRICS[quality],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quality, setQuality, isAuto, setIsAuto, getConfig],
  );

  return (
    <QualityContext.Provider value={value}>{children}</QualityContext.Provider>
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
    // Particles that travel each signal's path. Eight were drawn while their
    // SMIL clock was broken and they sat still at the path's end; once they
    // moved, eight cost 7 points of main thread at the idle hero and 4,000+
    // style recalculations a second, so three carry the effect.
    particleCount: 3,
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

// updateFrequency is a repaint budget, not a motion speed. A <canvas> that is
// redrawn every display frame has to be re-uploaded and re-composited every
// display frame, and that cost is charged whether the frame drew one line or
// a thousand: measured on the homepage, no-op'ing every fill and stroke while
// still calling clearRect saved nothing (45 fps), while leaving the bitmap
// untouched moved the same page to 78 fps. Every other animated component
// already honors a frequency from this profile; the canvases were the one
// group running at whatever the display would give them.
export const NEURAL_CANVAS_PROFILE: QualityProfile = {
  battery: {
    animate: false,
    particleCount: 0,
    opacity: 0.05, // Very faint for battery saving
    nodeScale: 0.3,
    updateFrequency: 0, // Not animating, so nothing to budget
  },
  low: {
    animate: true,
    particleCount: 0,
    opacity: 0.25, // Low visibility
    nodeScale: 0.6,
    updateFrequency: 15, // 15 repaints/sec
  },
  balanced: {
    animate: true,
    particleCount: 0, // Will be calculated as Math.floor(nodeCount * 0.3)
    opacity: 0.6, // Good visibility
    nodeScale: 1.0,
    updateFrequency: 30, // 30 repaints/sec
  },
  maximum: {
    animate: true,
    particleCount: 0, // Will be calculated as nodeCount
    opacity: 1.0, // Full brightness - very visible
    nodeScale: 1.5, // Larger nodes
    updateFrequency: 60, // 60 repaints/sec
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
