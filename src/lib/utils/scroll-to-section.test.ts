import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scrollToSection, NAV_OFFSET } from "./scroll-to-section";

/**
 * The regression these cover: on the homepage a nav click called
 * window.scrollTo with behavior "smooth" and trusted it. Chrome drops a smooth
 * scroll when layout shifts under it, which this page does while content
 * loads, so clicks on far sections did nothing at all.
 */

/** Places an element at `top` px below the viewport, tracking scroll. */
function placeSection(id: string, documentTop: number) {
  const el = document.createElement("div");
  el.id = id;
  el.getBoundingClientRect = () =>
    ({ top: documentTop - window.pageYOffset }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

/** window.scrollTo that honours "instant" and ignores "smooth", as Chrome did. */
function stubScroll({ smoothWorks }: { smoothWorks: boolean }) {
  const calls: ScrollToOptions[] = [];
  vi.stubGlobal(
    "scrollTo",
    vi.fn((opts: ScrollToOptions) => {
      calls.push(opts);
      if (opts.behavior === "smooth" && !smoothWorks) return;
      Object.defineProperty(window, "pageYOffset", {
        value: opts.top,
        configurable: true,
      });
    }),
  );
  return calls;
}

describe("scrollToSection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "pageYOffset", {
      value: 0,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("arrives even when the browser drops the smooth scroll", () => {
    placeSection("research", 6503);
    const calls = stubScroll({ smoothWorks: false });

    expect(scrollToSection("research")).toBe(true);
    // The smooth attempt went nowhere, which is the bug being fixed.
    expect(window.pageYOffset).toBe(0);

    vi.advanceTimersByTime(500);

    expect(window.pageYOffset).toBe(6503 - NAV_OFFSET);
    expect(calls.at(-1)?.behavior).toBe("instant");
  });

  it("leaves a working smooth scroll alone", () => {
    placeSection("skills", 908);
    const calls = stubScroll({ smoothWorks: true });

    scrollToSection("skills");
    vi.advanceTimersByTime(3000);

    // One call, still smooth: no snap, no stutter.
    expect(calls).toHaveLength(1);
    expect(calls[0].behavior).toBe("smooth");
  });

  it("stops correcting once the user takes over", () => {
    placeSection("research", 6503);
    const calls = stubScroll({ smoothWorks: false });

    scrollToSection("research");
    window.dispatchEvent(new Event("wheel"));
    vi.advanceTimersByTime(3000);

    // Only the initial attempt: yanking a scrolling user back is worse than
    // not arriving.
    expect(calls).toHaveLength(1);
  });

  it("gives up rather than looping forever on a target it cannot reach", () => {
    // A section whose position keeps running away, e.g. content loading above
    // it indefinitely. The loop has to terminate.
    const el = placeSection("papers", 0);
    let top = 5000;
    el.getBoundingClientRect = () => {
      top += 1000;
      return { top: top - window.pageYOffset } as DOMRect;
    };
    const calls = stubScroll({ smoothWorks: false });

    scrollToSection("papers");
    vi.advanceTimersByTime(30_000);

    expect(calls.length).toBeLessThanOrEqual(12);
  });

  it("reports a section that is not on this page", () => {
    // What tells the caller to navigate home instead of scrolling nowhere.
    expect(scrollToSection("not-here")).toBe(false);
  });
});
