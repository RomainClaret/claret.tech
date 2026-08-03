import { test, expect, type Page } from "@playwright/test";
import { dismissToasts } from "./utils/toast-utils";

/**
 * Open the mobile menu for accessibility checks and verify it opened.
 *
 * No retries, no force-clicks: if a plain click cannot open the menu, that
 * is a regression and the test must fail.
 */
async function openMobileMenuForAccessibility(page: Page): Promise<void> {
  // a missing or hidden menu button is a regression, not a reason to bail
  const menuButton = page.getByTestId("mobile-menu-button");
  await expect(menuButton).toBeVisible();

  if ((await menuButton.getAttribute("aria-expanded")) !== "true") {
    // toasts overlay the header on load and can swallow the click
    await dismissToasts(page, { timeout: 2000 });
    await menuButton.click();
  }

  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
}

test.describe("Mobile Accessibility", () => {
  // Only run these tests on mobile devices
  test.skip(({ isMobile }) => !isMobile, "These tests are mobile-only");

  test.beforeEach(async ({ page, isMobile }) => {
    await page.goto("/?playwright=true");

    if (isMobile) {
      // not stabilizeMobileViewport: its viewport-meta rewrite races Next's
      // metadata hydration, which then appends a second meta[name="viewport"]
      // and corrupts exactly what the viewport test below asserts on
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
    }
  });

  // no try/catch->skip in these tests: a thrown expect must fail the test

  test("should have accessible mobile menu button", async ({ page }) => {
    test.slow(); // Triple the timeout for mobile tests

    await dismissToasts(page, { timeout: 3000 });

    // Check mobile menu button exists and has proper ARIA attributes
    const menuButton = page.getByTestId("mobile-menu-button");
    await expect(menuButton).toBeVisible();

    // Check ARIA attributes
    await expect(menuButton).toHaveAttribute("aria-label", /.+/);
    await expect(menuButton).toHaveAttribute("aria-expanded", /^(true|false)$/);

    // Test menu can be opened
    await openMobileMenuForAccessibility(page);

    // Verify menu opened with proper ARIA state
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");

    // Check navigation links are now accessible
    const navLinks = await page.locator('nav a[href^="#"]:visible').count();
    expect(navLinks).toBeGreaterThan(2);
  });

  test("should have proper touch target sizes", async ({ page }) => {
    test.slow(); // Triple the timeout for mobile tests

    await dismissToasts(page, { timeout: 3000 });
    await openMobileMenuForAccessibility(page);

    // Check that interactive elements have minimum 44x44px touch targets
    const interactiveElements = await page
      .locator('button:visible, a:visible, [role="button"]:visible')
      .all();

    // Only check first 5 elements to avoid timeout
    const elementsToCheck = Math.min(interactiveElements.length, 5);

    for (let i = 0; i < elementsToCheck; i++) {
      const element = interactiveElements[i];
      const boundingBox = await element.boundingBox();

      // a visible interactive element with no box is not tappable at all
      expect(boundingBox).not.toBeNull();

      // Minimum touch target size should be 44x44px (iOS HIG recommendation)
      const minSize = 44;
      const describe = await element.evaluate(
        (el) =>
          `${el.tagName.toLowerCase()}[aria-label="${el.getAttribute("aria-label") ?? ""}"]`,
      );
      expect(
        boundingBox!.width >= minSize || boundingBox!.height >= minSize,
        `${describe} is ${boundingBox!.width}x${boundingBox!.height}px, below the ${minSize}px minimum`,
      ).toBeTruthy();
    }
  });

  test("should support mobile keyboard navigation", async ({ page }) => {
    test.slow(); // Triple the timeout for mobile tests

    await dismissToasts(page, { timeout: 3000 });

    // Test tab navigation through mobile menu
    const menuButton = page.getByTestId("mobile-menu-button");
    await expect(menuButton).toBeVisible();
    await menuButton.focus();

    // Check focus is visible
    const hasFocus = await menuButton.evaluate((el) => {
      return document.activeElement === el;
    });
    expect(hasFocus).toBe(true);

    // Open menu with keyboard (Enter or Space)
    await page.keyboard.press("Enter");

    // enter on the focused button must really open the menu; passing
    // silently when it stays closed hid a dead keyboard path
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");

    // Tab through navigation links
    await page.keyboard.press("Tab");

    // Check that focus moved to a navigation link
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName.toLowerCase();
    });
    expect(["a", "button"].includes(focusedElement || "")).toBe(true);
  });

  test("should have proper mobile viewport configuration", async ({ page }) => {
    test.slow(); // Triple the timeout for mobile tests

    await dismissToasts(page, { timeout: 3000 });

    // Check viewport meta tag exists and has proper configuration; the
    // strict locator is deliberate, the document must have exactly one
    const viewportMeta = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");

    expect(viewportMeta).toBeTruthy();
    expect(viewportMeta).toContain("width=device-width");
    expect(viewportMeta).toContain("initial-scale=1");

    // Check that content doesn't require horizontal scrolling
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    // Allow small differences due to scrollbars
    expect(bodyWidth - viewportWidth).toBeLessThan(20);
  });
});
