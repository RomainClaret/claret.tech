/** Height of the fixed nav, which every scroll target has to clear. */
export const NAV_OFFSET = 64;

/**
 * Scroll to a section, and make sure it actually arrives.
 *
 * A plain `window.scrollTo({ behavior: "smooth" })` is not reliable on the
 * homepage: it is ~20,000px tall and keeps loading content, and Chrome
 * abandons an in-flight smooth scroll when layout shifts under it. Measured on
 * the running site, a smooth scroll to 6503px never moved at all, at 800ms or
 * 2000ms, while an instant scroll to the same offset arrived immediately.
 * Short hops still work, which is why this only ever looked like "the menu
 * does nothing" for sections far down the page.
 *
 * So: start the smooth scroll, then check back. If it made no progress, snap.
 * If it is on its way, leave it alone and re-measure, because the target keeps
 * moving while content above it loads. Same shape as the settle loop in
 * useCardDeepLink, which lands reliably on this page.
 */
export function scrollToSection(sectionId: string): boolean {
  const element = document.getElementById(sectionId);
  if (!element) return false;

  const targetTop = () =>
    element.getBoundingClientRect().top + window.pageYOffset - NAV_OFFSET;

  const startedAt = window.pageYOffset;
  window.scrollTo({ top: targetTop(), behavior: "smooth" });

  // ~2s of supervision: long enough for a smooth scroll plus late layout
  // shifts, short enough that it never fights a user who takes over.
  let ticks = 0;
  let lastY = startedAt;
  const interval = setInterval(() => {
    ticks += 1;
    const currentY = window.pageYOffset;
    const target = targetTop();

    if (Math.abs(currentY - target) < 8 || ticks > 10) {
      clearInterval(interval);
      return;
    }

    const moving = Math.abs(currentY - lastY) > 1;
    lastY = currentY;
    // Still animating: let it run rather than stuttering it with a snap.
    if (moving) return;

    // Stationary and not there, so the smooth scroll was dropped.
    window.scrollTo({ top: target, behavior: "instant" });
  }, 200);

  const stop = () => {
    clearInterval(interval);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchmove", stop);
  };
  window.addEventListener("wheel", stop, { passive: true, once: true });
  window.addEventListener("touchmove", stop, { passive: true, once: true });

  return true;
}
