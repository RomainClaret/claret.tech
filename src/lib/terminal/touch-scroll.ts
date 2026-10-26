/**
 * A finger on the terminal scrolls the terminal, never the page behind it.
 *
 * xterm 6 scrolls its lines from the wheel only: it ships VS Code's touch
 * gestures but registers nothing for them, and its viewport is no longer a
 * native scroller. On a phone a swipe over the terminal scrolled the page
 * (200 to 1,500 px in Chromium) and the scrollback was out of reach. Here one
 * finger moves the lines under it and a flick glides on, as a page does; two
 * fingers stay the browser's pinch zoom, and a tap stays a tap.
 */

/** What this needs of an xterm Terminal. */
export interface TouchScrollTarget {
  readonly rows: number;
  scrollLines(amount: number): void;
  readonly buffer: {
    readonly active: { readonly viewportY: number; readonly baseY: number };
  };
}

/** A glide keeps this share of its speed each 16 ms frame. */
const GLIDE_KEEP = 0.95;
/** Slower than this, in px per ms, a lifted finger leaves the lines where they are. */
const GLIDE_MIN = 0.1;
/** The finger's speed at lift-off is read over its moves within this many ms. */
const SPEED_WINDOW = 100;
/** A row's height when the terminal has not been measured. */
const FALLBACK_ROW = 17;

export function attachTouchScroll(
  element: HTMLElement,
  term: TouchScrollTarget,
  rowHeight: () => number,
): () => void {
  let lastY: number | null = null;
  // Finger travel not yet a whole line, in px; above 0 is toward newer lines.
  let pending = 0;
  let moves: { y: number; at: number }[] = [];
  let frame = 0;

  const stopGlide = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const scrollBy = (pixels: number) => {
    const height = rowHeight() || FALLBACK_ROW;
    pending += pixels;
    const lines = Math.trunc(pending / height);
    if (lines !== 0) {
      term.scrollLines(lines);
      pending -= lines * height;
    }
  };

  const atEnd = (forward: boolean) => {
    const { viewportY, baseY } = term.buffer.active;
    return forward ? viewportY >= baseY : viewportY <= 0;
  };

  const onStart = (event: TouchEvent) => {
    stopGlide();
    if (event.touches.length !== 1) {
      lastY = null;
      return;
    }
    lastY = event.touches[0].clientY;
    pending = 0;
    moves = [{ y: lastY, at: event.timeStamp }];
  };

  const onMove = (event: TouchEvent) => {
    if (lastY === null || event.touches.length !== 1) return;
    // The page behind stays where it is.
    if (event.cancelable) event.preventDefault();
    const y = event.touches[0].clientY;
    scrollBy(lastY - y);
    lastY = y;
    moves.push({ y, at: event.timeStamp });
    while (event.timeStamp - moves[0].at > SPEED_WINDOW) moves.shift();
  };

  const onEnd = (event: TouchEvent) => {
    if (lastY === null) return;
    lastY = null;
    // Only the moves just before the lift count: a finger that rested
    // before it lifted leaves the lines where they are.
    const recent = moves.filter(
      (move) => event.timeStamp - move.at <= SPEED_WINDOW,
    );
    if (recent.length < 2) return;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const elapsed = last.at - first.at;
    let speed = elapsed > 0 ? (first.y - last.y) / elapsed : 0;
    if (Math.abs(speed) < GLIDE_MIN) return;
    let previous = performance.now();
    const glide = (now: number) => {
      const step = Math.max(0, now - previous);
      previous = now;
      scrollBy(speed * step);
      speed *= Math.pow(GLIDE_KEEP, step / 16);
      if (Math.abs(speed) < GLIDE_MIN / 2 || atEnd(speed > 0)) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(glide);
    };
    frame = requestAnimationFrame(glide);
  };

  // A touch the browser took over (a system gesture) ends without a glide.
  const onCancel = () => {
    lastY = null;
  };

  element.addEventListener("touchstart", onStart, { passive: true });
  element.addEventListener("touchmove", onMove, { passive: false });
  element.addEventListener("touchend", onEnd);
  element.addEventListener("touchcancel", onCancel);
  return () => {
    stopGlide();
    element.removeEventListener("touchstart", onStart);
    element.removeEventListener("touchmove", onMove);
    element.removeEventListener("touchend", onEnd);
    element.removeEventListener("touchcancel", onCancel);
  };
}
