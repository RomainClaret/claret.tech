import { test, expect, type BrowserContext, type Page } from "./utils/fixtures";

/**
 * framer-motion renders each `m` element's initial state into the HTML, and
 * for most of the page's content that is opacity 0: only framer's features,
 * a chunk that MotionProvider loads after hydration, animate it in. When
 * that chunk fails, the bundle never runs, or scripts are off, the content
 * must still show (globals.css). On a normal visit the fallback must not
 * fire: content below the fold waits for its entrance animation.
 */

const CHUNKS = /\/_next\/static\/chunks\//;

/**
 * Closes a context whose routes may still be reading a response. close()
 * disposes the responses first, and a handler that reads one then fails the
 * test with "Response has been disposed" (it did once under a parallel run).
 */
async function closeContext(context: BrowserContext) {
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await context.close();
}

// Without scrolling, a normal visit leaves 85% of <main>'s text readable
// (the rest waits for a hover, a breakpoint or a scroll). Before the
// fallback, each case below left 14%: the hero and the section titles.
const READABLE = 0.75;

/**
 * The share of the text under `selector` (<main> by default) a visitor can
 * read (effective opacity 0.5+).
 */
const readableShare = (page: Page, selector = "main") =>
  page.evaluate((selector) => {
    const effectiveOpacity = (element: Element | null) => {
      let opacity = 1;
      for (let node = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return 0;
        opacity *= Number(style.opacity);
      }
      return opacity;
    };
    const root = document.querySelector(selector);
    if (!root) return 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let total = 0;
    let readable = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = (node.textContent ?? "").trim().length;
      const parent = node.parentElement;
      if (!length || !parent || parent.closest(".sr-only")) continue;
      total += length;
      if (effectiveOpacity(parent) >= 0.5) readable += length;
    }
    return total ? readable / total : 0;
  }, selector);

// The experience timeline's cards wait at opacity 0 for an
// IntersectionObserver of their own, with classes rather than framer's
// inline styles, so the rules for framer's content missed them: 43% of the
// section could be read without scripts, against 100% once scrolled through.
const EXPERIENCE = "#experience";

// The timeline's company logos sit in an `m` element whose initial state is
// scale 0 (style="transform:scale(0)"), which no rule above matched: the
// text check cannot see them, so they are counted here.
const logosAtScaleZero = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll('#experience [style*="scale(0)"]')].filter(
        (element) =>
          getComputedStyle(element).transform === "matrix(0, 0, 0, 0, 0, 0)",
      ).length,
  );

const waitUntil = (page: Page, ms: number) =>
  page.waitForFunction((until) => performance.now() >= until, ms, {
    timeout: ms + 15_000,
  });

test.describe("Content behind framer's entrance animations", () => {
  test("shows when the motion features fail to load", async ({ browser }) => {
    const context = await browser.newContext();
    let aborted = false;
    await context.route(CHUNKS, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      // framer's domAnimation: the one chunk with the in-view feature.
      if (body.includes("inView:{Feature")) {
        aborted = true;
        return route.abort();
      }
      return route.fulfill({ response, body });
    });
    const page = await context.newPage();
    await page.goto("/?playwright=true");
    await expect(page.locator("[data-splash-backdrop]")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.locator('[aria-label="Loading portfolio"]')).toHaveCount(
      0,
      { timeout: 15_000 },
    );

    expect(aborted).toBe(true);
    await expect
      .poll(() => readableShare(page), { timeout: 5_000 })
      .toBeGreaterThan(READABLE);
    expect(await logosAtScaleZero(page)).toBe(0);
    await closeContext(context);
  });

  test("shows 6 s after the first paint when the bundle never runs", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await context.route(CHUNKS, (route) => route.abort());
    const page = await context.newPage();
    await page.goto("/?playwright=true");

    // Not early: the features get the same 6 s as the backdrop.
    await waitUntil(page, 4_500);
    expect(await readableShare(page)).toBeLessThan(0.5);
    expect(await readableShare(page, EXPERIENCE)).toBeLessThan(0.5);
    expect(await logosAtScaleZero(page)).toBeGreaterThan(0);
    await waitUntil(page, 6_500);
    expect(await readableShare(page)).toBeGreaterThan(READABLE);
    expect(await readableShare(page, EXPERIENCE)).toBeGreaterThan(0.95);
    expect(await logosAtScaleZero(page)).toBe(0);
    await closeContext(context);
  });

  test("shows at once when scripts are off", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    expect(await readableShare(page)).toBeGreaterThan(READABLE);
    expect(await readableShare(page, EXPERIENCE)).toBeGreaterThan(0.95);
    expect(await logosAtScaleZero(page)).toBe(0);
    await closeContext(context);
  });

  test("waits for its entrance animation on a normal visit", async ({
    page,
  }) => {
    await page.goto("/?playwright=true");
    // Past the fallback's 6 s, without scrolling: the experience cards,
    // below the fold, still wait at opacity 0 for the timeline's
    // IntersectionObserver, so the fallback stayed off. (Everything else
    // has animated in by 1.5 s.)
    await waitUntil(page, 7_000);
    const hidden = await page.evaluate(
      () =>
        [...document.querySelectorAll("#experience [style]")].filter(
          (element) =>
            getComputedStyle(element).opacity === "0" &&
            (element.textContent ?? "").trim().length > 0,
        ).length,
    );
    expect(hidden).toBeGreaterThan(0);
    // Nor did the cards' own: they still wait for their observer.
    const waiting = await page.evaluate(
      () =>
        [...document.querySelectorAll('#experience [data-reveal="pending"]')]
          .length,
    );
    expect(waiting).toBeGreaterThan(0);
    expect(await readableShare(page, EXPERIENCE)).toBeLessThan(0.95);
  });

  test("keeps the animations when only the first request for the features fails", async ({
    browser,
  }) => {
    // A transient failure (a dropped connection, one bad response): the
    // features are asked for once more, a second later, and arrive. The
    // page then animates as on any visit, rather than showing everything
    // still through the fallback.
    const context = await browser.newContext();
    let requests = 0;
    await context.route(CHUNKS, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes("inView:{Feature") && ++requests === 1) {
        return route.abort();
      }
      return route.fulfill({ response, body });
    });
    const page = await context.newPage();
    await page.goto("/?playwright=true");

    await expect(page.locator("html")).toHaveAttribute(
      "data-motion-features",
      "ready",
      { timeout: 15_000 },
    );
    expect(requests).toBe(2);
    await closeContext(context);
  });
});
