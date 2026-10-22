import { expect, type Page } from "@playwright/test";

/**
 * Waits until the page is uncovered, whether the splash played or not.
 *
 * The splash's backdrop is in the HTML, and only the running app removes it:
 * when the splash shows, or when the page shows without it. On a slow load
 * the 4 s timer uncovers the page first and the splash skips itself
 * (app-wrapper.tsx), so a wait for its progress bar to show, then to go,
 * timed out there: navigation.spec's setup failed in 5 of 6 Linux WebKit
 * runs on a page that was up and readable. A count of 0 for the progress bar
 * alone passes before the splash mounts; the backdrop's cannot.
 *
 * The app removes the backdrop only once it has hydrated, which in Linux
 * WebKit at a GitHub runner's 4 CPUs took until about 15 s after the
 * navigation began, and once in some 260 loads past 25 s (2026-10-22): 15 s
 * from the load was too little. Hence 30.
 */
export async function waitForSplashToEnd(page: Page) {
  await expect(page.locator("[data-splash-backdrop]")).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("progressbar", { name: "Loading portfolio" }),
  ).toHaveCount(0, { timeout: 15_000 });
}
