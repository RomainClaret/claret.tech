import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "./utils/fixtures";
import { routeChunk, type ChunkHandler } from "./utils/chunks";
import { gotoWithoutScripts } from "./utils/no-script";

/**
 * The homepage is generated once, at build time, for every visitor. What
 * depends on the visitor (theme, browser) is settled by a script in <head>
 * before the first paint, and the rest after hydration, under the splash's
 * backdrop, which is the page's first paint. These pin what must hold for
 * that: the first paint, a clean hydration, a page that still shows
 * without scripts or when the bundle never runs, and no splash over a page
 * that is already on screen.
 */

const isSafari = (browserName: string) => browserName === "webkit";

// What a click in the middle of the screen would land on.
const backdropCoversCenter = (page: Page) =>
  page.evaluate(() =>
    Boolean(
      document
        .elementFromPoint(innerWidth / 2, innerHeight / 2)
        ?.closest("[data-splash-backdrop]"),
    ),
  );

/** The splash's chunk, picked out by its label as in the 4 s timer test. */
const routeSplashChunk = (context: BrowserContext, handle: ChunkHandler) =>
  routeChunk(context, "Loading portfolio", handle);

/**
 * Closes a context whose routes may still be reading a response. close()
 * disposes the responses first, and a handler that reads one then fails the
 * test with "Response has been disposed" (it did once under a parallel run).
 */
async function closeContext(context: BrowserContext) {
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await context.close();
}

type SplashWatch = {
  splashSeen: boolean;
  backdropGone?: number;
  fallbackRunning: boolean;
  fallbackFired: boolean;
};

/**
 * From the document's start: did the splash ever show, when did the
 * backdrop go, and did the stylesheet's 6 s fallback (globals.css) run on
 * it and run out?
 */
async function watchSplash(context: BrowserContext) {
  await context.addInitScript(() => {
    const seen = window as unknown as SplashWatch;
    seen.splashSeen = false;
    seen.fallbackRunning = false;
    seen.fallbackFired = false;
    // The backdrop's arrival and removal, as they happen. A check once a
    // frame missed a backdrop that went before Linux WebKit's first frame:
    // 3 runs in 5 read backdropGone as undefined.
    let backdrop: Element | null = null;
    let found = false;
    const observer = new MutationObserver(() => {
      if (backdrop?.isConnected) return;
      backdrop = document.querySelector("[data-splash-backdrop]");
      if (backdrop) {
        found = true;
      } else if (found) {
        seen.backdropGone = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
    // The app removes the backdrop after the fallback's animation ends
    // (app-wrapper.tsx), so this tells which came first, on no clock.
    document.addEventListener(
      "animationend",
      (event) => {
        if (event.animationName === "splash-backdrop-timeout") {
          seen.fallbackFired = true;
        }
      },
      true,
    );
    const check = () => {
      if (
        backdrop?.isConnected &&
        backdrop
          .getAnimations()
          .some(
            (animation) =>
              (animation as CSSAnimation).animationName ===
              "splash-backdrop-timeout",
          )
      ) {
        seen.fallbackRunning = true;
      }
      const splash = document.querySelector('[aria-label="Loading portfolio"]');
      if (splash && getComputedStyle(splash).display !== "none") {
        seen.splashSeen = true;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

const splashWatch = (page: Page) =>
  page.evaluate(() => {
    const { splashSeen, backdropGone, fallbackRunning, fallbackFired } =
      window as unknown as SplashWatch;
    return { splashSeen, backdropGone, fallbackRunning, fallbackFired };
  });

// The error screen of the boundary around the whole site (AppWrapper's).
const errorScreen = (page: Page) =>
  page.getByText("Oops! Something went wrong");

/** The page is on screen: no error screen, no backdrop, no scroll lock. */
async function expectPageShown(page: Page) {
  await expect(errorScreen(page)).toHaveCount(0);
  await expect(page.locator("h1").first()).toBeVisible();
  expect(await backdropCoversCenter(page)).toBe(false);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
}

test.describe("Static shell", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`first paints the splash's backdrop, in the ${theme} theme`, async ({
      browser,
      browserName,
    }) => {
      const context = await browser.newContext();
      await context.addInitScript((stored) => {
        try {
          localStorage.setItem("theme", stored);
        } catch {
          // Storage blocked: the theme stays light, which the test would show.
        }
      }, theme);
      // No bundle runs: the HTML and the head script alone.
      await context.route(/\/_next\/static\/chunks\//, (route) =>
        route.abort(),
      );
      const page = await context.newPage();
      await page.goto("/?playwright=true");

      const first = await page.evaluate(() => {
        const atCenter = document.elementFromPoint(
          innerWidth / 2,
          innerHeight / 2,
        );
        const root = document.documentElement;
        return {
          covered: Boolean(atCenter?.closest("[data-splash-backdrop]")),
          dark: root.classList.contains("dark"),
          safari: root.dataset.safari,
          animations: root.classList.contains("enable-animations"),
        };
      });

      expect(first.covered).toBe(true);
      expect(first.dark).toBe(theme === "dark");
      expect(first.safari).toBe(String(isSafari(browserName)));
      expect(first.animations).toBe(!isSafari(browserName));
      await closeContext(context);
    });
  }

  // On a phone, the first paint is the server's HTML, every entrance in its
  // starting state until the bundle runs. The Contact section's avatar
  // column started 20 px to the right: as wide as the screen inside 16 px
  // of padding, it stuck out 4 px, so the page panned sideways until the
  // entrance ended (up to 2 s in WebKit), or for good without the bundle.
  test("fits a phone's screen before the bundle runs", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.route(/\/_next\/static\/chunks\//, (route) => route.abort());
    const page = await context.newPage();
    await page.goto("/?playwright=true");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await closeContext(context);
  });

  // High contrast is settled by the same script: the visitor's choice, or
  // else the system's preference. A stored choice used to wait for the
  // bundle (the toggle's effect), and the system's was never read.
  for (const [source, stored, contrast, expected] of [
    ["the visitor's choice", "true", "no-preference", true],
    ["the system's preference", null, "more", true],
    ["neither: the visitor turned it off", "false", "more", false],
  ] as const) {
    test(`first paints high contrast from ${source}`, async ({
      browser,
      browserName,
    }) => {
      // Playwright's Firefox (1.64) drops its contrast and colour scheme
      // emulation on a page sent with Cross-Origin-Opener-Policy:
      // same-origin, as every page here is: a bare server lost it with that
      // one header and kept it without, while reduced motion held.
      test.skip(
        browserName === "firefox" && contrast === "more",
        "Playwright's Firefox drops prefers-contrast emulation under COOP",
      );
      const context = await browser.newContext({ contrast });
      await context.addInitScript((value) => {
        try {
          if (value !== null) localStorage.setItem("highContrast", value);
        } catch {
          // Storage blocked: the system decides, which the test would show.
        }
      }, stored);
      // No bundle runs: the HTML and the head script alone.
      await context.route(/\/_next\/static\/chunks\//, (route) =>
        route.abort(),
      );
      const page = await context.newPage();
      await page.goto("/?playwright=true");

      expect(
        await page.evaluate(() =>
          document.documentElement.classList.contains("high-contrast"),
        ),
      ).toBe(expected);
      await closeContext(context);
    });
  }

  test("hydrates without a mismatch, and the backdrop gives way", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydrat|did not match|server rendered|Minified React error/i.test(
          message.text(),
        )
      ) {
        errors.push(message.text());
      }
    });
    page.on("pageerror", (error) => errors.push(String(error)));

    await page.goto("/?playwright=true");

    await expect(page.locator("[data-splash-backdrop]")).toHaveCount(0, {
      timeout: 15_000,
    });
    expect(errors).toEqual([]);
  });

  // Only the bundle removes the backdrop. When it never runs (a blocked or
  // missing chunk, an error before hydration), the stylesheet hides it
  // after 6 s. Reduced motion is checked too: it is the one setting under
  // which global rules rewrite every animation (globals.css).
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`shows the page after 6 s when the bundle never runs, reduced motion: ${reducedMotion}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ reducedMotion });
      await context.route(/\/_next\/static\/chunks\//, (route) =>
        route.abort(),
      );
      const page = await context.newPage();
      await page.goto("/?playwright=true");

      // Not early: still covered at 4.5 s, past the bundle's own 4 s timer.
      // (Written as a duration rather than a delay, the 6 s would run out
      // at once under reduced motion.)
      await page.waitForFunction(() => performance.now() >= 4_500);
      expect(await backdropCoversCenter(page)).toBe(true);

      await expect(page.locator("[data-splash-backdrop]")).toBeHidden({
        timeout: 5_000,
      });
      // Hidden, not just transparent: clicks reach the page.
      expect(await backdropCoversCenter(page)).toBe(false);
      await expect(page.locator("h1").first()).toBeVisible();
      await closeContext(context);
    });
  }

  // On a slow connection the page can reach the screen before the splash:
  // the splash must then skip itself rather than cover a page the visitor
  // is reading (app-wrapper.tsx). The chunks the HTML names are held back
  // by `first` ms, and the ones asked for after hydration, the splash's
  // among them, by 3 s more: the splash then arrives after the stylesheet's
  // fallback has shown the page, and a second before the 4 s timer would
  // skip it anyway, so only the path under test can.
  for (const [when, first] of [
    ["after hydration, on its animationend", 4_500],
    ["before hydration, as seen on mount", 7_000],
  ] as const) {
    test(`skips the splash when the fallback showed the page ${when}`, async ({
      browser,
    }) => {
      const context = await browser.newContext();
      const start = Date.now();
      await context.route(/\/_next\/static\/chunks\//, async (route) => {
        const named = Date.now() - start < 2_000;
        await new Promise((done) => setTimeout(done, named ? first : 3_000));
        await route.continue();
      });
      // Did the splash ever show? Watched from the document's start.
      await context.addInitScript(() => {
        const seen = window as unknown as { splashSeen: boolean };
        seen.splashSeen = false;
        const check = () => {
          const splash = document.querySelector(
            '[aria-label="Loading portfolio"]',
          );
          if (splash && getComputedStyle(splash).display !== "none") {
            seen.splashSeen = true;
          }
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
      const page = await context.newPage();
      const requested: string[] = [];
      page.on("request", (request) => requested.push(request.url()));
      await page.goto("/?playwright=true");

      // Past the splash's arrival and its two seconds on screen.
      await page.waitForFunction(
        (until) => performance.now() >= until,
        first + 6_000,
        { timeout: 20_000 },
      );

      expect(
        await page.evaluate(
          () => (window as unknown as { splashSeen: boolean }).splashSeen,
        ),
      ).toBe(false);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
        "hidden",
      );
      // The splash still did its work: it asked for every project.
      expect(
        requested.some((url) => url.includes("/api/fetch-all-repos")),
      ).toBe(true);
      await closeContext(context);
    });
  }

  // The same when the 4 s timer shows the page first, before the
  // stylesheet's fallback can. The page's own chunks pass at once, so it
  // hydrates early and the timer uncovers it well before 6 s; only the
  // splash's chunk is held back, 6 s, so it arrives after the timer. It is
  // picked out by its label, not by when it is asked for: Chromium asks for
  // it at 0.4 s here, while WebKit is still asking for the chunks the HTML
  // names at 0.8 s, so no cutoff works in both.
  test("skips the splash when the 4 s timer showed the page", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    let splashHeld = false;
    await context.route(/\/_next\/static\/chunks\//, async (route) => {
      const response = await route.fetch();
      if ((await response.text()).includes("Loading portfolio")) {
        splashHeld = true;
        await new Promise((done) => setTimeout(done, 6_000));
      }
      await route.fulfill({ response });
    });
    await watchSplash(context);
    const page = await context.newPage();
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    await page.goto("/?playwright=true");

    // Past the splash's arrival and its two seconds on screen.
    await page.waitForFunction(() => performance.now() >= 11_000, null, {
      timeout: 20_000,
    });

    const seen = await splashWatch(page);
    expect(splashHeld).toBe(true);
    // The timer uncovered the page, not the stylesheet: the backdrop went
    // while the stylesheet's fallback was still counting its 6 s, which
    // start at the first paint. That needs hydration within 2 s of it:
    // under 1 s here, 1.3 s with a 4x slower CPU; with an 8x slower one
    // the fallback came first, which this says. A bound of 6 s after the
    // navigation could not tell the two apart.
    expect(seen.backdropGone).toBeDefined();
    expect(seen.fallbackRunning).toBe(true);
    expect(seen.fallbackFired).toBe(false);
    expect(seen.splashSeen).toBe(false);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
    // The splash still did its work: it asked for every project.
    expect(requested.some((url) => url.includes("/api/fetch-all-repos"))).toBe(
      true,
    );
    await closeContext(context);
  });

  // When the splash's chunk cannot be fetched (a flaky network, a blocker, a
  // deploy that renamed it under an open tab), the page shows without it.
  // React.lazy threw while rendering, and the error boundary around the
  // whole site replaced it with its error screen, whose "Try Again" did not
  // ask for the chunk again: only a reload brought the page back. The
  // splash's loader now tries once more, then stands down (app-wrapper.tsx).
  test("shows the page without the splash when its chunk fails to load", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const requests = await routeSplashChunk(context, (route) => route.abort());
    await watchSplash(context);
    const page = await context.newPage();
    await page.goto("/?playwright=true");

    await expect(page.locator("[data-splash-backdrop]")).toHaveCount(0);
    await expectPageShown(page);
    // Asked for twice: the first load, then the stand-in's try as it
    // mounted. webpack forgets a failed chunk, so the second import()
    // requests it again.
    await expect.poll(requests).toBe(2);
    const seen = await splashWatch(page);
    expect(seen.splashSeen).toBe(false);
    // The stand-in removed the backdrop once the second try failed, as a
    // finished splash does; the timer cannot fire before 4 s.
    expect(seen.backdropGone).toBeLessThan(4_000);
    await closeContext(context);
  });

  // The same failure on a slow connection, after the 4 s timer has shown the
  // page: that failure took down a page the visitor was already reading.
  // Each request fails when the test lets it: the first once the page
  // shows, the stand-in's try once the page is checked after the first.
  // Held a fixed 6 s each, the test assumed the timer came first, which a
  // slow machine did not keep: 3 of 40 runs under load, and every run at
  // 12x CPU throttling, failed.
  test("keeps the page when the splash's chunk fails after the timer showed it", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    let aborted = 0;
    // One gate per request: each fails when the test lets it.
    const fail: (() => void)[] = [];
    const gates = [0, 1].map(
      () => new Promise<void>((resolve) => fail.push(resolve)),
    );
    const requests = await routeSplashChunk(
      context,
      async (route, _response, nth) => {
        await gates[nth - 1];
        await route.abort();
        aborted++;
      },
    );
    await watchSplash(context);
    const page = await context.newPage();
    // Not until the load event: the held chunk can delay it past the first
    // failure.
    await page.goto("/?playwright=true", { waitUntil: "domcontentloaded" });

    // On screen once the timer has run (4 s after hydration), the chunk
    // still held: however long hydration takes.
    await expect(page.locator("[data-splash-backdrop]")).toHaveCount(0, {
      timeout: 30_000,
    });
    await expectPageShown(page);
    expect(aborted).toBe(0);

    // Still on screen after the first failure.
    fail[0]();
    await expect.poll(() => aborted).toBe(1);
    await expectPageShown(page);
    // And after the stand-in's try, held as it arrives, has failed too.
    await expect.poll(requests, { timeout: 15_000 }).toBe(2);
    fail[1]();
    await expect.poll(() => aborted).toBe(2);
    await page.waitForTimeout(500);
    await expectPageShown(page);
    expect(requests()).toBe(2);
    expect((await splashWatch(page)).splashSeen).toBe(false);
    await closeContext(context);
  });

  // A failure that does not last: the stand-in's try loads the chunk, and
  // the splash plays as it would have.
  test("plays the splash when its chunk loads on the second try", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const requests = await routeSplashChunk(context, (route, response, nth) =>
      nth === 1 ? route.abort() : route.fulfill({ response }),
    );
    const page = await context.newPage();
    await page.goto("/?playwright=true");

    const splash = page.getByRole("progressbar", { name: "Loading portfolio" });
    await expect(splash).toBeVisible();
    await expect(splash).toHaveCount(0, { timeout: 10_000 });
    await expect.poll(requests).toBe(2);
    await expectPageShown(page);
    await closeContext(context);
  });

  test("shows the page when scripts are off", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await gotoWithoutScripts(page);

    await expect(page.locator("[data-splash-backdrop]")).toBeHidden();
    await expect(page.locator("h1").first()).toBeVisible();
    await closeContext(context);
  });
});

// Decorations load in chunks of their own, on every visit. When one could
// not be fetched, React.lazy threw while rendering and the nearest error
// boundary replaced what it wraps. Each loader now tries once more, then
// keeps the placeholder it shows while loading.
test.describe("A decoration whose chunk fails to load", () => {
  // Either error screen: the site's (AppWrapper's) or the page's.
  const anyErrorScreen = (page: Page) =>
    page.getByText(/something went wrong/i);

  const splash = (page: Page) =>
    page.getByRole("progressbar", { name: "Loading portfolio" });

  // The splash's animation player (lottie-web, whose global is bodymovin).
  // The splash plays it, under the error boundary around the whole site.
  test("plays the splash without its animation", async ({ browser }) => {
    const context = await browser.newContext();
    const requests = await routeChunk(context, "bodymovin", (route) =>
      route.abort(),
    );
    const page = await context.newPage();
    await page.goto("/?playwright=true");

    await expect(splash(page)).toBeVisible();
    await expect(splash(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(anyErrorScreen(page)).toHaveCount(0);
    await expectPageShown(page);
    // The first load and the stand-in's try.
    await expect.poll(requests).toBe(2);
    await closeContext(context);
  });

  /**
   * The hero without what the chunk holding `marker` draws, once the splash
   * that covers the failure has played. The hero is under the page's error
   * boundary (error.tsx), which replaced everything under the navigation.
   */
  async function expectHeroWithout(browser: Browser, marker: string) {
    const context = await browser.newContext();
    const requests = await routeChunk(context, marker, (route) =>
      route.abort(),
    );
    const page = await context.newPage();
    await page.goto("/?playwright=true");

    await expect(splash(page)).toBeVisible();
    await expect(splash(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(anyErrorScreen(page)).toHaveCount(0);
    await expect(page.locator("#home h1")).toBeVisible();
    await expect(page.locator("#contact")).toBeAttached();
    expect(await page.locator("#home canvas").count()).toBe(0);
    // The first load and the stand-in's try (both brains share them).
    await expect.poll(requests).toBe(2);
    await closeContext(context);
  }

  // DualBrainAnimation: the brains' frame and motion.
  test("shows the hero without the brains", ({ browser }) =>
    expectHeroWithout(browser, "dual-brain-background"));

  // BrainNetworkVisualization: the canvas each brain draws on, picked out by
  // one of its contour nodes.
  test("shows the hero without the brains' canvases", ({ browser }) =>
    expectHeroWithout(browser, '"contour1"'));
});

test.describe("A terminal tool whose chunk fails to load", () => {
  // The terminal's `fps`, `performance` and `research` open these under the
  // error boundary around the whole site, which replaced the page with its
  // error screen until a reload.
  async function openWithChunkFailing(
    browser: Browser,
    marker: string,
    open: (page: Page) => Promise<void>,
  ) {
    const context = await browser.newContext();
    const requests = await routeChunk(context, marker, (route) =>
      route.abort(),
    );
    const page = await context.newPage();
    await page.goto("/?playwright=true");
    // Shown, then gone: a count of 0 alone also passes before the splash
    // mounts, and an event sent then reaches no listener yet.
    const splash = page.getByRole("progressbar", { name: "Loading portfolio" });
    await expect(splash).toBeVisible();
    await expect(splash).toHaveCount(0, { timeout: 15_000 });
    await open(page);
    return { context, page, requests };
  }

  test("keeps the page, and says the monitor could not load", async ({
    browser,
  }) => {
    const { context, page, requests } = await openWithChunkFailing(
      browser,
      "Close performance monitor (ESC)",
      (page) =>
        page.evaluate(() => {
          window.dispatchEvent(new CustomEvent("terminal-fps-command"));
        }),
    );

    await expect(
      page.getByText("Could not load the performance monitor."),
    ).toBeVisible();
    await expectPageShown(page);
    // The first load and the stand-in's try.
    await expect.poll(requests).toBe(2);
    await closeContext(context);
  });

  test("keeps the page, and says the dashboard could not load", async ({
    browser,
  }) => {
    const { context, page, requests } = await openWithChunkFailing(
      browser,
      "Performance Dashboard (minimized)",
      (page) =>
        page.evaluate(() => {
          window.dispatchEvent(
            new CustomEvent("terminal-performance-dashboard", {
              detail: { token: "e2e", timestamp: Date.now() },
            }),
          );
        }),
    );

    const dialog = page.getByRole("dialog", { name: "Performance dashboard" });
    await expect(dialog).toContainText(
      "Could not load the performance dashboard.",
    );
    await expect(errorScreen(page)).toHaveCount(0);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect.poll(requests).toBe(2);
    // Above the cookie notice too, which sits at the page's root (z-50):
    // at the same z-50 and earlier in the page, the dialog was under it.
    const notice = page.getByText("Cookie Selection:");
    await expect(notice).toBeVisible();
    expect(
      await notice.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return element.closest("div.fixed")?.contains(hit) ?? false;
      }),
    ).toBe(false);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await closeContext(context);
  });

  test("keeps the page, and says the research map could not load", async ({
    browser,
  }) => {
    const { context, page, requests } = await openWithChunkFailing(
      browser,
      // Only in the map's own chunk (its details panel).
      "Choose an item on the map",
      (page) =>
        page.evaluate(() => {
          window.dispatchEvent(
            new CustomEvent("terminal-research-map", {
              detail: { token: "e2e", timestamp: Date.now() },
            }),
          );
        }),
    );

    const dialog = page.getByRole("dialog", { name: "Research map" });
    await expect(dialog).toContainText("Could not load the research map.");
    await expect(errorScreen(page)).toHaveCount(0);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect.poll(requests).toBe(2);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await closeContext(context);
  });
});

test.describe("The retired service worker", () => {
  // It never registered on this site's own pages (its "load" listener came
  // after "load"), but an earlier version did register it, and it kept
  // serving images from its cache. Visiting now removes it and its cache.
  test("is removed, with its cache, from a browser that still has it", async ({
    page,
  }) => {
    await page.goto("/?playwright=true");
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js");
      // Bounded: the /sw.js served now removes itself as it activates.
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      const cache = await caches.open("claret-tech-v6");
      await cache.put("/images/left-over.png", new Response("old"));
      // Not the site's: WebLLM keeps the AI terminal's model here.
      await caches.open("webllm/model");
    });

    await page.reload();

    await expect
      .poll(
        () =>
          page.evaluate(async () => [
            (await navigator.serviceWorker.getRegistrations()).length,
            ...(await caches.keys()),
          ]),
        { timeout: 15_000 },
      )
      .toEqual([0, "webllm/model"]);
  });
});
