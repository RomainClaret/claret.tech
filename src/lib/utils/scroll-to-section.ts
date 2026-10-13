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
 *
 * The check-back runs for up to two seconds and belongs to no component, so a
 * caller that can go away passes `signal` and aborts it: on unmount, or when a
 * newer scroll replaces this one. Without that it outlives its caller and
 * keeps snapping the page to a target nobody is looking for any more.
 *
 * With `focus`, the section also takes focus, as it would after a native
 * in-page link: the caller cancelled that link, so the browser never moved
 * focus, and the next Tab started from wherever it was (the body, once a
 * menu that held the link closed). For a choice the user made, not for a
 * deep link on load.
 */
export function scrollToSection(
  sectionId: string,
  { signal, focus = false }: { signal?: AbortSignal; focus?: boolean } = {},
): boolean {
  const element = document.getElementById(sectionId);
  if (!element || signal?.aborted) return false;

  const targetTop = () =>
    element.getBoundingClientRect().top + window.pageYOffset - NAV_OFFSET;

  const startedAt = window.pageYOffset;
  window.scrollTo({ top: targetTop(), behavior: "smooth" });
  if (focus) focusInPlace(element);

  // ~2s of supervision: long enough for a smooth scroll plus late layout
  // shifts, short enough that it never fights a user who takes over.
  let ticks = 0;
  let lastY = startedAt;
  const interval = setInterval(() => {
    ticks += 1;
    const currentY = window.pageYOffset;
    const target = targetTop();

    if (Math.abs(currentY - target) < 8 || ticks > 10) {
      stop();
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
    signal?.removeEventListener("abort", stop);
  };
  window.addEventListener("wheel", stop, { passive: true, once: true });
  window.addEventListener("touchmove", stop, { passive: true, once: true });
  signal?.addEventListener("abort", stop, { once: true });

  return true;
}

/**
 * Focuses `element` without scrolling to it. A section is a container, not a
 * control: it takes focus through a temporary tabindex, with no outline (an
 * inline style, as src/lib is outside Tailwind's content), and both go when
 * focus moves on. A tabindex of its own is kept.
 */
function focusInPlace(element: HTMLElement) {
  if (!element.hasAttribute("tabindex")) {
    const outline = element.style.outline;
    element.setAttribute("tabindex", "-1");
    element.style.outline = "none";
    element.addEventListener(
      "blur",
      () => {
        element.removeAttribute("tabindex");
        element.style.outline = outline;
      },
      { once: true },
    );
  }
  element.focus({ preventScroll: true });
}
