import { test, expect, type Page } from "@playwright/test";

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
});
