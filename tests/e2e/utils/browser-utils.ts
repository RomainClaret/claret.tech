import { Page, TestInfo } from "@playwright/test";

/**
 * Browser-specific timeout configurations
 */
export const BROWSER_TIMEOUTS = {
  chromium: {
    navigation: 30000,
    action: 15000,
    expect: 10000,
  },
  firefox: {
    navigation: 60000, // Firefox is typically slower
    action: 30000,
    expect: 15000,
  },
  webkit: {
    navigation: 40000,
    action: 20000,
    expect: 12000,
  },
} as const;

/**
 * Get the current browser name from test info
 */
export function getBrowserName(testInfo: TestInfo): string {
  return testInfo.project.name;
}

/**
 * Get browser-specific timeout for a given operation
 */
export function getBrowserTimeout(
  testInfo: TestInfo,
  operation: "navigation" | "action" | "expect",
): number {
  const browserName = getBrowserName(testInfo);
  const browserKey =
    (browserName as keyof typeof BROWSER_TIMEOUTS) || "chromium";
  const baseTimeout =
    BROWSER_TIMEOUTS[browserKey]?.[operation] ??
    BROWSER_TIMEOUTS.chromium[operation];

  // Increase timeouts in CI
  return process.env.CI ? Math.floor(baseTimeout * 1.5) : baseTimeout;
}

/**
 * Apply browser-specific optimizations for page navigation
 */
export async function optimizePageForBrowser(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const browserName = getBrowserName(testInfo);

  switch (browserName) {
    case "firefox":
      // Firefox-specific optimizations
      await page.addInitScript(() => {
        // Disable Firefox-specific features that might slow down tests
        Object.defineProperty(navigator, "webdriver", {
          value: false,
          writable: false,
        });
      });
      break;

    case "webkit":
      // Safari/WebKit-specific optimizations
      await page.addInitScript(() => {
        // Disable Safari-specific animations
        document.documentElement.style.setProperty(
          "--webkit-animation-duration",
          "0.01ms",
          "important",
        );
        document.documentElement.style.setProperty(
          "--webkit-transition-duration",
          "0.01ms",
          "important",
        );
      });
      break;

    case "chromium":
    default:
      // Chromium-specific optimizations
      await page.addInitScript(() => {
        // Disable Chrome-specific features for faster testing
        if ("serviceWorker" in navigator) {
          delete (navigator as unknown as { serviceWorker?: unknown })
            .serviceWorker;
        }
      });
      break;
  }
}

/**
 * Wait for page to be ready with browser-specific considerations
 */
export async function waitForPageReady(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const browserName = getBrowserName(testInfo);
  const timeout = getBrowserTimeout(testInfo, "navigation");

  // Basic readiness check
  await page.waitForLoadState("domcontentloaded", { timeout });

  // Browser-specific readiness checks
  switch (browserName) {
    case "firefox":
      // Firefox needs extra time for full rendering
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle", { timeout: timeout / 2 });
      break;

    case "webkit":
      // Safari needs time for layout stabilization
      await page.waitForFunction(() => document.readyState === "complete", {
        timeout,
      });
      await page.waitForTimeout(300);
      break;

    case "chromium":
    default:
      // Chromium is typically faster
      await page.waitForLoadState("load", { timeout });
      break;
  }
}

/**
 * Take a screenshot with browser-specific optimizations
 */
export async function takeOptimizedScreenshot(
  page: Page,
  testInfo: TestInfo,
  options: {
    fullPage?: boolean;
    path?: string;
  } = {},
): Promise<Buffer> {
  const browserName = getBrowserName(testInfo);

  // Wait for browser-specific rendering completion
  switch (browserName) {
    case "firefox":
      await page.waitForTimeout(100); // Firefox needs extra time
      break;
    case "webkit":
      try {
        await page.waitForFunction(() => {
          return document.fonts ? document.fonts.ready.then(() => true) : true;
        }); // Wait for fonts
      } catch {
        // Ignore font loading errors
      }
      break;
  }

  return page.screenshot({
    fullPage: options.fullPage ?? false,
    path: options.path,
    type: "png",
    // Browser-specific screenshot options
    ...(browserName === "webkit" && {
      // Safari-specific screenshot settings
      clip: undefined, // Remove clipping for Safari compatibility
    }),
  });
}

/**
 * Perform browser-specific cleanup
 */
export async function cleanupBrowserResources(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const browserName = getBrowserName(testInfo);

  try {
    // Browser-specific cleanup
    switch (browserName) {
      case "firefox":
        // Clear Firefox-specific caches
        await page.evaluate(() => {
          if ("caches" in window) {
            caches
              .keys()
              .then((names) => names.forEach((name) => caches.delete(name)));
          }
        });
        break;

      case "webkit":
        // Clear Safari-specific storage
        await page.evaluate(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch {
            // Ignore errors in cleanup
          }
        });
        break;

      case "chromium":
      default:
        // Standard cleanup
        await page.evaluate(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
            if ("indexedDB" in window) {
              // Clear IndexedDB if available
              indexedDB
                .databases?.()
                .then((dbs) =>
                  dbs.forEach((db) => indexedDB.deleteDatabase(db.name!)),
                );
            }
          } catch {
            // Ignore errors in cleanup
          }
        });
        break;
    }
  } catch (error) {
    // Ignore cleanup errors - they shouldn't fail tests
    console.warn(`Browser cleanup warning for ${browserName}:`, error);
  }
}
