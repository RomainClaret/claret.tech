"use client";

import { useState, useEffect } from "react";
import {
  estimateRefreshRate,
  isSameTimeline,
  REFRESH_TUNING,
} from "@/lib/quality/refresh-rate";
import {
  getSnapshot as getMotionGate,
  subscribe as subscribeMotionGate,
} from "@/lib/utils/motion-gate";

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
  /**
   * Which one-second sample this is: 0 before the first, then counting up
   * for the life of the page. A consumer polling on its own clock compares it
   * to tell a new sample from one it has already seen.
   */
  sample: number;
}

/**
 * Frames discarded after the tab becomes visible again.
 *
 * rAF is paused while hidden, so the first callbacks after returning are
 * timed against a stale reference and would poison the delta buffer.
 */
const FRAMES_TO_SKIP_AFTER_RESUME = 5;

const INITIAL_DATA: FpsOnlyData = {
  fps: 60,
  isLowFps: false,
  refreshRate: null,
  sample: 0,
};

type Listener = (data: FpsOnlyData) => void;

/*
 * One frame loop for every subscriber. QualityProvider and
 * AnimationStateProvider both need the frame rate; each used to run its own
 * loop, so the page requested two animation frames per vsync forever just to
 * measure itself. Each subscribes only while it uses the readings: the
 * automatic quality loop, and auto-disable at the battery tier. The loop
 * stops when the last subscriber leaves, and pauses while the page is
 * suspended (hidden tab, or covered by the splash or a modal), when the
 * frame rate says nothing about the page.
 */
const listeners = new Set<Listener>();
let data: FpsOnlyData = INITIAL_DATA;
let stopSampler: (() => void) | null = null;
// Never reset, so a sample number is not reused after the loop restarts.
let samplesPublished = 0;

function publish(next: Omit<FpsOnlyData, "sample">) {
  data = { ...next, sample: ++samplesPublished };
  listeners.forEach((listener) => listener(data));
}

function startSampler() {
  if (stopSampler || typeof window === "undefined") return;

  let rafId: number | undefined;
  let running = false;
  let frames = 0;
  let lastTime = performance.now();
  let lastFrameTime: number | null = null;
  let usingRafClock: boolean | null = null;
  let framesToSkip = FRAMES_TO_SKIP_AFTER_RESUME;

  // The most recent inter-frame deltas, in a fixed ring: appending one costs
  // nothing per frame. The refresh-rate estimate (a filter, a sort and a scan
  // over up to 240 values) runs once per second, when the frame rate is
  // published, rather than on every frame.
  const ring = new Array<number>(REFRESH_TUNING.bufferSize);
  let ringCount = 0;
  let ringNext = 0;
  const recentDeltas = () => {
    const start = ringCount < ring.length ? 0 : ringNext;
    const deltas: number[] = [];
    for (let i = 0; i < ringCount; i++) {
      deltas.push(ring[(start + i) % ring.length]);
    }
    return deltas;
  };

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
        const delta = frameTime - lastFrameTime;
        if (Number.isFinite(delta) && delta > 0) {
          ring[ringNext] = delta;
          ringNext = (ringNext + 1) % ring.length;
          ringCount = Math.min(ringCount + 1, ring.length);
        }
      }
      lastFrameTime = frameTime;
    }

    // Calculate FPS every second, and the refresh rate with it
    if (currentTime >= lastTime + 1000) {
      const currentFPS = Math.round((frames * 1000) / (currentTime - lastTime));
      // Keep the previous reading while the window is inconclusive, so a brief
      // unreadable stretch does not flap the estimate to null and back.
      const refreshRate =
        estimateRefreshRate(recentDeltas()) ?? data.refreshRate;

      publish({
        fps: currentFPS,
        isLowFps: currentFPS < 30, // Simple threshold
        refreshRate,
      });

      frames = 0;
      lastTime = currentTime;
    }

    // Re-arm unless the loop was paused or stopped meanwhile: a callback
    // already in flight during cleanup would otherwise schedule the next
    // frame after cancelAnimationFrame and outlive its subscribers.
    if (running) {
      rafId = window.requestAnimationFrame(measureFPS);
    }
  }

  const resume = () => {
    if (running) return;
    running = true;
    // A paused stretch is not frames: start a fresh one-second window.
    frames = 0;
    lastTime = performance.now();
    lastFrameTime = null;
    framesToSkip = FRAMES_TO_SKIP_AFTER_RESUME;
    rafId = window.requestAnimationFrame(measureFPS);
  };

  const pause = () => {
    if (!running) return;
    running = false;
    if (rafId !== undefined) window.cancelAnimationFrame(rafId);
  };

  const followGate = () => {
    if (getMotionGate().suspended) pause();
    else resume();
  };
  const unsubscribeGate = subscribeMotionGate(followGate);
  followGate();

  stopSampler = () => {
    unsubscribeGate();
    pause();
    stopSampler = null;
    data = INITIAL_DATA;
  };
}

/**
 * Ultra-lightweight FPS tracking hook
 * ONLY tracks FPS for auto-disable functionality
 * No CPU/GPU/Memory monitoring - designed for minimal overhead
 *
 * Also estimates the display's refresh rate from the inter-frame deltas this
 * loop already measures, so it costs no extra wakeups. Every caller shares
 * one loop.
 */
export function useFpsOnly(isEnabled: boolean = true): FpsOnlyData {
  const [fpsData, setFpsData] = useState<FpsOnlyData>(() => data);

  useEffect(() => {
    if (!isEnabled || typeof window === "undefined") {
      return;
    }

    listeners.add(setFpsData);
    startSampler();
    setFpsData(data);

    return () => {
      listeners.delete(setFpsData);
      if (listeners.size === 0) stopSampler?.();
    };
  }, [isEnabled]);

  return fpsData;
}
