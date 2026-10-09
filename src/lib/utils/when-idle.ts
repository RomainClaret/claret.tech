/**
 * Run `task` once the browser has a quiet moment, or after `timeout` ms at
 * the latest. For work that matters soon but not before the first paint:
 * a device check, fetches for sections below the fold.
 *
 * Safari has no requestIdleCallback; there the task waits one macrotask,
 * which is still after the current render and its effects.
 *
 * Returns a cancel function, safe to call more than once.
 */
export function whenIdle(
  task: () => void,
  { timeout = 2000 }: { timeout?: number } = {},
): () => void {
  if (typeof window === "undefined") return () => {};

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => task(), { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const id = window.setTimeout(task, 1);
  return () => window.clearTimeout(id);
}
