/**
 * Estimate a display's true refresh rate from requestAnimationFrame timing.
 *
 * WHY THIS IS POSSIBLE
 * --------------------
 * rAF callbacks are aligned to vsync. When frames are dropped the next
 * callback does not arrive at an arbitrary later time, it arrives one or more
 * WHOLE refresh intervals later. So every inter-frame delta is approximately
 * k * (1 / refreshRate) for some integer k >= 1:
 *
 *   120Hz panel:  deltas cluster at  8.33, 16.67, 25.0, 33.3 ms
 *    60Hz panel:  deltas cluster at 16.67, 33.3,  50.0 ms
 *
 * The smallest delta is therefore the refresh interval, and it survives heavy
 * load: a machine rendering 45 FPS on a 120Hz panel still lands the occasional
 * frame on the very next vsync.
 *
 * WHY THE FRAME COUNTER CANNOT DO THIS
 * ------------------------------------
 * Counting frames per second averages the information away. 45 frames in a
 * second is 45 whether the panel is 60Hz or 120Hz, which is why the quality
 * loop's old "ceiling = max observed FPS" was circular: a fast display that is
 * always load bound looks exactly like a slow one.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * It never guesses. Coarse timers, throttled rAF and displays with unusual
 * rates all produce `null`, and the caller keeps its existing behaviour. A
 * wrong refresh rate is worse than no refresh rate, because the whole point is
 * to decide whether the frame rate is pinned at the ceiling.
 */

/**
 * Panel rates worth recognizing.
 *
 * 30 is deliberately ABSENT. Browsers throttle rAF to 30Hz on battery saver,
 * for occluded windows and in background tabs, so a 33ms delta is far more
 * likely to be a throttle than a 30Hz panel. Leaving it out means that case
 * falls through to `null` and the caller keeps its fallback, which is the
 * honest answer.
 */
export const PLAUSIBLE_REFRESH_RATES = [
  60, 75, 90, 100, 120, 144, 165, 240,
] as const;

export const REFRESH_TUNING = {
  /** Deltas retained. At 120Hz this is about two seconds of frames. */
  bufferSize: 240,
  /** Do not estimate anything before the buffer holds this many deltas. */
  minSamples: 90,

  /**
   * Faster than any panel in PLAUSIBLE_REFRESH_RATES (240Hz is 4.17ms), so a
   * shorter delta is a coalesced or double-fired callback, not a frame.
   */
  minPlausibleDeltaMs: 3.8,
  /** Slower than 10Hz is a stall, not a frame interval. */
  maxPlausibleDeltaMs: 100,

  /**
   * How many deltas must agree before a candidate interval is believed.
   *
   * This is what makes the estimator a CORROBORATED minimum rather than a bare
   * one. A bare minimum is decided by the single shortest reading in the
   * session, so one jittery timestamp would pin the estimate permanently.
   */
  minCorroboration: 5,

  /**
   * The cluster window, as a fraction of the candidate interval.
   *
   * Wide and two-sided, which matters more than it looks. Measured on a real
   * 120Hz display, vsync-aligned deltas do not sit exactly on 8.33ms: they
   * spread roughly 7.3 to 9.3. A narrow one-sided window anchored at the
   * smallest sample caught only the low tail (7.3 to 8.0), averaged to 7.6 and
   * reported 131Hz, which the multiple-fit check then rejected outright. The
   * whole first mode has to be inside the window for its MEAN to land on the
   * true interval.
   *
   * The upper bound stays well clear of 2x, so a dropped-frame delta can never
   * be pulled into the base cluster.
   */
  clusterLow: 0.85,
  clusterHigh: 1.25,
  /**
   * Re-centering passes over the cluster.
   *
   * The first pass is centred on a sample near the bottom of the mode, so its
   * window is offset low and clips the mode's upper tail. Re-centering on the
   * resulting mean pulls the window onto the mode and converges. On the real
   * 120Hz capture this moved the answer from 120.9Hz (82 samples) to 119.5Hz
   * (91 samples), which is the correct centre.
   */
  recenterPasses: 2,

  /**
   * Accepted distance from a known panel rate. Wide enough to absorb 1ms timer
   * quantization (a 120Hz panel reads as 8 or 9ms, i.e. 125 or 111Hz) but
   * narrow enough that nonsense does not get rounded into a plausible answer.
   */
  snapTolerance: 0.08,

  /**
   * How far a delta may sit from the nearest whole multiple of the candidate
   * interval and still count as vsync aligned. Expressed as a fraction of the
   * interval, so it scales with the panel rate.
   */
  multipleTolerance: 0.15,
  /**
   * Fraction of deltas that must fit the k * interval model before the
   * estimate is believed.
   *
   * This is the check that tests the premise instead of assuming it. Measured
   * in headless Chromium, which has no display and therefore no vsync, the
   * deltas came back scattered (9, 12, 13, 18, 22ms) with no common divisor,
   * and a plain corroborated minimum happily reported "165Hz" from that noise.
   * Requiring the rest of the deltas to actually land on multiples rejects it.
   */
  minMultipleFit: 0.7,
} as const;

export interface RefreshEstimator {
  /** Recent inter-frame deltas in ms, oldest first. */
  deltas: readonly number[];
  /** Best estimate so far, or null while unknown. */
  rate: number | null;
}

export function createRefreshEstimator(): RefreshEstimator {
  return { deltas: [], rate: null };
}

/**
 * Snap a raw rate to a known panel rate, or reject it.
 *
 * Nearest match wins rather than first-within-tolerance, because the wide
 * tolerance means the 144 and 165 bands overlap slightly.
 */
export function snapToPlausibleRate(rawRate: number): number | null {
  let best: number | null = null;
  let bestError = Infinity;

  for (const candidate of PLAUSIBLE_REFRESH_RATES) {
    const error = Math.abs(rawRate - candidate) / candidate;
    if (error < bestError) {
      bestError = error;
      best = candidate;
    }
  }

  return bestError <= REFRESH_TUNING.snapTolerance ? best : null;
}

/**
 * The smallest frame interval that enough deltas agree on.
 *
 * Walks candidates up from the shortest delta. For each it takes the MEAN of a
 * wide two-sided window, re-centred so the window settles on the mode rather
 * than on the sample that happened to start it, and returns the first with
 * `minCorroboration` supporting samples.
 *
 * The mean, not the sample. Real vsync deltas scatter around the interval by
 * several percent in both directions, and the smallest of them is short by
 * exactly that scatter. A minimum is therefore BIASED, not merely noisy, and
 * every such error inflates the reported rate.
 *
 * Stepping candidates one at a time is what rejects spurious short readings
 * without a percentile: a handful of bogus 4-6ms deltas form a cluster of two
 * or three, fail the support test, and the walk moves on to the real mode. A
 * percentile anchor would reject those too, but it would also reject the case
 * this whole file exists for, where a heavily loaded machine lands only a
 * handful of frames back-to-back on a fast panel.
 */
export function corroboratedMinimumDelta(
  deltas: readonly number[],
): number | null {
  const t = REFRESH_TUNING;
  const usable = deltas
    .filter((d) => d >= t.minPlausibleDeltaMs && d <= t.maxPlausibleDeltaMs)
    .sort((a, b) => a - b);

  if (usable.length < t.minCorroboration) return null;

  for (let i = 0; i < usable.length; i++) {
    let centre = usable[i];
    let support = 0;

    for (let pass = 0; pass < t.recenterPasses; pass++) {
      const low = centre * t.clusterLow;
      const high = centre * t.clusterHigh;

      let total = 0;
      support = 0;
      for (const delta of usable) {
        if (delta < low || delta > high) continue;
        total += delta;
        support++;
      }

      if (support === 0) break;
      centre = total / support;
    }

    if (support >= t.minCorroboration) return centre;
  }

  return null;
}

/**
 * The refresh rate these deltas imply, or null if they imply nothing credible.
 *
 * Returns null rather than a guess when the timer is too coarse to separate
 * panel rates: Firefox with resistFingerprinting quantizes performance.now()
 * to 100ms, which lands every delta outside the plausible band and falls
 * through here naturally.
 */
export function estimateRefreshRate(deltas: readonly number[]): number | null {
  if (deltas.length < REFRESH_TUNING.minSamples) return null;

  const interval = corroboratedMinimumDelta(deltas);
  if (interval === null || interval <= 0) return null;

  // Test the premise rather than assuming it. If these deltas were not
  // produced by a vsync-aligned clock they will not be whole multiples of
  // anything, and the smallest of them means nothing.
  if (!fitsWholeMultiples(deltas, interval)) return null;

  return snapToPlausibleRate(1000 / interval);
}

/**
 * Do these deltas look like whole multiples of `interval`?
 *
 * The entire method rests on rAF being vsync aligned, which makes every delta
 * k * interval for integer k. Where that does not hold, the shortest delta is
 * just the shortest sample and carries no information about any display.
 */
export function fitsWholeMultiples(
  deltas: readonly number[],
  interval: number,
): boolean {
  const t = REFRESH_TUNING;
  const usable = deltas.filter(
    (d) => d >= t.minPlausibleDeltaMs && d <= t.maxPlausibleDeltaMs,
  );
  if (usable.length < t.minCorroboration) return false;

  let fitting = 0;
  for (const d of usable) {
    const multiple = Math.round(d / interval);
    if (multiple < 1) continue;
    const residual = Math.abs(d - multiple * interval) / interval;
    if (residual <= t.multipleTolerance) fitting++;
  }

  return fitting / usable.length >= t.minMultipleFit;
}

/**
 * Whether a rAF callback argument sits on the same timeline as our clock.
 *
 * The argument is the better signal and should be preferred: it is the
 * frame's vsync-aligned start time, identical for every callback in that
 * frame. `performance.now()` read inside the callback is that instant PLUS
 * however long the main thread took to dispatch, and that latency is
 * one-sided, so a late frame followed by an on-time one produces a delta
 * SHORTER than the true interval. Every such error over-reports the rate, and
 * an over-reported ceiling makes the consumer's gate unreachable for the rest
 * of the session, which is a worse failure than the one this file fixes.
 *
 * It cannot be trusted blindly though: this repo's own jsdom stub passes
 * Date.now(), and a timestamp from a foreign time origin would silently
 * produce confident nonsense.
 */
export function isSameTimeline(
  rafTimestamp: number,
  clockNow: number,
): boolean {
  if (!Number.isFinite(rafTimestamp)) return false;
  const skew = clockNow - rafTimestamp;
  // Frame start is slightly in the past under load, never meaningfully ahead.
  return skew >= -50 && skew <= 1000;
}

/**
 * Record one inter-frame delta.
 *
 * Pure. The caller keeps the returned estimator.
 *
 * The estimate tracks the ROLLING WINDOW rather than latching onto the fastest
 * rate ever seen. Latching looks appealing (a panel's hardware rate does not
 * change) but the effective rate genuinely does: Chrome's Energy Saver lowers
 * the page's refresh rate on battery, iOS Low Power Mode caps at 30, and
 * ProMotion downclocks when content goes static, which this site can cause
 * itself through its stop-animations toggle. A latched-high ceiling in any of
 * those cases leaves a gate the machine can no longer reach, so it would never
 * raise quality again even while pinned at its real, lower ceiling.
 */
export function observeFrameDelta(
  estimator: RefreshEstimator,
  deltaMs: number,
): RefreshEstimator {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return estimator;

  const deltas = [...estimator.deltas, deltaMs].slice(
    -REFRESH_TUNING.bufferSize,
  );

  // Keep the previous reading while the window is inconclusive, so a brief
  // unreadable stretch does not flap the estimate to null and back.
  const measured = estimateRefreshRate(deltas);
  return { deltas, rate: measured ?? estimator.rate };
}
