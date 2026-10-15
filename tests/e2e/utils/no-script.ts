import { expect, type Page } from "@playwright/test";

/**
 * Opens `url` in a page whose scripts are off, and waits for what such a
 * page is made of: its HTML and its stylesheets, not its images.
 *
 * Without scripts a browser loads every image at once (`loading="lazy"`
 * needs scripting, per the HTML spec), so the load event waited for all 13
 * of the homepage's, which no test here looks at. In a CI rehearsal three
 * such tests timed out at 60 s on both tries: one image request never
 * finished, as Next's image optimizer can leave an image hanging for the
 * server's lifetime once a client drops a request for it
 * (docs/performance.md).
 *
 * The stylesheets must be in, or the checks that follow would read the
 * page without them. The splash's backdrop names its fallback animation
 * only in globals.css, so its computed animation name proves that one.
 */
export async function gotoWithoutScripts(page: Page, url = "/") {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const sheets = [
            ...document.querySelectorAll<HTMLLinkElement>(
              'link[rel="stylesheet"]',
            ),
          ];
          const backdrop = document.querySelector("[data-splash-backdrop]");
          return (
            sheets.length > 0 &&
            sheets.every((link) => link.sheet !== null) &&
            backdrop !== null &&
            getComputedStyle(backdrop).animationName ===
              "splash-backdrop-timeout"
          );
        }),
      { message: "the HTML's stylesheets, applied", timeout: 15_000 },
    )
    .toBe(true);
}
