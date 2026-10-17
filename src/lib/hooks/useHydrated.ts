"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * False in the server's HTML and in the render that hydrates it, true after,
 * and true from the first render of anything mounted later. For markup only
 * the browser can draw. The mount effects that set a flag like this rendered
 * once more, and before the first paint of a client-only component, never.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
