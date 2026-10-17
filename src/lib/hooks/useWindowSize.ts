"use client";

import { useSyncExternalStore } from "react";

export interface WindowSize {
  width: number;
  height: number;
}

/** What the HTML is rendered with: the backgrounds' size before they mount. */
const SERVER_SIZE: WindowSize = { width: 1152, height: 768 };

// The same object until the size changes, as useSyncExternalStore requires.
let size = SERVER_SIZE;
function readSize(): WindowSize {
  if (size.width !== window.innerWidth || size.height !== window.innerHeight) {
    size = { width: window.innerWidth, height: window.innerHeight };
  }
  return size;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

/**
 * The window's inner size, followed through resizes. A fixed size in the
 * server's HTML and while hydrating; the window's own from the first render
 * of anything mounted later.
 */
export function useWindowSize(): WindowSize {
  return useSyncExternalStore(subscribe, readSize, () => SERVER_SIZE);
}
