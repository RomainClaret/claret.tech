/**
 * The page's scroll lock, shared by everything that covers the page: the
 * site's dialogs, the performance dashboard and the splash.
 *
 * Each of them wrote `document.body.style.overflow` itself, and wrote back
 * its own idea of unlocked ("", "unset", "auto"), so whichever closed first
 * unlocked the page under the other: the dashboard, opened from the terminal
 * over the PDF reader, let the page scroll under the reader once it closed.
 * One count now: the first lock saves the inline value and hides the
 * overflow, and the last release puts the saved value back.
 */

let locks = 0;
let saved = "";

/** Locks the page's scroll and returns the release, which works once. */
export function lockPageScroll(): () => void {
  if (locks === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks--;
    if (locks === 0) document.body.style.overflow = saved;
  };
}
