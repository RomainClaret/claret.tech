"use client";

import { useState, useEffect, useRef } from "react";
import {
  createRefreshEstimator,
  isSameTimeline,
  observeFrameDelta,
  type RefreshEstimator,
} from "@/lib/quality/refresh-rate";

interface FpsOnlyData {
  fps: number;
  isLowFps: boolean;
  /**
   * The display's measured refresh rate, or null while unknown.
   *
   * Distinct from `fps`: this is what the panel CAN do, not what the page is
   * currently achieving. A machine rendering 45 FPS on a 120Hz screen reports
   * `fps: 45, refreshRate: 120`, and the gap between those two numbers is the
   * available headroom. `fps` alone cannot express that, which is why the
   * quality loop used to treat a loaded fast display as a slow one.
   */
  refreshRate: number | null;
}

/**
 * Frames discarded after the tab becomes visible again.
 *
 * rAF is paused while hidden, so the first callbacks after returning are
 * timed against a stale reference and would poison the delta buffer.
 */
const FRAMES_TO_SKIP_AFTER_RESUME = 5;

/**
 * Ultra-lightweight FPS tracking hook
 * ONLY tracks FPS for auto-disable functionality
 * No CPU/GPU/Memory monitoring - designed for minimal overhead
 *
 * Also estimates the display's refresh rate from the inter-frame deltas this
 * loop was already computing and discarding, so it costs no extra wakeups.
 */
export function useFpsOnly(isEnabled: boolean = true): FpsOnlyData {
  const [fpsData, setFpsData] = useState<FpsOnlyData>({
    fps: 60,
    isLowFps: false,
    refreshRate: null,
  });

  const animationFrameRef = useRef<number>();
  // The delta buffer lives in a ref: it changes every frame and must never
  // trigger a render. Only a change in the estimated rate reaches state, and
  // that happens at most a handful of times per session.
  const estimatorRef = useRef<RefreshEstimator>(createRefreshEstimator());

  useEffect(() => {
    if (!isEnabled || typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    let frames = 0;
    let lastTime = performance.now();
    let lastFrameTime: number | null = null;
    let usingRafClock: boolean | null = null;
    let framesToSkip = FRAMES_TO_SKIP_AFTER_RESUME;

    function measureFPS(rafTimestamp: number) {
      frames++;
      const currentTime = performance.now();

      // Refresh-rate sampling. Skipped while hidden, because rAF is throttled
      // or paused then and the deltas would describe the throttle rather than
      // the display.
      const hidden = typeof document !== "undefined" && document.hidden;
      if (hidden) {
        framesToSkip = FRAMES_TO_SKIP_AFTER_RESUME;
        lastFrameTime = null;
      } else if (framesToSkip > 0) {
        framesToSkip--;
        lastFrameTime = null;
      } else {
        // Time the frame by its rAF argument, not by the clock read here. The
        // argument is the frame's vsync-aligned start, identical for every
        // callback in that frame; performance.now() at this point is that
        // instant plus main-thread dispatch latency. That latency is one-sided,
        // so a late frame followed by an on-time one yields a delta SHORTER
        // than the true interval, and every such error inflates the estimated
        // rate. An inflated ceiling makes the consumer's gate unreachable for
        // the rest of the session, which is worse than not measuring at all.
        //
        // Validate it first: the jsdom stub passes Date.now(), and a timestamp
        // from a foreign time origin would produce confident nonsense.
        const fromRaf = isSameTimeline(rafTimestamp, currentTime);
        if (fromRaf !== usingRafClock) {
          // Straddling two timelines yields one garbage delta at the switch.
          usingRafClock = fromRaf;
          lastFrameTime = null;
        }
        const frameTime = fromRaf ? rafTimestamp : currentTime;

        if (lastFrameTime !== null) {
          const previous = estimatorRef.current.rate;
          estimatorRef.current = observeFrameDelta(
            estimatorRef.current,
            frameTime - lastFrameTime,
          );
          const next = estimatorRef.current.rate;
          if (next !== previous) {
            setFpsData((current) => ({ ...current, refreshRate: next }));
          }
        }
        lastFrameTime = frameTime;
      }

      // Calculate FPS every second
      if (currentTime >= lastTime + 1000) {
        const currentFPS = Math.round(
          (frames * 1000) / (currentTime - lastTime),
        );

        setFpsData((current) => ({
          ...current,
          fps: currentFPS,
          isLowFps: currentFPS < 30, // Simple threshold
        }));

        frames = 0;
        lastTime = currentTime;
      }

      // Re-arm, unless cleanup has run. Testing `isEnabled` here would not do
      // that: it is the value captured when the effect ran, so it is always
      // true and guards nothing. A callback already in flight during cleanup
      // would then schedule the next frame AFTER cancelAnimationFrame, leaving
      // the loop running past unmount.
      if (!cancelled) {
        animationFrameRef.current = window.requestAnimationFrame(measureFPS);
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(measureFPS);

    return () => {
      cancelled = true;
      if (animationFrameRef.current && typeof window !== "undefined") {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isEnabled]);

  return fpsData;
}
