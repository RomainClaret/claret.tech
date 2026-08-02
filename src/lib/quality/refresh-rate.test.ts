import { describe, it, expect } from "vitest";
import {
  createRefreshEstimator,
  observeFrameDelta,
  estimateRefreshRate,
  fitsWholeMultiples,
  isSameTimeline,
  snapToPlausibleRate,
  corroboratedMinimumDelta,
  REFRESH_TUNING,
} from "./refresh-rate";

/**
 * The property under test is physical: rAF deltas are integer multiples of the
 * vsync interval, so the corroborated smallest delta reveals the panel rate
 * even when the machine is nowhere near rendering at it. That is the thing a
 * frames-per-second counter structurally cannot recover.
 */

const interval = (hz: number) => 1000 / hz;

/** N deltas at a fixed rate. */
function steady(hz: number, count: number): number[] {
  return Array.from({ length: count }, () => interval(hz));
}

/** Feed deltas through the estimator and return the final rate. */
function estimate(deltas: number[]): number | null {
  let state = createRefreshEstimator();
  for (const d of deltas) state = observeFrameDelta(state, d);
  return state.rate;
}

describe("estimateRefreshRate", () => {
  it("reads 60Hz from a machine rendering at 60", () => {
    expect(estimate(steady(60, 200))).toBe(60);
  });

  it("reads 120Hz from a machine rendering at 120", () => {
    expect(estimate(steady(120, 200))).toBe(120);
  });

  it("reads 144Hz", () => {
    expect(estimate(steady(144, 200))).toBe(144);
  });

  it("recovers 120Hz from a machine only rendering 45 FPS on it", () => {
    // THE HEADLINE CASE. This is precisely what the old approach could not do:
    // 45 frames per second is 45 whether the panel is 60Hz or 120Hz, so a
    // frame counter reports 45 and the ceiling stays at its 60 default.
    //
    // The deltas tell a different story. At 45 FPS on a 120Hz panel the frame
    // times are whole multiples of 8.33ms: mostly two or three intervals, with
    // the occasional frame landing on the very next vsync.
    const deltas: number[] = [];
    for (let i = 0; i < 200; i++) {
      // ~5% land on the next vsync, the rest miss one or two.
      const multiple = i % 20 === 0 ? 1 : i % 2 === 0 ? 2 : 3;
      deltas.push(interval(120) * multiple);
    }

    expect(estimate(deltas)).toBe(120);
  });

  it("does not claim 120Hz for a genuine 60Hz panel under load", () => {
    // Same shape as above but the underlying interval is 16.67ms. Nothing here
    // should be mistaken for a faster display.
    const deltas: number[] = [];
    for (let i = 0; i < 200; i++) {
      const multiple = i % 20 === 0 ? 1 : i % 2 === 0 ? 2 : 3;
      deltas.push(interval(60) * multiple);
    }

    expect(estimate(deltas)).toBe(60);
  });

  it("is not moved off 60 by a few spurious short readings", () => {
    // A bare minimum would be decided by the single shortest sample and pin
    // the estimate at a nonsense rate for the whole session.
    const deltas = steady(60, 200);
    deltas[10] = 5;
    deltas[99] = 6;
    deltas[150] = 4;

    expect(estimate(deltas)).toBe(60);
  });

  it("survives 1ms timer quantization, which Safari and Firefox apply", () => {
    // A 120Hz panel reads as 8 or 9ms once timestamps are rounded, i.e. 125Hz
    // or 111Hz. Both must still snap to 120.
    const quantized = Array.from({ length: 200 }, (_, i) =>
      i % 3 === 0 ? 9 : 8,
    );

    expect(estimate(quantized)).toBe(120);
  });

  it("returns null for coarse timers rather than guessing", () => {
    // Firefox with resistFingerprinting quantizes performance.now() to 100ms,
    // so deltas are 0 or 100 and neither is a credible frame interval.
    const coarse = Array.from({ length: 200 }, (_, i) =>
      i % 5 === 0 ? 100 : 0,
    );

    expect(estimate(coarse)).toBeNull();
  });

  it("returns null for a throttled 30Hz rAF rather than reporting a 30Hz panel", () => {
    // Battery saver and occluded windows throttle rAF. 30 is deliberately not
    // a recognized panel rate, so this falls through to the caller's fallback.
    expect(estimate(steady(30, 200))).toBeNull();
  });

  it("returns null before it has seen enough frames", () => {
    expect(estimate(steady(60, REFRESH_TUNING.minSamples - 1))).toBeNull();
  });

  it("returns null for an interval matching no plausible panel", () => {
    // 22Hz is not a display, it is a stall.
    expect(estimate(steady(22, 200))).toBeNull();
  });

  it("rejects deltas that are not whole multiples of anything", () => {
    // Measured from real headless Chromium, which has no display and so no
    // vsync: the deltas came back scattered with no common divisor. A plain
    // corroborated minimum reported "165Hz" from this, which is meaningless.
    // The multiple-fit check is what refuses it.
    const scattered = [9, 12, 13, 18, 22, 11, 15, 19, 26, 14];
    const noise = Array.from(
      { length: 200 },
      (_, i) => scattered[i % scattered.length] + (i % 3) * 0.7,
    );

    expect(estimate(noise)).toBeNull();
  });

  it("accepts deltas that do land on whole multiples", () => {
    // The same span of values, but genuinely 1x, 2x and 3x of 8.33ms.
    const aligned = Array.from(
      { length: 200 },
      (_, i) => interval(120) * ((i % 3) + 1),
    );

    expect(estimate(aligned)).toBe(120);
  });

  it("ignores non-finite and non-positive deltas", () => {
    let state = createRefreshEstimator();
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      state = observeFrameDelta(state, bad);
    }

    expect(state.deltas).toEqual([]);
    expect(state.rate).toBeNull();
  });
});

describe("estimator behaviour over a session", () => {
  it("follows the panel down when the effective rate genuinely drops", () => {
    // Latching onto the fastest rate ever seen looks safe, and is not. Chrome's
    // Energy Saver lowers the page's refresh rate on battery, iOS Low Power
    // Mode caps at 30, and ProMotion downclocks for static content, which this
    // site triggers itself through its stop-animations toggle. A ceiling stuck
    // at 120 in any of those cases leaves a gate the machine can no longer
    // reach, so it would never raise quality again while pinned at its real
    // ceiling. Tracking the rolling window is what avoids that dead end.
    let state = createRefreshEstimator();
    for (const d of steady(120, 200)) state = observeFrameDelta(state, d);
    expect(state.rate).toBe(120);

    for (const d of steady(60, 400)) state = observeFrameDelta(state, d);
    expect(state.rate).toBe(60);
  });

  it("holds the last reading through a stretch it cannot read", () => {
    // Dropping to null on a brief unreadable patch would flap the consumer's
    // ceiling between measured and fallback. Deltas at an implausible rate
    // produce no estimate, and the previous one stands.
    let state = createRefreshEstimator();
    for (const d of steady(120, 200)) state = observeFrameDelta(state, d);
    expect(state.rate).toBe(120);

    for (const d of steady(22, 100)) state = observeFrameDelta(state, d);
    expect(state.rate).toBe(120);
  });

  it("upgrades once a faster rate is proven", () => {
    let state = createRefreshEstimator();
    for (const d of steady(60, 200)) state = observeFrameDelta(state, d);
    expect(state.rate).toBe(60);

    for (const d of steady(120, 400)) state = observeFrameDelta(state, d);
    expect(state.rate).toBe(120);
  });

  it("bounds the delta buffer", () => {
    let state = createRefreshEstimator();
    for (const d of steady(60, REFRESH_TUNING.bufferSize * 3)) {
      state = observeFrameDelta(state, d);
    }

    expect(state.deltas.length).toBe(REFRESH_TUNING.bufferSize);
  });
});

/**
 * Inter-frame deltas captured from a real 120Hz display, on the live page, via
 * the rAF timestamp argument. Not synthesized: every fixture written by hand
 * for this file was perfectly quantized, and that is exactly what hid the bug
 * these samples exposed.
 *
 * The spread is the point. Vsync-aligned deltas do NOT sit on 8.333ms; they
 * run from about 7.3 to 9.3, with the two-interval group spread 15.6 to 17.7,
 * plus occasional long stalls. An estimator anchored on the smallest sample
 * reads the bottom of that spread and reports a rate far too high.
 */
const REAL_120HZ_DELTAS = [
  8.4, 16.3, 8.7, 16.6, 8.4, 16.6, 16.7, 8.4, 16.6, 8.3, 16.7, 8.3, 16.4, 17,
  8.4, 15.8, 9.2, 15.9, 9, 16.7, 8.3, 16.6, 16.8, 8.3, 16.7, 8.2, 16.8, 16.4,
  8.5, 16.7, 8.3, 16.7, 16.6, 8.4, 16.7, 8.3, 16.2, 17.2, 8.2, 16.7, 7.5, 17.2,
  8.8, 15.7, 9.3, 15.6, 17.6, 8.3, 16.7, 16.7, 8.3, 16.2, 7.9, 16.7, 17.6, 8.3,
  16.1, 8, 16.9, 17.3, 8.2, 41.8, 8.4, 8.3, 8.3, 7.4, 26, 8.3, 8.3, 8.4, 15.8,
  8.3, 17.5, 7.5, 16.6, 17.4, 7.6, 17.7, 16.6, 8.3, 16.7, 7.6, 17.3, 16.6, 8.5,
  16.6, 15.8, 9.3, 16.5, 8.4, 16.7, 16.7, 8.3, 16.6, 16.3, 17, 8.4, 16.6, 7.5,
  17.6, 16.7, 8.3, 15.8, 17.6, 8.3, 16.6, 8.4, 16.7, 16.6, 8.3, 16.3, 8.7, 15.8,
  17.5, 8.4, 16.7, 16.6, 8.3, 15.8, 16.7, 9.3, 16.7, 8.2, 16.6, 8.4, 16.7, 15.8,
  8.3, 17.5, 8.4, 16.1, 16.4, 9.2, 16.5, 16.8, 8.3, 16.7, 15.8, 25.9, 7.3,
];

describe("against a real display", () => {
  it("reads 120Hz from deltas captured on a real 120Hz panel", () => {
    // THE REGRESSION THIS FIXTURE EXISTS FOR. The first shipped estimator took
    // the mean of a narrow one-sided window anchored at the smallest sample.
    // On these very deltas it produced 7.6ms, i.e. 131Hz, which its own
    // multiple-fit check then rejected: the feature returned null on precisely
    // the hardware it was built for. Every synthetic test still passed.
    expect(estimateRefreshRate(REAL_120HZ_DELTAS)).toBe(120);
  });

  it("puts the interval on the mode, not on the bottom of the spread", () => {
    const measured = corroboratedMinimumDelta(REAL_120HZ_DELTAS);

    expect(measured).not.toBeNull();
    // 8.33ms, not the 7.3ms shortest sample.
    expect(measured!).toBeCloseTo(interval(120), 0);
  });

  it("explains the real deltas as whole multiples of one interval", () => {
    // The physical premise, checked against hardware rather than assumed: an
    // exact 120Hz interval accounts for these deltas and a 60Hz one does not.
    expect(fitsWholeMultiples(REAL_120HZ_DELTAS, interval(120))).toBe(true);
    expect(fitsWholeMultiples(REAL_120HZ_DELTAS, interval(60))).toBe(false);
  });
});

describe("isSameTimeline", () => {
  it("accepts a frame start slightly behind the clock, as under load", () => {
    expect(isSameTimeline(1230.1, 1234.5)).toBe(true);
    expect(isSameTimeline(1200, 1234.5)).toBe(true);
  });

  it("rejects a timestamp from a foreign time origin", () => {
    // The repo's own jsdom rAF stub passes Date.now() while performance.now()
    // is measured from page load. Mixing the two would produce a delta of
    // roughly 1.7e12 ms on the first frame and confident nonsense after.
    expect(isSameTimeline(Date.now(), 1234.5)).toBe(false);
  });

  it("rejects a timestamp meaningfully ahead of the clock", () => {
    // Frame start is the past, never the future.
    expect(isSameTimeline(2000, 1234.5)).toBe(false);
  });

  it("rejects non-finite timestamps", () => {
    expect(isSameTimeline(Number.NaN, 1234.5)).toBe(false);
    expect(isSameTimeline(Number.POSITIVE_INFINITY, 1234.5)).toBe(false);
  });

  it("keeps the estimate honest where callback-entry timing would not", () => {
    // WHY THE rAF ARGUMENT IS PREFERRED, as a measurement.
    //
    // A 60Hz panel, timed by performance.now() read inside the callback: each
    // sample is the vsync instant plus that frame's dispatch latency. Latency
    // is one-sided (a frame can be handled late, never early), so a late frame
    // followed by a prompt one produces a delta well under 16.67ms.
    const latency = [0.3, 6.2, 0.4, 5.8, 0.2, 7.1, 0.5, 4.9];
    const atCallbackEntry: number[] = [];
    let previous = 0;
    for (let i = 1; i <= 200; i++) {
      const observed = i * interval(60) + latency[i % latency.length];
      atCallbackEntry.push(observed - previous);
      previous = observed;
    }

    // Those deltas run as short as ~9.8ms, which reads as a ~100Hz panel.
    expect(Math.min(...atCallbackEntry)).toBeLessThan(11);

    // The estimator over-reports or refuses, but it never recovers 60 - and
    // over-reporting is the harmful direction, because the consumer's gate is
    // a fraction of the ceiling and becomes unreachable.
    expect(estimateRefreshRate(atCallbackEntry)).not.toBe(60);

    // The rAF argument carries no dispatch latency at all: it is the frame's
    // start time, the same value for every callback in that frame.
    const atFrameStart = Array.from({ length: 200 }, () => interval(60));
    expect(estimateRefreshRate(atFrameStart)).toBe(60);
  });
});

describe("snapToPlausibleRate", () => {
  it.each([
    [125, 120],
    [111, 120],
    [62.5, 60],
    [58, 60],
    [141, 144],
    [246, 240],
  ])("snaps %d to %d", (raw, expected) => {
    expect(snapToPlausibleRate(raw)).toBe(expected);
  });

  it.each([30, 22, 45, 300, 500])("rejects %d as implausible", (raw) => {
    expect(snapToPlausibleRate(raw)).toBeNull();
  });

  it("picks the nearest rate where tolerance bands overlap", () => {
    // The 144 and 165 bands touch at this tolerance, so nearest must win
    // rather than whichever is checked first.
    expect(snapToPlausibleRate(150)).toBe(144);
    expect(snapToPlausibleRate(160)).toBe(165);
  });
});

describe("corroboratedMinimumDelta", () => {
  it("requires several agreeing samples before believing a candidate", () => {
    const deltas = [4, ...steady(60, 100)];

    // The lone 4ms reading is inside the plausible band but has no company.
    const found = corroboratedMinimumDelta(deltas);
    expect(found).toBeCloseTo(interval(60), 1);
  });

  it("believes a short interval once enough samples agree", () => {
    const deltas = [
      ...Array.from({ length: REFRESH_TUNING.minCorroboration }, () =>
        interval(120),
      ),
      ...steady(60, 100),
    ];

    expect(corroboratedMinimumDelta(deltas)).toBeCloseTo(interval(120), 1);
  });

  it("discards deltas faster than any real panel", () => {
    // Below 3.8ms is faster than 240Hz, so these are coalesced callbacks.
    const deltas = [...Array.from({ length: 50 }, () => 1), ...steady(60, 100)];

    expect(corroboratedMinimumDelta(deltas)).toBeCloseTo(interval(60), 1);
  });

  it("returns null when nothing is usable", () => {
    expect(corroboratedMinimumDelta([1, 2, 500, 900])).toBeNull();
  });
});
