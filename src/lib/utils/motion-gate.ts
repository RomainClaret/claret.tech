/**
 * One switch for decorative motion: is anything that only decorates the page
 * worth running right now?
 *
 * Decorative loops (pulses, glows, background canvases) used to decide that
 * one component at a time, and most did not decide at all: they kept running
 * off-screen, in hidden tabs, and behind the splash and modals. This store
 * holds the page-wide inputs; useAnimationGate (src/lib/hooks/useMotionGate.ts)
 * adds the per-element ones (in view, animations switched on, reduced motion).
 *
 * It mirrors its state onto <html> so CSS can follow without React:
 *   data-motion="running" | "suspended"   (tab hidden, or an overlay is open)
 *   data-quality="battery" | "low" | ...  (set by QualityProvider)
 * See src/styles/motion.css for the rules that read them.
 *
 * A module rather than a context: AnimationStateProvider sits above
 * QualityProvider in the tree and needs the tier too.
 */

export type MotionTier = "battery" | "low" | "balanced" | "maximum";

export interface MotionGateSnapshot {
  /** The tab is in the background. */
  hidden: boolean;
  /** Number of open overlays (splash, modals) covering the page. */
  overlays: number;
  /** Decorative motion should stop: hidden, or covered by an overlay. */
  suspended: boolean;
  /** The render quality tier. */
  tier: MotionTier;
}

const SERVER_SNAPSHOT: MotionGateSnapshot = Object.freeze({
  hidden: false,
  overlays: 0,
  suspended: false,
  tier: "balanced",
});

let snapshot: MotionGateSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let stopListening: (() => void) | null = null;

function publish(next: Partial<MotionGateSnapshot>) {
  const merged = { ...snapshot, ...next };
  merged.suspended = merged.hidden || merged.overlays > 0;
  if (
    merged.hidden === snapshot.hidden &&
    merged.overlays === snapshot.overlays &&
    merged.tier === snapshot.tier
  ) {
    return;
  }
  snapshot = merged;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.motion = snapshot.suspended
      ? "suspended"
      : "running";
  }
  listeners.forEach((listener) => listener());
}

function start() {
  if (stopListening || typeof document === "undefined") return;
  const onVisibility = () =>
    publish({ hidden: document.visibilityState === "hidden" });
  document.addEventListener("visibilitychange", onVisibility);
  stopListening = () =>
    document.removeEventListener("visibilitychange", onVisibility);
  onVisibility();
  document.documentElement.dataset.motion = snapshot.suspended
    ? "suspended"
    : "running";
}

export function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): MotionGateSnapshot {
  return snapshot;
}

export function getServerSnapshot(): MotionGateSnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * Mark the page as covered until the returned release is called. Releasing
 * twice is harmless, so an effect cleanup can always call it.
 */
export function acquireOverlay(): () => void {
  start();
  publish({ overlays: snapshot.overlays + 1 });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    publish({ overlays: Math.max(0, snapshot.overlays - 1) });
  };
}

export function setMotionTier(tier: MotionTier): void {
  start();
  publish({ tier });
}

/** Back to the initial state. Tests only. */
export function resetMotionGateForTests(): void {
  stopListening?.();
  stopListening = null;
  listeners.clear();
  snapshot = SERVER_SNAPSHOT;
  if (typeof document !== "undefined") {
    delete document.documentElement.dataset.motion;
  }
}
