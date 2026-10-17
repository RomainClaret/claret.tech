"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useAnimationStateOptional } from "@/contexts/animation-state-context";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import {
  acquireOverlay,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type MotionGateSnapshot,
} from "@/lib/utils/motion-gate";
import { latestEntry } from "@/lib/utils/intersection";

/** The page-wide motion state: hidden tab, open overlays, quality tier. */
export function useMotionGate(): MotionGateSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hold the page's decorative motion while `open` is true: for overlays that
 * cover it (the splash, full-screen modals). Nothing runs behind them.
 */
export function useOverlayLock(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    return acquireOverlay();
  }, [open]);
}

interface AnimationGateOptions {
  /** Also stop when the site's animation switch is off. Default true. */
  respectPlaying?: boolean;
  /** Decorative only: stops entirely at the battery tier. Default true. */
  decorative?: boolean;
  /**
   * How far outside the viewport still counts as in view, so a loop is
   * already running by the time it scrolls into sight. Default 200px.
   */
  rootMargin?: string;
}

/**
 * Whether one element's decorative motion should run: it is on (or near) the
 * screen, the page is not suspended, animations are switched on, the visitor
 * has not asked for reduced motion, and the tier allows it.
 *
 * Attach `ref` to the element whose visibility decides it. An element that is
 * display:none (e.g. hidden below a breakpoint) never intersects, so it never
 * runs. Without IntersectionObserver the element counts as in view.
 */
export function useAnimationGate<T extends Element = HTMLDivElement>({
  respectPlaying = true,
  decorative = true,
  rootMargin = "200px",
}: AnimationGateOptions = {}) {
  const [element, setElement] = useState<T | null>(null);
  // Whether an IntersectionObserver can watch it, checked as the element
  // arrives. Where none can (an old browser, or a stub in tests), the element
  // counts as in view rather than freezing.
  const [observable, setObservable] = useState(true);
  const ref = useCallback((node: T | null) => {
    setElement(node);
    if (node) setObservable(canObserve());
  }, []);
  const [inView, setInView] = useState(false);
  const gate = useMotionGate();
  const animationState = useAnimationStateOptional();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!element || !observable) return;
    const observer = new IntersectionObserver(
      (entries) => setInView(latestEntry(entries).isIntersecting),
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, observable, rootMargin]);

  const visible = inView || (element !== null && !observable);
  const playing =
    !respectPlaying || (animationState?.areAnimationsPlaying ?? true);
  const active =
    visible &&
    !gate.suspended &&
    playing &&
    !prefersReducedMotion &&
    !(decorative && gate.tier === "battery");

  return { ref, inView: visible, active };
}

/** Whether this browser gives an IntersectionObserver that can observe. */
function canObserve(): boolean {
  try {
    const probe = new IntersectionObserver(() => {});
    if (typeof probe.observe !== "function") return false;
    probe.disconnect?.();
    return true;
  } catch {
    return false;
  }
}
