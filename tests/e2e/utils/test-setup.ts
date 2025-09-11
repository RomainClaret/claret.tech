import { Page } from "@playwright/test";
import {
  setupLightweightBlocking,
  setupAggressiveBlocking,
} from "./resource-blocker";
import { dismissToasts, ensurePlaywrightParam } from "./toast-utils";

export interface TestSetupOptions {
  /**
   * Type of resource blocking to apply
   * - 'none': No resource blocking
   * - 'lightweight': Block only non-essential resources (fonts, analytics)
   * - 'aggressive': Block more resources including images (for speed-focused tests)
   */
  resourceBlocking?: "none" | "lightweight" | "aggressive";

  /**
   * Whether to dismiss toasts automatically
   */
  dismissToasts?: boolean;

  /**
   * Whether to ensure playwright parameter is set
   */
  ensurePlaywrightParam?: boolean;

  /**
   * Custom setup function to run after basic setup
   */
  customSetup?: (page: Page) => Promise<void>;
}

/**
 * Common test setup that can be used across different test suites
 * Applies performance optimizations and common configurations
 */
export async function setupTestEnvironment(
  page: Page,
  options: TestSetupOptions = {},
): Promise<void> {
  const {
    resourceBlocking = "lightweight",
    dismissToasts: shouldDismissToasts = true,
    ensurePlaywrightParam: shouldEnsurePlaywrightParam = true,
    customSetup,
  } = options;

  // Apply resource blocking for performance
  switch (resourceBlocking) {
    case "lightweight":
      await setupLightweightBlocking(page);
      break;
    case "aggressive":
      await setupAggressiveBlocking(page);
      break;
    case "none":
    default:
      // No resource blocking
      break;
  }

  // Ensure playwright parameter is set
  if (shouldEnsurePlaywrightParam) {
    await ensurePlaywrightParam(page);
  }

  // Navigate to home page
  await page.goto("/");

  // Wait for initial page load
  await page.waitForSelector("h1", { timeout: 10000 });

  // Dismiss any toasts that might interfere
  if (shouldDismissToasts) {
    await dismissToasts(page);
  }

  // Run custom setup if provided
  if (customSetup) {
    await customSetup(page);
  }
}

/**
 * Setup optimized for navigation tests
 */
export async function setupNavigationTest(page: Page): Promise<void> {
  await setupTestEnvironment(page, {
    resourceBlocking: "aggressive", // Maximum performance for navigation tests
    dismissToasts: true,
    ensurePlaywrightParam: true,
  });
}

/**
 * Setup optimized for accessibility tests
 */
export async function setupAccessibilityTest(page: Page): Promise<void> {
  await setupTestEnvironment(page, {
    resourceBlocking: "lightweight", // Keep some resources for accessibility checks
    dismissToasts: true,
    ensurePlaywrightParam: true,
  });
}

/**
 * Setup optimized for performance tests
 */
export async function setupPerformanceTest(page: Page): Promise<void> {
  await setupTestEnvironment(page, {
    resourceBlocking: "none", // No blocking for performance measurements
    dismissToasts: true,
    ensurePlaywrightParam: true,
  });
}

/**
 * Setup optimized for terminal tests
 */
export async function setupTerminalTest(page: Page): Promise<void> {
  await setupTestEnvironment(page, {
    resourceBlocking: "aggressive", // Maximum performance for terminal interaction
    dismissToasts: true,
    ensurePlaywrightParam: true,
  });
}

/**
 * Setup optimized for mobile tests
 */
export async function setupMobileTest(page: Page): Promise<void> {
  await setupTestEnvironment(page, {
    resourceBlocking: "lightweight", // Balanced approach for mobile
    dismissToasts: true,
    ensurePlaywrightParam: true,
  });
}
