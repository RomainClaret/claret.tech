/**
 * The navigation on desktop; mobile-navigation.spec.ts has the phone's menu.
 *
 * An audit on 2026-08-04 found that 9 of this file's 19 tests could not
 * fail, and this header listed them. Round 26 removed or rewrote every one:
 * each test left here fails when the behavior it names goes (its mutation
 * runs are in docs/performance.md).
 */
import { test, expect } from "./utils/fixtures";
import { acknowledgeCookieNotice } from "./utils/cookie-notice";
import { waitForSplashToEnd } from "./utils/splash";
import {
  ensureElementNotBlockedByToast,
  stabilizeMobileViewport,
} from "./utils/toast-utils";

const SECTIONS = [
  { id: "home", title: "Home", hasHeading: true },
  { id: "skills", title: "Skills", hasHeading: true },
  { id: "experience", title: "Experience", hasHeading: true },
  { id: "projects", title: "Projects", hasHeading: true },
  { id: "research", title: "Research", hasHeading: true },
  { id: "papers", title: "Papers", hasHeading: true },
  { id: "education", title: "Education", hasHeading: true },
  { id: "blogs", title: "Blog", hasHeading: true },
  { id: "contact", title: "Contact", hasHeading: true },
];

// CI-specific configurations optimized for Firefox compatibility
const isCI = !!process.env.CI;

// Removed ensureMobileMenuOpen - replaced with unconditional menu opening

test.describe("Navigation", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    // The notice is first in the page, and these tests start from the top:
    // the skip link's test, and the keyboard test's fourth Tab, met it.
    await acknowledgeCookieNotice(page);
    // Include playwright parameter from the start to avoid double navigation
    await page.goto("/?playwright=true");

    // Stabilize mobile viewport if needed
    if (isMobile) {
      await stabilizeMobileViewport(page);
    }

    // Dev server health check in CI
    if (isCI) {
      console.log(`🔍 [DEBUG] Testing dev server health at: ${page.url()}`);

      // Enable debug logging in the page context
      await page.evaluate(() => {
        (window as any).DEBUG_CI = true;
      });

      try {
        const response = await page.request.get("/");
        console.log(`📊 [DEBUG] Dev server response: ${response.status()}`);
        if (response.status() !== 200) {
          console.warn(
            `⚠️ [WARNING] Dev server returned status ${response.status()}`,
          );
        }
      } catch (error) {
        console.warn(`⚠️ [WARNING] Dev server health check failed:`, error);
      }
    }

    // Wait for the page to be ready
    await page.waitForLoadState("domcontentloaded");
    // And for the splash, which covers it, or skips itself on a slow load.
    await waitForSplashToEnd(page);
  });

  test("should display all navigation items", async ({ page, isMobile }) => {
    // On mobile, navigation items are hidden behind a menu
    if (isMobile) {
      // Open mobile menu first
      const mobileMenuButton = page
        .locator(
          '[data-testid="mobile-menu-button"], [aria-label*="menu" i], button:has(svg)',
        )
        .first();
      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();
        await page.waitForTimeout(500); // Wait for menu animation
      }
    }

    // Check navigation
    const navItems = page.locator("nav").first().locator('a[href^="#"]');
    const navCount = await navItems.count();

    // Should have at least 8 sections in navigation (contact might be a button)
    expect(navCount).toBeGreaterThanOrEqual(8);

    // Verify each section link exists (except contact which might be different)
    for (const section of SECTIONS.filter((s) => s.id !== "contact")) {
      const link = page.locator(`nav a[href="#${section.id}"]`).first();
      // On mobile, check if link exists rather than visibility (may be in closed menu)
      if (isMobile) {
        await expect(link).toHaveCount(1);
      } else {
        await expect(link).toBeVisible();
      }
    }
  });

  test("takes each section link to its section", async ({ page, isMobile }) => {
    // The tests before it, three per-section ones and this one, assumed
    // success after an error or scrolled to the section themselves before
    // checking that it was in view.
    test.skip(
      isMobile,
      "desktop links; mobile-navigation.spec.ts has the menu",
    );
    const nav = page.locator("#main-navigation");
    const address = page.url();

    for (const { id, title } of SECTIONS) {
      await nav.getByRole("link", { name: title, exact: true }).click();
      const section = page.locator(`#${id}`);
      await expect(section, id).toBeInViewport();
      // Focus follows, as after a native in-page link, and no hash is added.
      await expect(section, id).toBeFocused();
      expect(page.url(), id).toBe(address);
    }
  });

  test("should highlight active section in navigation", async ({
    page,
    isMobile,
  }) => {
    // It took "text-primary" anywhere in the class names as the highlight,
    // and every link carries "hover:text-primary", or any color but two
    // greys. Only the link of the section in view may have the class.
    test.skip(isMobile, "a phone keeps the links in its closed menu");
    const nav = page.locator("#main-navigation");
    const link = (title: string) =>
      nav.getByRole("link", { name: title, exact: true });
    const active = /(^|\s)text-primary(\s|$)/;

    for (const { id, title } of SECTIONS.slice(1, 4)) {
      await page.evaluate(
        (target) => document.getElementById(target)?.scrollIntoView(),
        id,
      );
      await expect(link(title), id).toHaveClass(active);
      for (const other of SECTIONS.filter((section) => section.id !== id)) {
        await expect(link(other.title), `${other.id} in ${id}`).not.toHaveClass(
          active,
        );
      }
    }
  });

  test("should have working skip navigation link", async ({
    page,
    isMobile,
    browserName,
  }) => {
    // A skip link is for a keyboard.
    test.skip(isMobile, "a phone has no Tab key");
    // From the keyboard, as it is meant (macOS WebKit's Tab skips links:
    // Alt+Tab reaches them). It shows only while focused: the test-mode CSS
    // used to keep it on screen, so a click on it passed.
    const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await page.keyboard.press(tab);
    await expect(skipLink).toBeFocused();
    expect((await skipLink.boundingBox())!.width).toBeGreaterThan(1);

    // It moves the keyboard past the navigation, into the content.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    await page.keyboard.press(tab);
    expect(
      await page.evaluate(() => !!document.activeElement?.closest("main")),
    ).toBe(true);
  });

  test("should have sticky navigation on scroll", async ({ page }) => {
    // It accepted a top within 50 px, which a nav scrolled away with the
    // page (about -500) missed only by luck, and "bg-" in the class names,
    // which the transparent nav has too.
    const nav = page.locator("#main-navigation");
    const solid = /(^|\s)backdrop-blur-md(\s|$)/;
    await expect(nav).toHaveCSS("position", "fixed");
    await expect(nav).toHaveClass(/(^|\s)bg-transparent(\s|$)/);
    await expect(nav).not.toHaveClass(solid);

    await page.evaluate(() => window.scrollTo(0, 500));

    await expect
      .poll(() =>
        nav.evaluate((element) => element.getBoundingClientRect().top),
      )
      .toBe(0);
    await expect(nav).toHaveClass(solid);
    await expect(nav).not.toHaveClass(/(^|\s)bg-transparent(\s|$)/);
  });

  test("should navigate back to top when clicking logo", async ({ page }) => {
    // The fixed navigation's logo, clicked from far down the page, takes
    // the reader back to the top. With the navigation un-fixed in test
    // mode, the helper's fallback scrolled the page up itself and a click
    // escalated to a script click, so this passed whatever the logo did.
    await page.evaluate(() =>
      window.scrollTo({ top: 1000, behavior: "instant" }),
    );
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(500);

    // On screen and on top where the navigation stays, without scrolling.
    await ensureElementNotBlockedByToast(page, 'nav a[href="#home"]');
    const box = (await page
      .locator('nav a[href="#home"]')
      .first()
      .boundingBox())!;
    // A click where it is: a locator click would scroll to it first.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 })
      .toBeLessThan(100);
  });

  test("should handle deep linking", async ({ page }) => {
    // When #projects was not in view, the test scrolled there itself and then
    // asserted that it was. A real load of the hash URL has to land it under
    // the 64 px nav, where the site's own scroll puts a section; the
    // browser's own jump would leave it at the top (no scroll-padding-top).
    // about:blank first: the same URL with a hash would only scroll.
    await page.goto("about:blank");
    await page.goto("/?playwright=true#projects");
    await waitForSplashToEnd(page);

    const projects = page.locator("#projects");
    await expect
      .poll(
        async () =>
          Math.abs(
            (await projects.evaluate(
              (element) => element.getBoundingClientRect().top,
            )) - 64,
          ) <= 4,
        { timeout: 15_000 },
      )
      .toBe(true);
  });
});
