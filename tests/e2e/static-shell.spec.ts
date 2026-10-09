import { test, expect, type Page } from "@playwright/test";

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
      await context.close();
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
      await context.close();
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
      await context.close();
    });
  }

  test("shows the page when scripts are off", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.locator("[data-splash-backdrop]")).toBeHidden();
    await expect(page.locator("h1").first()).toBeVisible();
    await context.close();
  });
});
