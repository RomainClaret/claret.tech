/**
 * The newest entry an IntersectionObserver delivered for its single target.
 *
 * The callback receives every entry queued since it last ran, oldest first.
 * After a long task during a fast scroll, one target can arrive as
 * [enter, leave] in a single call. Reading the first entry then reported the
 * element on screen after it had left (or off screen after it came back),
 * so its animation ran unseen, or stayed frozen in view, until the next
 * crossing. Only for an observer that watches one element.
 */
export function latestEntry(
  entries: IntersectionObserverEntry[],
): IntersectionObserverEntry {
  return entries[entries.length - 1];
}
