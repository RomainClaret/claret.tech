import { useEffect, useLayoutEffect } from "react";

/**
 * useLayoutEffect in the browser, useEffect on the server, where layout
 * effects never run anyway.
 *
 * For state restored from storage after hydration: the page's HTML is
 * generated for every visitor, so the first render must use the same
 * defaults, and a layout effect puts the visitor's own values in place
 * before the browser paints that render.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
