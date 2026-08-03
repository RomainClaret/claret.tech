import { test, expect, type Page } from "@playwright/test";
import { dismissToasts } from "./utils/toast-utils";

/**
 * Open the mobile menu and verify it is actually open.
 *
 * No retries, no force-clicks, no DOM manipulation: if the menu cannot be
 * opened with a plain click, that is a regression and the test must fail.
 */
async function openMobileMenu(page: Page) {
  // toasts overlay the header on load and can swallow the first click
  await dismissToasts(page, { timeout: 2000 });

  // a missing or hidden menu button is a regression, not a reason to bail
  const menuButton = page.getByTestId("mobile-menu-button");
  await expect(menuButton).toBeVisible();

  if ((await menuButton.getAttribute("aria-expanded")) !== "true") {
    await menuButton.click();
  }

  // open means the button says so and the panel is really rendered
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("mobile-navigation-menu")).toBeVisible();
}

/**
 * Click a section link inside the open mobile menu and verify the app
 * responds: the menu closes and the section scrolls into view.
 */
async function expectMenuNavigation(page: Page, sectionId: string) {
  const menu = page.getByTestId("mobile-navigation-menu");

  // the link must exist inside the menu panel; the desktop nav links are
  // display:none on mobile and must not be the click target
  const link = menu.locator(`a[href="#${sectionId}"]`);
  await expect(link).toBeVisible();
  await link.click();

  // clicking a link closes the menu
  await expect(menu).toBeHidden();

  // nav clicks preventDefault() and scroll via scrollToSection(), so the
  // URL hash never changes; the observable contract is arriving on section
  await expect(page.locator(`#${sectionId}`)).toBeInViewport();
}

test.describe("Mobile Navigation", () => {
  // Only run these tests on mobile devices
  test.skip(({ isMobile }) => !isMobile, "These tests are mobile-only");

  test.beforeEach(async ({ page, isMobile }) => {
    // Include playwright parameter from the start
    await page.goto("/?playwright=true");

    // Stabilize mobile viewport if needed
    if (isMobile) {
      await page.waitForTimeout(2000);
    }
  });

  // no try/catch->skip in these tests: a thrown expect must fail the test

  test("should navigate to home section", async ({ page }) => {
    test.slow(); // Triple the timeout for mobile tests

    await openMobileMenu(page);
    await expectMenuNavigation(page, "home");
  });

  test("should navigate to skills section", async ({ page }) => {
    test.slow(); // Triple the timeout for mobile tests

    await openMobileMenu(page);
    await expectMenuNavigation(page, "skills");
  });

  test("should navigate to experience section", async ({ page }) => {
    test.slow(); // Triple the timeout for mobile tests

    await openMobileMenu(page);
    await expectMenuNavigation(page, "experience");
  });

  test("should open and close mobile menu", async ({ page }) => {
    test.slow(); // Triple the timeout for mobile tests

    await openMobileMenu(page);

    const menuButton = page.getByTestId("mobile-menu-button");
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");

    // Test menu closing
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("mobile-navigation-menu")).toBeHidden();
  });

  test("should have accessible mobile navigation", async ({ page }) => {
    test.slow(); // Triple the timeout for mobile tests

    await dismissToasts(page, { timeout: 3000 });

    // the button must exist with its ARIA contract; missing attributes are
    // a regression, not an environment condition
    const menuButton = page.getByTestId("mobile-menu-button");
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-label", /.+/);
    await expect(menuButton).toHaveAttribute("aria-expanded", /^(true|false)$/);
  });
});
