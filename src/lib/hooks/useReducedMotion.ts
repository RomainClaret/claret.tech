"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

// One list per matchMedia, so the many animated components that ask do not
// call matchMedia on every render (tests swap matchMedia, hence the check).
let cached: {
  matchMedia: typeof window.matchMedia;
  list: MediaQueryList;
} | null = null;
function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return null;
  if (cached?.matchMedia !== window.matchMedia) {
    cached = { matchMedia: window.matchMedia, list: window.matchMedia(QUERY) };
  }
  return cached.list;
}

function subscribe(onChange: () => void) {
  const query = reducedMotionQuery();
  if (!query) return () => {};
  if (query.addEventListener) {
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }
  // Older Safari
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}

/**
 * Whether the visitor asks for reduced motion. False in the server's HTML
 * and while hydrating, then the system's setting, followed live.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => reducedMotionQuery()?.matches ?? false,
    () => false,
  );
}
