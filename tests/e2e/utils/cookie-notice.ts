import type { BrowserContext, Page } from "@playwright/test";

/**
 * Starts the page with the cookie notice already acknowledged, for tests it
 * is not about. Since 2026-10-13 it is first in <body>, so it takes the
 * first Tab stops; it shows 1 s after load, so a test that tabbed or scanned
 * from the top met it or not by timing; and behind a modal's backdrop its
 * dimmed text failed the PDF reader's contrast scan.
 */
export const acknowledgeCookieNotice = (target: Page | BrowserContext) =>
  target.addInitScript(() => {
    try {
      localStorage.setItem("cookie-notice-acknowledged", "true");
    } catch {
      // Storage blocked: the notice shows, as it would for such a visitor.
    }
  });
