"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches. False in the server's HTML and while
 * hydrating (the homepage is built once, for every screen), then the
 * browser's answer, followed live.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches,
    () => false,
  );
}
