import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

/**
 * Whether the page's tab is visible (the Page Visibility API). Visible in the
 * server's HTML and while hydrating; the tab's own state after.
 */
export function usePageVisibility(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !document.hidden,
    () => true,
  );
}
