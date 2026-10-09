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
  const ref = useCallback((node: T | null) => setElement(node), []);
  const [inView, setInView] = useState(false);
  const gate = useMotionGate();
  const animationState = useAnimationStateOptional();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!element) return;
    let observer: IntersectionObserver | undefined;
    try {
      observer = new IntersectionObserver(
        (entries) => setInView(latestEntry(entries).isIntersecting),
        { rootMargin },
      );
    } catch {
      observer = undefined;
    }
    // No usable observer (old browser, or a stubbed one in tests): treat the
    // element as visible rather than freezing it.
    if (!observer || typeof observer.observe !== "function") {
      setInView(true);
      return;
    }
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, rootMargin]);

  const playing =
    !respectPlaying || (animationState?.areAnimationsPlaying ?? true);
  const active =
    inView &&
    !gate.suspended &&
    playing &&
    !prefersReducedMotion &&
    !(decorative && gate.tier === "battery");

  return { ref, inView, active };
}
