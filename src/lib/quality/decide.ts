/**
 * The automatic quality decision, as a pure function.
 *
 * Extracted from the effect in quality-context.tsx so it can be tested without
 * a React render, a timer, or a browser. That matters more than elegance here:
 * the bug this replaces was a guaranteed oscillation that shipped because
 * nothing could observe the loop.
 *
 * THE BUG THIS EXISTS TO PREVENT
 * ------------------------------
 * The previous thresholds upgraded BALANCED -> MAXIMUM at fps > 50 and
 * downgraded MAXIMUM -> BALANCED at fps < 45. Upgrading is what pushes the
 * frame rate down (MAXIMUM is 5x the particles, plus blur, plus double the
 * rAF budget), so on any machine that renders above 50 at BALANCED and below
 * 45 at MAXIMUM the two rules fed each other forever, one toast per cooldown.
 *
 * Three properties keep that from recurring, in increasing order of how much
 * they can be trusted:
 *
 *   1. A median over a window, so one bad second cannot move a tier.
 *   2. Wide asymmetric bands: upgrading requires near-vsync headroom, because
 *      "just above the downgrade line" is never enough once the new load lands.
 *   3. Per-tier backoff. Thresholds alone CANNOT guarantee convergence: a
 *      machine can genuinely sustain 60 at BALANCED and 35 at MAXIMUM, and no
 *      choice of constants fixes that. Refusing to re-enter a tier that
 *      already failed is what makes the loop provably terminate.
 */

import { QualityMode } from "./mode";

/** Ascending cost. Index arithmetic below relies on this order. */
export const QUALITY_LADDER: readonly QualityMode[] = [
  QualityMode.BATTERY_SAVER,
  QualityMode.LOW,
  QualityMode.BALANCED,
  QualityMode.MAXIMUM,
] as const;

export const QUALITY_TUNING = {
  /**
   * Samples kept for the median. Odd, so the median is a real sample rather
   * than an average of two. At one sample per second this is a 7 second view.
   */
  windowSize: 7,
  /** Do not decide anything until the window has this many valid samples. */
  minSamples: 5,

  /**
   * Consecutive qualifying windows before acting. Deliberately asymmetric: a
   * struggling visitor is rescued in a few seconds, while adding load is slow
   * and hard to trigger.
   */
  downgradeSamples: 3,
  upgradeSamples: 8,

  /**
   * The fast path for a machine that is plainly struggling: this many valid
   * samples in a row under `toLow` act at once, without waiting for a full
   * window and the confirming ticks. The slow path takes about ten seconds,
   * which is most of a first visit spent stuttering. Downgrades only.
   */
  fastPathSamples: 3,

  /**
   * Downgrade thresholds. Crossing one means the current tier is too
   * expensive for this machine.
   */
  toBatterySaver: 20,
  toLow: 28,
  toBalanced: 40,

  /**
   * The upgrade floor while the display's rate is unknown, and it is high on
   * purpose. Adding load is only safe with real headroom, so the frame rate
   * has to be pinned near the vsync ceiling first. This is the number the old
   * code got wrong: it upgraded at 50, one frame above a downgrade line of 45.
   */
  upgrade: 58,

  /**
   * Upgrading also requires being this close to the display's own ceiling,
   * and with a measured refresh rate this is the whole gate.
   *
   * An absolute number is a weak signal on a high refresh rate screen: a
   * 120Hz laptop clears 58 FPS trivially at any tier, so the threshold above
   * would wave through every upgrade. Requiring a fraction of the ceiling
   * makes "pinned at vsync" mean the same thing at 60Hz and at 120Hz. A
   * measured ceiling needs no floor on top: at 60Hz the floor asked for 59,
   * one frame more than this fraction does, and below 60 nothing could pass.
   */
  upgradeCeilingFraction: 0.95,

  /**
   * Ignore samples for this long after a tier change. The first seconds after
   * a switch are spent re-rendering and are not representative of the new
   * steady state.
   */
  settleMs: 3000,

  /**
   * How long a tier stays off limits after quality was auto-lowered from it.
   * Escalating, then permanent for the session: a tier that fails is retried
   * at most three times (after 1, 5 and 30 minutes), whatever the
   * measurements do.
   */
  backoffMs: [60_000, 5 * 60_000, 30 * 60_000],

  /**
   * Hard ceiling on automatic toasts, independent of how often tiers move,
   * for the session (the last toast's time is saved with the backoff).
   */
  toastIntervalMs: 5 * 60_000,
} as const;

export interface QualityDecisionState {
  quality: QualityMode;
  /** Recent valid FPS samples, oldest first. */
  samples: number[];
  consecutiveDown: number;
  consecutiveUp: number;
  /** Timestamp of the last tier change, for the settling window. */
  lastChangeAt: number;
  /** Per tier: how often quality was lowered from it, and until when it is blocked. */
  demotions: Partial<
    Record<QualityMode, { count: number; blockedUntil: number }>
  >;
  /**
   * Fastest frame rate seen this session, used to scale the upgrade gate to
   * the display rather than to a hardcoded 60Hz assumption.
   */
  refreshCeiling: number;
  /**
   * The tier the visitor was on when told quality dropped (the battery
   * saver toast); null when nothing is owed. Reaching it again, or anything
   * above it, is the recovery they are told of, once. A flag paid only at
   * MAXIMUM missed visitors who started at BALANCED: their climb back was
   * silent, and a routine probe of MAXIMUM minutes later announced it, then
   * often fell back without a word. Before that, any drop armed it.
   */
  recoverTo: QualityMode | null;
  lastToastAt: number;
}

export interface QualitySample {
  fps: number;
  now: number;
  /** Samples taken while the tab is hidden measure nothing useful. */
  hidden: boolean;
  /**
   * The display's measured refresh rate, when it is known.
   *
   * Without it the ceiling has to be inferred from the fastest frame rate ever
   * observed, which is circular: a fast display that is always load bound
   * looks exactly like a slow one, so the gate sits at its floor and waves
   * through upgrades with no headroom behind them. A measured rate breaks that
   * circularity. Null keeps the inferred behaviour.
   */
  measuredRefreshRate?: number | null;
}

export interface QualityDecision {
  /** The next state. Always returned, so callers never mutate. */
  state: QualityDecisionState;
  /** The tier to switch to, or null to stay put. */
  next: QualityMode | null;
  /** Whether this change is worth interrupting the visitor for. */
  notify: boolean;
  reason: string;
}

export function initialQualityState(
  quality: QualityMode,
  now = 0,
): QualityDecisionState {
  return {
    quality,
    samples: [],
    consecutiveDown: 0,
    consecutiveUp: 0,
    lastChangeAt: now,
    refreshCeiling: 60,
    demotions: {},
    recoverTo: null,
    lastToastAt: 0,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function rank(quality: QualityMode): number {
  return QUALITY_LADDER.indexOf(quality);
}

/**
 * The tier this frame rate suggests, at most one step up but any distance
 * down: a visitor at 12 FPS should reach battery saver immediately rather than
 * descending one tier every few seconds.
 */
function suggestFor(
  fps: number,
  current: QualityMode,
  upgradeAt: number,
): QualityMode {
  const t = QUALITY_TUNING;

  if (fps < t.toBatterySaver) return QualityMode.BATTERY_SAVER;
  if (fps < t.toLow && rank(current) > rank(QualityMode.LOW)) {
    return QualityMode.LOW;
  }
  if (fps < t.toBalanced && rank(current) > rank(QualityMode.BALANCED)) {
    return QualityMode.BALANCED;
  }
  if (fps > upgradeAt) {
    const next = QUALITY_LADDER[rank(current) + 1];
    return next ?? current;
  }
  return current;
}

/** Whether a tier is currently off limits because quality was lowered from it. */
export function isBlocked(
  state: QualityDecisionState,
  tier: QualityMode,
  now: number,
): boolean {
  const record = state.demotions[tier];
  return record !== undefined && now < record.blockedUntil;
}

function recordDemotion(
  demotions: QualityDecisionState["demotions"],
  from: QualityMode,
  now: number,
): QualityDecisionState["demotions"] {
  const previous = demotions[from]?.count ?? 0;
  const count = previous + 1;
  const schedule = QUALITY_TUNING.backoffMs;
  // Past the end of the schedule the tier is closed for the rest of the
  // session. Two failed attempts are plenty of evidence.
  const blockedUntil =
    count > schedule.length
      ? Number.POSITIVE_INFINITY
      : now + schedule[count - 1];

  return { ...demotions, [from]: { count, blockedUntil } };
}

/**
 * Feed one sample in and get the next state plus any action.
 *
 * Pure: the same state and sample always produce the same result, and nothing
 * is mutated. The caller applies `next` and stores `state`.
 */
export function decideQuality(
  state: QualityDecisionState,
  sample: QualitySample,
): QualityDecision {
  const t = QUALITY_TUNING;
  const stay = (reason: string, patch: Partial<QualityDecisionState> = {}) => ({
    state: { ...state, ...patch },
    next: null,
    notify: false,
    reason,
  });

  // Hidden, or covered by the splash or a modal: no sample means anything.
  // The window also restarts, and the settle with it: when the page shows
  // again every paused loop restarts and lazy chunks run, and the old
  // samples describe a page from before. Without this, three slow seconds
  // right after the splash took the fast path, straight to battery saver.
  if (sample.hidden) {
    return stay("tab hidden", {
      samples: [],
      consecutiveDown: 0,
      consecutiveUp: 0,
      lastChangeAt: sample.now,
    });
  }

  // Implausible readings are DISCARDED, never coerced. The caller used to do
  // `fps || 60`, which turned the single worst sample in the system into the
  // best: rAF is paused in a background tab, so the first frame count after
  // returning divides about one frame by a multi-second gap and rounds to
  // zero, and the fallback then read that as a perfect 60 and upgraded.
  if (!Number.isFinite(sample.fps) || sample.fps < 1 || sample.fps > 240) {
    return stay("implausible sample");
  }

  // A measured refresh rate is authoritative; otherwise fall back to the
  // fastest frame rate observed, which is all the loop used to have.
  const measuredRate = sample.measuredRefreshRate;
  const measured = typeof measuredRate === "number" && measuredRate > 0;
  const refreshCeiling = measured
    ? measuredRate
    : Math.max(state.refreshCeiling, sample.fps);

  // A tier change makes the next few seconds unrepresentative, and the old
  // samples describe the old tier, so the window restarts.
  if (sample.now - state.lastChangeAt < t.settleMs) {
    return stay("settling after a change", {
      refreshCeiling,
      samples: [],
      consecutiveDown: 0,
      consecutiveUp: 0,
    });
  }

  const samples = [...state.samples, sample.fps].slice(-t.windowSize);

  const recent = samples.slice(-t.fastPathSamples);
  if (
    recent.length === t.fastPathSamples &&
    recent.every((fps) => fps < t.toLow)
  ) {
    const smoothedRecent = median(recent);
    // Infinity: the fast path never upgrades.
    const target = suggestFor(smoothedRecent, state.quality, Infinity);
    if (rank(target) < rank(state.quality)) {
      return applyChange(state, target, sample.now, refreshCeiling, {
        reason: `fast downgrade to ${target} at ${Math.round(smoothedRecent)} fps`,
      });
    }
  }

  if (samples.length < t.minSamples) {
    return stay("filling the window", { samples, refreshCeiling });
  }

  const smoothed = median(samples);
  // The floor stands in for headroom only while the ceiling is a guess.
  const nearCeiling = Math.round(t.upgradeCeilingFraction * refreshCeiling);
  const upgradeAt = measured ? nearCeiling : Math.max(t.upgrade, nearCeiling);
  const suggested = suggestFor(smoothed, state.quality, upgradeAt);

  if (suggested === state.quality) {
    return stay("steady", {
      samples,
      refreshCeiling,
      consecutiveDown: 0,
      consecutiveUp: 0,
    });
  }

  const isDowngrade = rank(suggested) < rank(state.quality);
  const consecutiveDown = isDowngrade ? state.consecutiveDown + 1 : 0;
  const consecutiveUp = isDowngrade ? 0 : state.consecutiveUp + 1;
  const counted = { samples, refreshCeiling, consecutiveDown, consecutiveUp };

  const required = isDowngrade ? t.downgradeSamples : t.upgradeSamples;
  const observed = isDowngrade ? consecutiveDown : consecutiveUp;
  if (observed < required) {
    return stay(
      `${isDowngrade ? "downgrade" : "upgrade"} pending (${observed}/${required})`,
      counted,
    );
  }

  // Upgrading into a tier that already proved too expensive is the loop. This
  // is the check that makes termination structural rather than a hope about
  // where the thresholds landed.
  if (!isDowngrade && isBlocked(state, suggested, sample.now)) {
    return stay(`${suggested} is backed off`, counted);
  }

  return applyChange(state, suggested, sample.now, refreshCeiling, {
    reason: `${isDowngrade ? "downgrade" : "upgrade"} to ${suggested} at ${Math.round(smoothed)} fps`,
  });
}

/**
 * Start the sample window over at `quality`. For a tier set without the loop
 * (a manual pick, a tier restored from storage), and for the loop starting
 * again after auto was off: what the window held describes the page before,
 * possibly minutes ago. The backoff stays (a tier that failed still failed);
 * no recovery is owed (a later "quality restored" would be about a drop the
 * visitor has moved on from).
 */
export function restartWindow(
  state: QualityDecisionState,
  quality: QualityMode,
  now: number,
): QualityDecisionState {
  return {
    ...state,
    quality,
    samples: [],
    consecutiveDown: 0,
    consecutiveUp: 0,
    lastChangeAt: now,
    recoverTo: null,
  };
}

/** restartWindow, if quality changed without the loop. */
export function rebaseOnTier(
  state: QualityDecisionState,
  quality: QualityMode,
  now: number,
): QualityDecisionState {
  return state.quality === quality ? state : restartWindow(state, quality, now);
}

/** Move to `next`: record a demotion when lowering, and decide on a toast. */
function applyChange(
  state: QualityDecisionState,
  next: QualityMode,
  now: number,
  refreshCeiling: number,
  { reason }: { reason: string },
): QualityDecision {
  const t = QUALITY_TUNING;
  const isDowngrade = rank(next) < rank(state.quality);
  const demotions = isDowngrade
    ? recordDemotion(state.demotions, state.quality, now)
    : state.demotions;

  // Notify only at the extremes: dropping to battery saver means the site
  // visibly gave up, and getting back to where the visitor was when told so
  // is the recovery worth reporting. Everything between is routine.
  const isCriticallyBad = next === QualityMode.BATTERY_SAVER;
  // Upward only: a drop that lands at or above the tier owed is not news of
  // a recovery. With a debt restored from the session, a MAXIMUM picked by
  // hand that fell to BALANCED announced "Performance recovered".
  const isRecovery =
    !isDowngrade &&
    state.recoverTo !== null &&
    rank(next) >= rank(state.recoverTo);
  const withinToastLimit =
    now - state.lastToastAt >= t.toastIntervalMs || state.lastToastAt === 0;
  // The recovery answers a drop toast the visitor was shown, one for one, so
  // it needs no rate limit of its own. Held back by it, the climb back that
  // normally lands about 75 s after the drop went unannounced, and the debt
  // stayed for a routine retry to pay minutes later.
  const notify = (isCriticallyBad && withinToastLimit) || isRecovery;

  return {
    state: {
      ...state,
      quality: next,
      samples: [],
      consecutiveDown: 0,
      consecutiveUp: 0,
      lastChangeAt: now,
      refreshCeiling,
      demotions,
      // Paid on getting back; owed from a drop toast, to the tier it left
      // (or the one still owed, if quality fell again before getting back).
      recoverTo: isRecovery
        ? null
        : isCriticallyBad && notify
          ? (state.recoverTo ?? state.quality)
          : state.recoverTo,
      lastToastAt: notify ? now : state.lastToastAt,
    },
    next,
    notify,
    reason,
  };
}
