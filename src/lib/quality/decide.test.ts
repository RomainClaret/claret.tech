import { describe, it, expect } from "vitest";
import { QualityMode } from "./mode";
import {
  decideQuality,
  initialQualityState,
  isBlocked,
  QUALITY_TUNING,
  type QualityDecisionState,
} from "./decide";

/**
 * These tests exist because the previous implementation had none, and shipped a
 * guaranteed oscillation as a result. The convergence test below is the real
 * specification: any future change to the thresholds has to keep it passing.
 */

const SECOND = 1000;

/** Drive N seconds of samples at a fixed frame rate. */
function feed(
  state: QualityDecisionState,
  fps: number | ((state: QualityDecisionState) => number),
  seconds: number,
  startAt = 0,
): { state: QualityDecisionState; changes: QualityMode[]; toasts: number } {
  const changes: QualityMode[] = [];
  let toasts = 0;
  let current = state;

  for (let i = 0; i < seconds; i++) {
    const value = typeof fps === "function" ? fps(current) : fps;
    const decision = decideQuality(current, {
      fps: value,
      now: startAt + i * SECOND,
      hidden: false,
    });
    current = decision.state;
    if (decision.next) changes.push(decision.next);
    if (decision.notify) toasts++;
  }

  return { state: current, changes, toasts };
}

describe("decideQuality", () => {
  describe("convergence", () => {
    it("settles instead of oscillating when raising quality lowers the frame rate", () => {
      // The exact shape of the shipped bug. This machine sustains 52 FPS at
      // BALANCED, which the old code read as "plenty of headroom, upgrade",
      // and 38 at MAXIMUM, which it then read as "too slow, downgrade". The
      // old thresholds (up at 50, down at 45) made that a permanent loop
      // emitting a toast every 10 seconds forever.
      const perTier: Record<QualityMode, number> = {
        [QualityMode.BATTERY_SAVER]: 60,
        [QualityMode.LOW]: 58,
        [QualityMode.BALANCED]: 52,
        [QualityMode.MAXIMUM]: 38,
      };

      const { state, changes } = feed(
        initialQualityState(QualityMode.BALANCED),
        (s) => perTier[s.quality],
        1200, // 20 simulated minutes
      );

      // It may probe upward once or twice; it must not keep doing it.
      expect(changes.length).toBeLessThanOrEqual(4);
      // And it has to come to rest somewhere sustainable.
      expect(state.quality).toBe(QualityMode.BALANCED);
    });

    it("stops probing a tier that has already failed", () => {
      const perTier: Record<QualityMode, number> = {
        [QualityMode.BATTERY_SAVER]: 60,
        [QualityMode.LOW]: 60,
        [QualityMode.BALANCED]: 60, // always looks upgradeable
        [QualityMode.MAXIMUM]: 20, // and always fails once there
      };

      const first = feed(
        initialQualityState(QualityMode.BALANCED),
        (s) => perTier[s.quality],
        600,
      );
      const second = feed(
        first.state,
        (s) => perTier[s.quality],
        600,
        600 * SECOND,
      );

      // The backoff escalates, so the second window is quieter than the first
      // and eventually silent. Without it this would churn forever.
      expect(second.changes.length).toBeLessThan(first.changes.length);
    });

    it("holds a good machine at maximum without churn", () => {
      const { state, changes } = feed(
        initialQualityState(QualityMode.BALANCED),
        60,
        600,
      );

      expect(state.quality).toBe(QualityMode.MAXIMUM);
      expect(changes).toEqual([QualityMode.MAXIMUM]);
    });
  });

  describe("smoothing", () => {
    it("ignores a single bad second", () => {
      // One GC pause used to be enough to drop a tier, because the decision
      // read the latest raw 1-second frame count.
      let state = initialQualityState(QualityMode.MAXIMUM);
      state = feed(state, 60, 10).state;

      const decision = decideQuality(state, {
        fps: 5,
        now: 100 * SECOND,
        hidden: false,
      });

      expect(decision.next).toBeNull();
    });

    it("acts on a sustained drop", () => {
      let state = initialQualityState(QualityMode.MAXIMUM);
      state = feed(state, 60, 10).state;

      const { changes } = feed(state, 10, 30, 100 * SECOND);

      expect(changes).toContain(QualityMode.BATTERY_SAVER);
    });

    it("ignores samples taken while the tab is hidden", () => {
      const state = feed(
        initialQualityState(QualityMode.MAXIMUM),
        60,
        10,
      ).state;

      const decision = decideQuality(state, {
        fps: 1,
        now: 100 * SECOND,
        hidden: true,
      });

      expect(decision.next).toBeNull();
      expect(decision.state.samples).toEqual(state.samples);
    });

    it("ignores samples during the settling window after a change", () => {
      // The seconds right after a switch are spent re-rendering and describe
      // neither the old tier nor the new steady state.
      const state: QualityDecisionState = {
        ...initialQualityState(QualityMode.MAXIMUM),
        lastChangeAt: 10 * SECOND,
      };

      const decision = decideQuality(state, {
        fps: 5,
        now: 10 * SECOND + QUALITY_TUNING.settleMs - 1,
        hidden: false,
      });

      expect(decision.next).toBeNull();
      expect(decision.reason).toContain("settling");
    });
  });

  describe("implausible samples", () => {
    it.each([
      ["zero, the tab-return reading", 0],
      ["negative", -5],
      ["NaN", Number.NaN],
      ["absurdly high", 5000],
    ])("discards a %s sample instead of coercing it", (_label, fps) => {
      // The caller used to do `fps || 60`, which turned the single worst
      // sample in the system into the best one and triggered an upgrade: rAF
      // is paused in a background tab, so the first frame count after
      // returning rounds to zero.
      const state = feed(
        initialQualityState(QualityMode.BALANCED),
        50,
        10,
      ).state;

      const decision = decideQuality(state, {
        fps,
        now: 100 * SECOND,
        hidden: false,
      });

      expect(decision.next).toBeNull();
      expect(decision.reason).toContain("implausible");
      expect(decision.state.samples).toEqual(state.samples);
    });

    it("never lets a run of zero samples cause an upgrade", () => {
      const state = feed(
        initialQualityState(QualityMode.BALANCED),
        50,
        10,
      ).state;

      const { changes } = feed(state, 0, 60, 100 * SECOND);

      expect(changes).toEqual([]);
    });
  });

  describe("high refresh rate displays", () => {
    it("scales the upgrade gate to the observed ceiling", () => {
      // A display already seen running at 120. Rendering 70 clears the
      // absolute 58 gate easily, but it is nowhere near this machine's
      // ceiling, so it is not evidence of headroom and must not upgrade.
      //
      // Note the ceiling is inferred from observation, so a screen that is
      // always load bound below 60 is indistinguishable from a 60Hz one.
      // Backoff is what covers that case.
      const state: QualityDecisionState = {
        ...initialQualityState(QualityMode.BALANCED),
        refreshCeiling: 120,
      };

      const { changes } = feed(state, 70, 400);

      expect(changes).toEqual([]);
    });

    it("uses a measured refresh rate in preference to the inferred one", () => {
      // The case the inferred ceiling structurally cannot solve: this machine
      // never renders above 70, so "fastest ever seen" says 70 and 70 looks
      // pinned. The panel is really 120, so there is no headroom at all and
      // the upgrade must not happen.
      let state = initialQualityState(QualityMode.BALANCED);
      const changes: QualityMode[] = [];

      for (let i = 0; i < 400; i++) {
        const decision = decideQuality(state, {
          fps: 70,
          now: i * SECOND,
          hidden: false,
          measuredRefreshRate: 120,
        });
        state = decision.state;
        if (decision.next) changes.push(decision.next);
      }

      expect(state.refreshCeiling).toBe(120);
      expect(changes).toEqual([]);
    });

    it("falls back to the inferred ceiling when nothing was measured", () => {
      // Strictly additive: an unknown rate has to behave exactly as before.
      let state = initialQualityState(QualityMode.BALANCED);
      const changes: QualityMode[] = [];

      for (let i = 0; i < 400; i++) {
        const decision = decideQuality(state, {
          fps: 70,
          now: i * SECOND,
          hidden: false,
          measuredRefreshRate: null,
        });
        state = decision.state;
        if (decision.next) changes.push(decision.next);
      }

      // Without the measurement 70 reads as pinned, so it probes upward. That
      // is the behaviour the measurement exists to improve on, and backoff is
      // what bounds it.
      expect(state.refreshCeiling).toBe(70);
      expect(changes).toContain(QualityMode.MAXIMUM);
    });

    it("still upgrades a 120Hz machine that is genuinely pinned", () => {
      const { changes } = feed(
        initialQualityState(QualityMode.BALANCED),
        120,
        400,
      );

      expect(changes).toContain(QualityMode.MAXIMUM);
    });
  });

  describe("asymmetry", () => {
    it("rescues a struggling visitor faster than it adds load", () => {
      expect(QUALITY_TUNING.downgradeSamples).toBeLessThan(
        QUALITY_TUNING.upgradeSamples,
      );
    });

    it("requires real headroom before upgrading, not one frame above the downgrade line", () => {
      // The defect in one assertion: the old pair was up at 50, down at 45.
      expect(QUALITY_TUNING.upgrade).toBeGreaterThan(
        QUALITY_TUNING.toBalanced + 10,
      );
    });

    it("drops straight to battery saver from any tier when things are dire", () => {
      let state = initialQualityState(QualityMode.MAXIMUM);
      state = feed(state, 60, 10).state;

      const { changes } = feed(state, 8, 20, 100 * SECOND);

      expect(changes[0]).toBe(QualityMode.BATTERY_SAVER);
    });
  });

  describe("backoff", () => {
    it("blocks a tier after quality was lowered from it", () => {
      let state = initialQualityState(QualityMode.MAXIMUM);
      state = feed(state, 60, 10).state;
      state = feed(state, 30, 20, 100 * SECOND).state;

      // The downgrade lands a few seconds into that window, so check inside
      // the first backoff interval rather than after it has already expired.
      expect(state.demotions[QualityMode.MAXIMUM]?.count).toBe(1);
      expect(isBlocked(state, QualityMode.MAXIMUM, 120 * SECOND)).toBe(true);
    });

    it("escalates and eventually closes the tier for the session", () => {
      const demotions = {
        [QualityMode.MAXIMUM]: {
          count: QUALITY_TUNING.backoffMs.length + 1,
          blockedUntil: Number.POSITIVE_INFINITY,
        },
      };
      const state = { ...initialQualityState(QualityMode.BALANCED), demotions };

      expect(
        isBlocked(state, QualityMode.MAXIMUM, Number.MAX_SAFE_INTEGER),
      ).toBe(true);
    });
  });

  describe("notification policy", () => {
    it("notifies when performance becomes critically bad", () => {
      let state = initialQualityState(QualityMode.BALANCED);
      state = feed(state, 50, 10).state;

      const { toasts, changes } = feed(state, 8, 20, 100 * SECOND);

      expect(changes).toContain(QualityMode.BATTERY_SAVER);
      expect(toasts).toBe(1);
    });

    it("stays silent for routine mid-tier adjustments", () => {
      // BALANCED -> MAXIMUM on a fast machine is the site doing its job. This
      // is the toast that was spamming.
      const { changes, toasts } = feed(
        initialQualityState(QualityMode.BALANCED),
        60,
        600,
      );

      expect(changes).toEqual([QualityMode.MAXIMUM]);
      expect(toasts).toBe(0);
    });

    it("notifies on recovery to maximum after a degradation", () => {
      let state = initialQualityState(QualityMode.BALANCED);
      state = feed(state, 50, 10).state;
      // Degrade first.
      state = feed(state, 8, 20, 100 * SECOND).state;
      expect(state.hasBeenDegraded).toBe(true);

      // Then recover, far enough ahead to clear both the backoff and the
      // toast rate limit.
      const later = 100 * SECOND + 2 * QUALITY_TUNING.toastIntervalMs;
      const { changes, toasts } = feed(state, 60, 400, later);

      expect(changes).toContain(QualityMode.MAXIMUM);
      expect(toasts).toBeGreaterThanOrEqual(1);
    });

    it("rate limits notifications regardless of how often tiers move", () => {
      // lastChangeAt has to be well in the past, or the settling window
      // swallows the sample before any decision is reached.
      const state: QualityDecisionState = {
        ...initialQualityState(QualityMode.BALANCED),
        lastChangeAt: 0,
        lastToastAt: 100 * SECOND,
        samples: [8, 8, 8, 8, 8],
        consecutiveDown: 99,
      };

      const decision = decideQuality(state, {
        fps: 8,
        now: 101 * SECOND,
        hidden: false,
      });

      expect(decision.next).toBe(QualityMode.BATTERY_SAVER);
      expect(decision.notify).toBe(false);
    });
  });

  describe("purity", () => {
    it("never mutates the state it is given", () => {
      const state = initialQualityState(QualityMode.BALANCED);
      const snapshot = JSON.stringify(state);

      decideQuality(state, { fps: 60, now: 5000, hidden: false });

      expect(JSON.stringify(state)).toBe(snapshot);
    });
  });
});
