import { test, expect, type Page } from "./utils/fixtures";
import { acknowledgeCookieNotice } from "./utils/cookie-notice";
import { waitForSplashToEnd } from "./utils/splash";
import AxeBuilder from "@axe-core/playwright";

/**
 * The PDF reader draws a canvas only for the pages near the viewport.
 *
 * Every page drew one before, and a canvas holds its page's pixels at the
 * screen's density: the 368-page PhD thesis asked for 7.8 GB at DPR 2. Pages
 * further away keep their text and link layers, and each page's box keeps its
 * size, so scrolling, the page counter, find-in-page and zoom work as before.
 *
 * Runs against /pdf/phd-thesis, which opens the reader without the splash.
 */

test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

const canvases = (page: Page) =>
  page.locator(".react-pdf__Page__canvas").count();

/** Bring page `n`'s box into view inside the reader's own scroll box. */
async function scrollToPage(page: Page, n: number) {
  await page
    .locator(`[data-page="${n}"]`)
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
}

/** The page most in view in the reader's scroll box, by the counter's rule. */
function pageInView(page: Page): Promise<number> {
  return page.evaluate(() => {
    const viewer = document
      .querySelector("[data-page]")!
      .closest(".overflow-auto")!;
    const top = viewer.getBoundingClientRect().top;
    const bottom = top + viewer.clientHeight;
    let best = 1;
    let most = 0;
    for (const box of viewer.querySelectorAll<HTMLElement>("[data-page]")) {
      const rect = box.getBoundingClientRect();
      const seen = Math.min(bottom, rect.bottom) - Math.max(top, rect.top);
      if (seen > most) {
        most = seen;
        best = Number(box.dataset.page);
      }
    }
    return best;
  });
}

type ReloadFlags = {
  redrawn?: boolean;
  layersBack?: boolean;
  drawnWithLayers?: boolean;
};

/**
 * Switches page `n`'s document to the fallback fonts, waits for the reload,
 * and says whether page `n` was drawn as soon as it was back.
 *
 * react-pdf 10.0 drew the same canvas again from the new document (hidden
 * while it drew). 10.5 unmounts every page box until the new document
 * arrives and mounts new ones: page `n` is back when its new box's layers
 * are, and it must have its canvas then. The page observer took the
 * unmounted boxes for pages out of view, which left the reader's page
 * blank until every page's size had been measured again.
 */
async function reloadWithFallbackFonts(page: Page, n: number) {
  const canvas = page.locator(`[data-page="${n}"] .react-pdf__Page__canvas`);
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await canvas.evaluate((element: HTMLCanvasElement, n: number) => {
    const flags = window as unknown as ReloadFlags;
    let hidden = false;
    new MutationObserver(() => {
      if (element.style.visibility === "hidden") hidden = true;
      else if (hidden) flags.redrawn = true;
    }).observe(element, { attributes: true, attributeFilter: ["style"] });
    const viewer = element.closest(".overflow-auto")!;
    new MutationObserver(() => {
      if (flags.layersBack || element.isConnected) return;
      const box = viewer.querySelector(`[data-page="${n}"]`);
      if (!box?.querySelector(".annotationLayer")) return;
      flags.layersBack = true;
      flags.drawnWithLayers = !!box.querySelector(".react-pdf__Page__canvas");
    }).observe(viewer, { childList: true, subtree: true });
  }, n);

  // The switch shows on a font warning, which this document does not log
  // by itself.
  await page.evaluate(() =>
    console.warn("Warning: TT: undefined function: 32"),
  );
  await page.getByRole("button", { name: /fallback fonts/ }).click();
  await page.waitForFunction(
    () => {
      const flags = window as unknown as ReloadFlags;
      return flags.redrawn === true || flags.layersBack === true;
    },
    null,
    { timeout: 30_000 },
  );
  return page.evaluate(() => {
    const flags = window as unknown as ReloadFlags;
    return flags.redrawn === true || flags.drawnWithLayers === true;
  });
}

test.describe("PDF reader", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pdf/phd-thesis");
    await expect(page.locator(".react-pdf__Page__canvas").first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test("draws only the pages near the viewport", async ({ page }) => {
    const counter = page.getByText(/Page \d+ of \d+/);
    await expect(counter).toHaveText(/Page 1 of (\d{3})/);
    const total = Number(
      (await counter.textContent())?.match(/of (\d+)/)?.[1] ?? 0,
    );

    // Every page has its box, drawn or not.
    await expect(page.locator("[data-page]")).toHaveCount(total, {
      timeout: 30_000,
    });
    expect(await canvases(page)).toBeLessThanOrEqual(10);
  });

  test("keeps scrolling, the counter and the text of far pages", async ({
    page,
  }) => {
    await expect(page.locator("[data-page]").nth(299)).toBeAttached({
      timeout: 30_000,
    });

    await scrollToPage(page, 200);
    await expect(page.getByText(/Page 200 of \d+/)).toBeVisible();
    await expect(
      page.locator('[data-page="200"] .react-pdf__Page__canvas'),
    ).toBeVisible({ timeout: 15_000 });
    expect(await canvases(page)).toBeLessThanOrEqual(10);

    // A page far from the viewport has no canvas but keeps its text, so
    // find-in-page and selection still reach it.
    await expect(
      page.locator('[data-page="300"] .react-pdf__Page__canvas'),
    ).toHaveCount(0);
    await expect(
      page
        .locator('[data-page="300"] .react-pdf__Page__textContent span')
        .first(),
    ).toBeAttached({ timeout: 30_000 });
  });

  test("zooms every page's box, drawn or not", async ({ page }) => {
    await expect(page.locator("[data-page]").nth(299)).toBeAttached({
      timeout: 30_000,
    });
    const box = page.locator('[data-page="300"] > div');
    const before = (await box.boundingBox())?.width ?? 0;

    await page.getByRole("button", { name: "Zoom in" }).click();

    await expect
      .poll(async () => (await box.boundingBox())?.width ?? 0)
      .toBeGreaterThan(before);
    expect(await canvases(page)).toBeLessThanOrEqual(10);
  });

  test("counts the page in view after the fallback-fonts reload", async ({
    page,
  }) => {
    const boxes = page.locator("[data-page]");
    await expect(boxes.nth(299)).toBeAttached({ timeout: 30_000 });
    const total = await boxes.count();
    await scrollToPage(page, 2);
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();

    const drawn = await reloadWithFallbackFonts(page, 2);
    await expect(boxes).toHaveCount(total, { timeout: 30_000 });

    // A reader within the first screen does not move, and the counter says
    // so: its reset to 1 named page 1 under page 2. This checked only that
    // the two agreed, and passed when react-pdf 10.5 moved the reader to
    // page 1 as well.
    await expect.poll(() => pageInView(page)).toBe(2);
    await expect(page.getByText(/Page \d+ of \d+/)).toHaveText(/^Page 2 of /);
    expect(drawn).toBe(true);
  });

  test("keeps the reader's place through the fallback-fonts reload", async ({
    page,
  }) => {
    // The reload dropped every page box past the first screen until the
    // sizes were measured again: WebKit clamped a reader on page 200 to
    // page 1, and Chromium put them back once the boxes returned. With
    // react-pdf 10.5 unmounting every box for the reload, both browsers
    // clamped the reader to page 1 until the column held its size.
    const boxes = page.locator("[data-page]");
    await expect(boxes.nth(299)).toBeAttached({ timeout: 30_000 });
    const total = await boxes.count();
    await scrollToPage(page, 200);
    await expect(page.getByText(/Page 200 of \d+/)).toBeVisible();

    const drawn = await reloadWithFallbackFonts(page, 200);
    await expect(boxes).toHaveCount(total, { timeout: 30_000 });

    await expect.poll(() => pageInView(page)).toBe(200);
    await expect(page.getByText(/Page \d+ of \d+/)).toHaveText(/^Page 200 of /);
    expect(drawn).toBe(true);
  });

  test("keeps the page in view through a zoom", async ({ page }) => {
    // Every page box rescaled under the same scroll offset: zooming out on
    // page 100 showed page 115, in Chromium and WebKit alike.
    await expect(page.locator("[data-page]").nth(299)).toBeAttached({
      timeout: 30_000,
    });
    await scrollToPage(page, 100);
    await expect(page.getByText(/Page 100 of \d+/)).toBeVisible();

    // The toolbar's label, ahead of the pages in the document: the pages'
    // text has its own, "41%" in a table, once their text has loaded.
    const zoom = page.getByText(/^\d+%$/).first();
    for (const name of ["Zoom out", "Zoom in", "Zoom in"]) {
      const before = await zoom.textContent();
      await page.getByRole("button", { name }).click();
      await expect(zoom).not.toHaveText(before ?? "");
      await expect.poll(() => pageInView(page)).toBe(100);
      // And the counter says so, with no scroll event to tell it.
      await expect(page.getByText(/Page \d+ of \d+/)).toHaveText(
        /^Page 100 of /,
      );
    }
  });

  test("keeps the page in view when a resize fits the pages again", async ({
    page,
  }) => {
    // A narrower window fits the pages to it, which rescaled them the same
    // way: page 100 became page 170 here, from 1280 to 760 px wide.
    await expect(page.locator("[data-page]").nth(299)).toBeAttached({
      timeout: 30_000,
    });
    await scrollToPage(page, 100);
    await expect(page.getByText(/Page 100 of \d+/)).toBeVisible();

    const zoom = page.getByText(/^\d+%$/).first(); // the toolbar's, as above
    const before = await zoom.textContent();
    await page.setViewportSize({ width: 760, height: 900 });
    await expect(zoom).not.toHaveText(before ?? "");

    await expect.poll(() => pageInView(page)).toBe(100);
  });
});

// Chrome and Edge 111 to 125 and Safari 16.4 to 17.x, all in the site's
// browserslist, lack URL.parse or Promise.withResolvers, which pdf.js 5's
// default build calls without a polyfill: the reader loaded no PDF there
// ("Failed to load PDF"). It runs pdf.js's legacy build, which targets
// Chrome 110, Firefox ESR and Safari 16.4.
test.describe("PDF reader on a browser without URL.parse", () => {
  test("still draws the PDF", async ({ page }) => {
    await page.addInitScript(() => {
      delete (URL as unknown as { parse?: unknown }).parse;
      delete (Promise as unknown as { withResolvers?: unknown }).withResolvers;
    });
    await page.goto("/pdf/cv");

    await expect(page.locator(".react-pdf__Page__canvas").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Failed to load PDF/)).toHaveCount(0);
  });
});

test.describe("PDF reader when the PDF cannot be fetched", () => {
  test("says so once", async ({ page }) => {
    await page.route(/\/pdfs\/.*\.pdf/, (route) => route.abort());
    await page.goto("/pdf/cv");

    await expect(
      page.getByText("Failed to load PDF. Please try again later."),
    ).toBeVisible({ timeout: 15_000 });
    // react-pdf's own default message, under it, said the same again.
    await expect(page.getByText("Failed to load PDF file.")).toHaveCount(0);
  });
});

test.describe("PDF links from the keyboard", () => {
  test("come after the page's own controls, once each, web links named", async ({
    page,
    browserName,
  }) => {
    // pdf.js 5.3 put tabindex 1000 on each link's wrapper, and a positive
    // tabindex goes first: the CV's first 21 Tab presses walked those
    // wrappers, ahead even of the skip links. And no link had a name.
    // Without the cookie notice, which comes first in the page since
    // 2026-10-13 (and before which the skip link was not checked).
    await acknowledgeCookieNotice(page);
    await page.goto("/pdf/cv");
    const links = page.locator(".annotationLayer a[href]");
    await expect(links.first()).toBeAttached({ timeout: 30_000 });

    const unnamed = await links.evaluateAll(
      (all) =>
        all.filter(
          (link) =>
            /^(https?|mailto):/.test(link.getAttribute("href") ?? "") &&
            !link.getAttribute("aria-label"),
        ).length,
    );
    expect(unnamed).toBe(0);

    // macOS WebKit's Tab skips links (Alt+Tab reaches them).
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest(".annotationLayer"),
      ),
    ).toBe(false);
    await expect(
      page.getByRole("link", { name: "Skip to main content" }),
    ).toBeFocused();
  });
});

test.describe("PDF links within a document", () => {
  test("are named by the text printed under them", async ({ page }) => {
    // pdf.js draws each citation, cross-reference and contents entry as an
    // empty link: a screen reader read the GECCO paper's 33 as "link".
    await page.goto("/pdf/claret2026emr");
    const internal = page.locator('.annotationLayer a[href="#"]');
    await expect(internal).toHaveCount(33, { timeout: 30_000 });

    // A page's names come once its text and its links are both read.
    const names = () =>
      internal.evaluateAll((all) =>
        all.map((link) => link.getAttribute("aria-label")),
      );
    await expect
      .poll(async () => (await names()).filter((name) => !name).length, {
        timeout: 30_000,
      })
      .toBe(0);
    const named = await names();
    expect(named.filter((name) => name === "Reference 5")).toHaveLength(2);
    for (const name of ["Figure 1", "Section 3", "Table 2"]) {
      expect(named).toContain(name);
    }
    for (const name of named) {
      expect(name).toMatch(
        /^(Reference|Section|Figure|Table|Page|Theorem) \d+$/,
      );
    }
    // pdf.js 5.4 titles each link with the text under it ("5"): the names
    // replace those titles, read after the name and shown as tooltips.
    expect(
      await internal.evaluateAll(
        (all) => all.filter((link) => link.hasAttribute("title")).length,
      ),
    ).toBe(0);

    const results = await new AxeBuilder({ page })
      .include('[role="region"][aria-label="Pages"]')
      .withRules(["link-name"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

// /pdf/<slug> is the reader alone, and the reader loads in a chunk of its
// own. When that could not be fetched, React.lazy threw while rendering and
// the error page (error.tsx) replaced the reader with "Something went
// wrong", whose "Try Again" could not load it again. The page now says what
// failed and offers a retry, a reload and the PDF itself.
test.describe("PDF page whose reader chunk fails to load", () => {
  test("offers a retry and the PDF itself, and the retry loads the reader", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    let failing = true;
    let requests = 0;
    await context.route(/\/_next\/static\/chunks\//, async (route) => {
      const response = await route.fetch();
      // The reader's chunk, picked out by one of its labels.
      if ((await response.text()).includes("Copy link to this document")) {
        requests++;
        if (failing) return route.abort();
      }
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    await page.goto("/pdf/cv");

    // Its own try, as it mounted, has failed too.
    await expect(
      page.getByRole("button", { name: "Reload page" }),
    ).toBeVisible();
    await expect(page.getByText("Could not load the PDF reader")).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    expect(requests).toBe(2);
    await expect(
      page.getByRole("link", { name: "Open the PDF" }),
    ).toHaveAttribute("href", "/pdfs/CV_RomainClaret.pdf");

    // The connection is back.
    failing = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator(".react-pdf__Page__canvas").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Could not load the PDF reader")).toHaveCount(
      0,
    );
    // A chunk still being read when the context closes failed the test with
    // "Response has been disposed".
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  });
});

test.describe("The PDF reader over the homepage", () => {
  // It rendered inside its section, under the page's relative z-10, and the
  // cookie notice (z-50 at the page's root) painted over its bottom and
  // took its clicks: 73 px of a 1280 x 900 window, the bottom 205 px of a
  // 390 x 844 phone's, with "Got it!" and its links live over a modal.
  const noticeOnTop = (page: Page) =>
    page.evaluate(() => {
      const label = [...document.querySelectorAll("span")].find((span) =>
        span.textContent?.includes("Cookie Selection"),
      );
      const notice = label?.closest("div.fixed");
      if (!notice) throw new Error("No cookie notice to cover");
      const box = notice.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return notice.contains(hit);
    });

  async function openHomepage(page: Page) {
    await page.goto("/?playwright=true");
    await waitForSplashToEnd(page);
  }

  const PHONE = {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  };

  for (const [label, options] of [
    ["desktop", { viewport: { width: 1280, height: 900 } }],
    ["phone", PHONE],
  ] as const) {
    test(`opens above the cookie notice, ${label}`, async ({
      browser,
      browserName,
    }) => {
      test.skip(browserName === "firefox", "no isMobile in Firefox");
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await openHomepage(page);

      await page
        .getByRole("button", { name: /View Resume/ })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });

      expect(await noticeOnTop(page)).toBe(false);
      await context.close();
    });
  }

  test("its fallback opens above the cookie notice too", async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName === "firefox", "no isMobile in Firefox");
    const context = await browser.newContext(PHONE);
    await context.route(/\/_next\/static\/chunks\//, async (route) => {
      const response = await route.fetch();
      // The reader's chunk, picked out by one of its labels.
      if ((await response.text()).includes("Copy link to this document")) {
        return route.abort();
      }
      return route.fulfill({ response });
    });
    const page = await context.newPage();
    await openHomepage(page);

    await page
      .getByRole("button", { name: /View Resume/ })
      .first()
      .click();
    await expect(page.getByText("Could not load the PDF reader")).toBeVisible({
      timeout: 15_000,
    });

    expect(await noticeOnTop(page)).toBe(false);
    // As above: a chunk still being read failed the test at close.
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  });

  test("lets the keyboard reach a poster's page and scroll it", async ({
    page,
  }) => {
    // A poster has no links, so nothing inside its pages could take focus:
    // fitted to the width it is 1,630 px tall in a 632 px box, "Next page"
    // is disabled, and the keyboard could not scroll to the rest of it.
    await openHomepage(page);
    const read = page.getByRole("button", { name: /Read Poster/ }).first();
    await read.scrollIntoViewIfNeeded();
    await read.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog.locator(".react-pdf__Page__canvas").first(),
    ).toBeVisible({ timeout: 30_000 });

    const pages = dialog.getByRole("region", { name: "Pages" });
    let reached = false;
    for (let press = 0; press < 12 && !reached; press++) {
      await page.keyboard.press("Tab");
      reached = await pages
        .evaluate((element) => element === document.activeElement, null, {
          timeout: 1_000,
        })
        .catch(() => false);
    }
    expect(reached).toBe(true);

    const before = await pages.evaluate((element) => element.scrollTop);
    await page.keyboard.press("PageDown");
    await expect
      .poll(() => pages.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(before);
  });

  test("keeps Tab inside it, one stop per link", async ({ page }) => {
    // macOS WebKit's Tab skips buttons and links by default, so the trap,
    // which only wrapped at its first and last control, never ran: the
    // first Tab from the close button left the reader, and Shift+Tab walked
    // the page behind it. pdf.js 5.3 gave each link's wrapper tabindex
    // 1000: counted as stops, every link would be two.
    const where = () =>
      page.evaluate(() => {
        const focused = document.activeElement;
        if (!document.querySelector('[role="dialog"]')?.contains(focused)) {
          return `outside: ${focused?.tagName.toLowerCase()}`;
        }
        return focused?.matches(".annotationLayer section")
          ? "a link's wrapper"
          : "inside";
      });

    await openHomepage(page);
    await page
      .getByRole("button", { name: /View Resume/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect.poll(where).toBe("inside");
    // The résumé's links: its email, sites and profiles.
    await expect(
      dialog.locator(".annotationLayer a[href]").first(),
    ).toBeAttached({ timeout: 30_000 });

    // More presses than the reader has stops, so the cycle comes round.
    const close = page.getByRole("button", { name: "Close PDF viewer" });
    await close.focus();
    for (let press = 1; press <= 40; press++) {
      await page.keyboard.press("Tab");
      expect(await where(), `after Tab ${press}`).toBe("inside");
    }
    await close.focus();
    for (let press = 1; press <= 10; press++) {
      await page.keyboard.press("Shift+Tab");
      expect(await where(), `after Shift+Tab ${press}`).toBe("inside");
    }
  });
});
