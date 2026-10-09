import { describe, it, expect } from "vitest";
import { QualityMode } from "./mode";
import {
  decideQuality,
  initialQualityState,
  isBlocked,
  QUALITY_TUNING,
  rebaseOnTier,
  restartWindow,
  type QualityDecisionState,
} from "./decide";
import { PLAUSIBLE_REFRESH_RATES } from "./refresh-rate";

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
  measuredRefreshRate?: number,
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
      measuredRefreshRate,
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

    it("ignores samples taken while the tab is hidden, and restarts", () => {
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
      // The window and the settle restart: what follows a hidden stretch is
      // a page restarting, not the one the old samples describe.
      expect(decision.state.samples).toEqual([]);
      expect(decision.state.lastChangeAt).toBe(100 * SECOND);
    });

    it("does not fast-path to battery saver on the jank right after an overlay", () => {
      // Every paused loop restarts and lazy chunks run when the splash or a
      // modal goes away. Three slow seconds then took the fast path, and
      // under 20 fps that is battery saver, with a toast, a 60 s block and
      // the tier kept for the session.
      let state = feed(initialQualityState(QualityMode.BALANCED), 60, 10).state;
      state = decideQuality(state, {
        fps: 60,
        now: 100 * SECOND,
        hidden: true,
      }).state;

      const after = [1, 2, 3].map(
        (s) =>
          (state = decideQuality(state, {
            fps: 18,
            now: (100 + s) * SECOND,
            hidden: false,
          }).state),
      );

      expect(after.at(-1)?.quality).toBe(QualityMode.BALANCED);
    });

    it("still acts on a drop that outlasts the settle after an overlay", () => {
      let state = feed(initialQualityState(QualityMode.BALANCED), 60, 10).state;
      state = decideQuality(state, {
        fps: 60,
        now: 100 * SECOND,
        hidden: true,
      }).state;

      const next: (QualityMode | null)[] = [];
      for (let s = 1; s <= 8; s++) {
        const decision = decideQuality(state, {
          fps: 18,
          now: (100 + s) * SECOND,
          hidden: false,
        });
        next.push(decision.next);
        state = decision.state;
      }

      expect(next).toContain(QualityMode.BATTERY_SAVER);
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

  describe("60Hz and slower displays", () => {
    // Samples inside the settle window are ignored, then the window fills,
    // then an upgrade needs `upgradeSamples` agreeing verdicts in a row.
    const firstVerdict =
      QUALITY_TUNING.settleMs / SECOND + QUALITY_TUNING.minSamples - 1;
    const upgradeDue = firstVerdict + QUALITY_TUNING.upgradeSamples - 1;

    it("upgrades a measured 50Hz panel pinned at its rate", () => {
      // The 58 floor sat above anything a 50Hz panel can render, so a
      // measured rate this low could never upgrade at all. The estimator does
      // not report 50Hz today (see refresh-rate.ts); this pins the gate for
      // a measured rate, which is 95% of it and nothing more.
      const { state, changes } = feed(
        initialQualityState(QualityMode.LOW),
        50,
        upgradeDue + 1,
        0,
        50,
      );

      expect(changes).toEqual([QualityMode.BALANCED]);
      // On the last confirming sample, not before.
      expect(state.lastChangeAt).toBe(upgradeDue * SECOND);
    });

    it("upgrades a measured 60Hz panel that drops a frame most seconds", () => {
      // 58 fps is 97% of vsync. The floor asked a 60Hz panel for 59, one
      // frame more than the same rule asks of a 120Hz one.
      const { changes } = feed(
        initialQualityState(QualityMode.LOW),
        58,
        upgradeDue + 1,
        0,
        60,
      );

      expect(changes).toEqual([QualityMode.BALANCED]);
    });

    it("keeps the floor while the ceiling is only inferred", () => {
      // Unmeasured, 58 could be a pinned 60Hz panel or a faster one held
      // down by load: no evidence of headroom.
      const { changes } = feed(initialQualityState(QualityMode.LOW), 58, 400);

      expect(changes).toEqual([]);
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

    it("keeps that headroom at every panel rate the estimator can measure", () => {
      // A measured rate has no floor under its gate. Teaching the estimator a
      // panel slower than 60Hz (50Hz gives a gate of 48) would bring the
      // gate within 10 of the downgrade line, so that has to be decided here
      // rather than slip in through the list of rates.
      for (const rate of PLAUSIBLE_REFRESH_RATES) {
        expect(
          Math.round(QUALITY_TUNING.upgradeCeilingFraction * rate),
        ).toBeGreaterThan(QUALITY_TUNING.toBalanced + 10);
      }
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
      expect(state.recoverTo).toBe(QualityMode.BALANCED);

      // Then recover, far enough ahead to clear both the backoff and the
      // toast rate limit.
      const later = 100 * SECOND + 2 * QUALITY_TUNING.toastIntervalMs;
      const { changes, toasts } = feed(state, 60, 400, later);

      expect(changes).toContain(QualityMode.MAXIMUM);
      expect(toasts).toBeGreaterThanOrEqual(1);
    });

    it("does not announce a retry of MAXIMUM as a recovery", () => {
      // This machine holds BALANCED but not MAXIMUM. Each backoff retry
      // (after 1, 5 and 30 minutes) used to say "full quality restored",
      // then fall back silently: three toasts in the first hour.
      const perTier: Record<QualityMode, number> = {
        [QualityMode.BATTERY_SAVER]: 60,
        [QualityMode.LOW]: 60,
        [QualityMode.BALANCED]: 60,
        [QualityMode.MAXIMUM]: 25,
      };

      const { changes, toasts } = feed(
        initialQualityState(QualityMode.BALANCED),
        (s) => perTier[s.quality],
        3600,
      );

      expect(
        changes.filter((tier) => tier === QualityMode.MAXIMUM).length,
      ).toBeGreaterThan(1); // it did retry
      expect(toasts).toBe(0);
    });

    it("announces a recovery once, after the drop it answers", () => {
      let state = initialQualityState(QualityMode.BALANCED);
      state = feed(state, 50, 10).state;
      const drop = feed(state, 8, 20, 100 * SECOND); // to battery saver
      expect(drop.toasts).toBe(1);

      const later = 100 * SECOND + 2 * QUALITY_TUNING.toastIntervalMs;
      const back = feed(drop.state, 60, 400, later);
      expect(back.changes).toContain(QualityMode.MAXIMUM);
      expect(back.toasts).toBe(1);
      expect(back.state.recoverTo).toBeNull();
    });

    it("announces a recovery that lands soon after the drop, then never again", () => {
      // The climb back from battery saver takes about 75 s, well inside the
      // 5 minute toast limit. Rate limited, the recovery went unannounced
      // and the debt stayed, so a routine retry later said "recovered".
      let state = initialQualityState(QualityMode.BALANCED);
      state = feed(state, 50, 10).state;
      const drop = feed(state, 8, 20, 100 * SECOND); // to battery saver
      expect(drop.toasts).toBe(1);

      const back = feed(drop.state, 60, 200, 120 * SECOND);
      expect(back.changes).toContain(QualityMode.MAXIMUM);
      expect(back.toasts).toBe(1);

      // Then a machine that cannot hold MAXIMUM: routine, silent retries.
      const perTier: Record<QualityMode, number> = {
        [QualityMode.BATTERY_SAVER]: 60,
        [QualityMode.LOW]: 60,
        [QualityMode.BALANCED]: 60,
        [QualityMode.MAXIMUM]: 30,
      };
      const after = feed(
        back.state,
        (s) => perTier[s.quality],
        3600,
        320 * SECOND,
      );
      expect(after.changes).toContain(QualityMode.BALANCED);
      expect(after.toasts).toBe(0);
    });

    /** Feed samples from `fps(state)`; return the tiers each toast came with. */
    function toastsFor(
      start: QualityDecisionState,
      fps: (state: QualityDecisionState) => number,
      seconds: number,
      startAt: number,
    ) {
      const announced: QualityMode[] = [];
      let state = start;
      for (let i = 0; i < seconds; i++) {
        const decision = decideQuality(state, {
          fps: fps(state),
          now: startAt + i * SECOND,
          hidden: false,
        });
        state = decision.state;
        if (decision.notify && decision.next) announced.push(decision.next);
      }
      return { announced, state };
    }

    it("announces the climb back to the tier the drop left, once", () => {
      // Visitors start at BALANCED. Back there from battery saver is the
      // recovery; a probe of MAXIMUM later is routine, and on this machine
      // it fails. The debt used to wait for MAXIMUM, so the climb back was
      // silent and the probe said "recovered" before falling back.
      const perTier: Record<QualityMode, number> = {
        [QualityMode.BATTERY_SAVER]: 60,
        [QualityMode.LOW]: 60,
        [QualityMode.BALANCED]: 60,
        [QualityMode.MAXIMUM]: 30,
      };
      let state = feed(initialQualityState(QualityMode.BALANCED), 50, 10).state;
      state = feed(state, 8, 20, 100 * SECOND).state; // drop, with its toast

      const { announced } = toastsFor(
        state,
        (s) => perTier[s.quality],
        3600,
        120 * SECOND,
      );

      expect(announced).toEqual([QualityMode.BALANCED]);
    });

    it("owes a drop from MAXIMUM until MAXIMUM, not a partial climb", () => {
      let state = feed(
        initialQualityState(QualityMode.BALANCED),
        60,
        400,
      ).state; // up to MAXIMUM
      expect(state.quality).toBe(QualityMode.MAXIMUM);
      state = feed(state, 8, 20, 400 * SECOND).state; // straight to battery
      expect(state.recoverTo).toBe(QualityMode.MAXIMUM);

      const { announced } = toastsFor(state, () => 60, 600, 420 * SECOND);

      expect(announced).toEqual([QualityMode.MAXIMUM]);
    });

    it("never announces a downgrade as a recovery", () => {
      // A debt to BALANCED while at MAXIMUM (restored with a tier picked by
      // hand): falling to BALANCED lands at the tier owed, but downward.
      const state: QualityDecisionState = {
        ...initialQualityState(QualityMode.MAXIMUM),
        recoverTo: QualityMode.BALANCED,
      };

      const { changes, toasts } = feed(state, 35, 30, 10 * SECOND);

      expect(changes).toEqual([QualityMode.BALANCED]);
      expect(toasts).toBe(0);
    });

    it("restarts the window but keeps the backoff", () => {
      // Auto switched back on: what the window held is from before.
      const state: QualityDecisionState = {
        ...initialQualityState(QualityMode.MAXIMUM),
        samples: [35, 35, 35, 35, 35],
        consecutiveDown: 2,
        recoverTo: QualityMode.MAXIMUM,
        demotions: {
          [QualityMode.MAXIMUM]: { count: 1, blockedUntil: 70_000 },
        },
      };

      const restarted = restartWindow(state, QualityMode.MAXIMUM, 9000);

      expect(restarted).toMatchObject({
        quality: QualityMode.MAXIMUM,
        samples: [],
        consecutiveDown: 0,
        consecutiveUp: 0,
        lastChangeAt: 9000,
        recoverTo: null,
      });
      expect(restarted.demotions).toBe(state.demotions);
    });

    it("forgets the debt when quality is set without the loop", () => {
      const owed: QualityDecisionState = {
        ...initialQualityState(QualityMode.BATTERY_SAVER),
        recoverTo: QualityMode.BALANCED,
      };

      // A tier picked by hand, or restored from storage.
      expect(rebaseOnTier(owed, QualityMode.LOW, 5000).recoverTo).toBeNull();
      // Nothing to re-base on the same tier.
      expect(rebaseOnTier(owed, QualityMode.BATTERY_SAVER, 5000)).toBe(owed);
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

  describe("fast path", () => {
    // Start past the settling window so only the sampling rules are in play.
    const settled = () => initialQualityState(QualityMode.BALANCED, 0);
    const start = QUALITY_TUNING.settleMs;

    it("rescues a plainly struggling machine after three samples", () => {
      // The slow path waits for a full window and three confirming ticks,
      // about ten seconds of stutter on a first visit.
      const { changes } = feed(settled(), 15, 3, start);

      expect(changes).toEqual([QualityMode.BATTERY_SAVER]);
    });

    it("lowers to LOW, not further, when the frame rate is between the lines", () => {
      const { changes } = feed(settled(), 24, 3, start);

      expect(changes).toEqual([QualityMode.LOW]);
    });

    it("waits for three samples in a row under the LOW line", () => {
      // One good second in the middle is enough to defer to the slow path.
      let calls = 0;
      const { changes } = feed(
        settled(),
        () => [15, 45, 15][calls++] ?? 45,
        3,
        start,
      );

      expect(changes).toEqual([]);
    });

    it("never upgrades", () => {
      const { changes } = feed(
        initialQualityState(QualityMode.LOW, 0),
        120,
        3,
        start,
      );

      expect(changes).toEqual([]);
    });
  });
});
