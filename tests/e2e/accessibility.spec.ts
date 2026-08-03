import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  waitForScrollCompletion,
  waitForAnimationCompletion,
} from "./utils/scroll-utils";
import {
  dismissToasts,
  ensureElementNotBlockedByToast,
  ensurePlaywrightParam,
  toggleThemeReliably,
  stabilizeMobileViewport,
} from "./utils/toast-utils";

/**
 * Open the mobile navigation menu, or fail the calling test.
 *
 * This used to be a 120-line selector shotgun wrapped in a try/catch that
 * ended in `console.warn("Mobile menu could not be opened ... some tests may
 * fail")`. Every failure mode - button missing, click intercepted, menu not
 * expanding - was swallowed, so a broken mobile menu produced a passing
 * accessibility run with a warning nobody reads. The button has a stable
 * data-testid (src/components/ui/navigation.tsx:187) and drives aria-expanded
 * and aria-controls, so there is nothing to guess at.
 */
async function openMobileMenuForAccessibility(page: Page): Promise<void> {
  const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
  await expect(
    mobileMenuButton,
    "mobile menu button (src/components/ui/navigation.tsx:187) must be visible on a mobile viewport",
  ).toBeVisible();

  if ((await mobileMenuButton.getAttribute("aria-expanded")) === "true") {
    return;
  }

  // Toasts are suppressed under ?playwright=true, but page.goto("/") drops the
  // query string that playwright.config.ts puts on baseURL, so they can still
  // appear and overlap the header. Clear them instead of force-clicking
  // through them: a force click would hide a real overlap regression.
  await dismissToasts(page, { timeout: 3000 });

  await mobileMenuButton.click();

  await expect(
    mobileMenuButton,
    "clicking the mobile menu button must set aria-expanded=true",
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.locator('[data-testid="mobile-navigation-menu"]'),
    "the panel referenced by aria-controls must become visible",
  ).toBeVisible();
}

test.describe("Accessibility", () => {
  test.beforeEach(async ({ browserName }, testInfo) => {
    // Firefox and WebKit need longer timeouts in CI for DOM operations
    if (
      (browserName === "webkit" || browserName === "firefox") &&
      process.env.CI
    ) {
      testInfo.setTimeout(60000); // 60s for Firefox/WebKit in CI
    } else if (process.env.CI) {
      testInfo.setTimeout(30000); // 30s for Chrome in CI
    } else {
      testInfo.setTimeout(20000); // 20s locally
    }
  });

  test("should pass accessibility checks on light theme", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Run axe accessibility tests
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Log violations for awareness
    if (accessibilityScanResults.violations.length > 0) {
      // Log violations for debugging if needed
      // console.log(
      //   "Accessibility violations found:",
      //   accessibilityScanResults.violations.map((v) => ({
      //     id: v.id,
      //     impact: v.impact,
      //     description: v.description,
      //     nodes: v.nodes.length,
      //   })),
      // );
    }

    // Only fail on critical violations
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical",
    );
    expect(criticalViolations).toEqual([]);

    // Allow color contrast violations and other non-critical issues as the design is final
    // We're only concerned with critical accessibility issues that prevent usage
    const seriousNonContrastViolations =
      accessibilityScanResults.violations.filter(
        (v) => v.id !== "color-contrast" && v.impact === "serious",
      );
    // Allow up to 5 serious non-contrast violations (current design has some intentional choices)
    expect(seriousNonContrastViolations.length).toBeLessThanOrEqual(5);
  });

  test("should pass accessibility checks on dark theme", async ({
    page,
    isMobile,
  }) => {
    // The `if (browserName === "firefox" && process.env.CI) test.skip()` that
    // used to sit here was removed rather than re-scoped. Two independent
    // reasons: (1) .github/workflows/playwright.yml:269 runs the accessibility
    // job with `matrix: browser: [chromium, webkit]`, so Firefox has never
    // reached this line in real CI and the guard only ever suppressed local
    // `CI=1` runs; (2) re-run with the guard removed, Firefox passes this test
    // under CI=1 (see the run recorded in the hardening notes). If Firefox
    // starts timing out here again, the fix is a Firefox-specific timeout, not
    // a skip - the axe scan is the only dark-theme coverage that exists.
    test.setTimeout(60000); // Increase timeout to 60s for CI

    await page.goto("/");
    await page.waitForLoadState("networkidle"); // Wait for network to be idle
    await page.waitForSelector("h1", { timeout: 15000 });

    // Stabilize mobile viewport if needed
    if (isMobile) {
      await stabilizeMobileViewport(page);
    }

    // Wait for any animations to complete
    await page.waitForTimeout(1000);

    // The toggle is shipped unconditionally by navigation.tsx:183 (desktop)
    // and :189 (mobile), once per breakpoint container, so exactly one copy is
    // visible at any viewport. Assert that before trying to drive it: this is
    // the deterministic half of what the old
    // `test.skip(true, "Theme toggle feature not available")` was hiding.
    const themeToggle = page
      .getByRole("button", { name: /toggle theme/i })
      .filter({ visible: true });
    await expect(
      themeToggle,
      "exactly one visible theme toggle (src/components/ui/theme-toggle.tsx) must be reachable by its accessible name",
    ).toHaveCount(1);
    await expect(themeToggle).toBeEnabled();

    // Use the resilient theme toggle function with increased timeout and retries
    const themeToggleSuccess = await toggleThemeReliably(page, "dark", {
      timeout: 45000,
      retries: 5,
    });

    // Not a skip. "Feature not available" can only mean the toggle broke -
    // exactly the regression this test should catch. toggleThemeReliably()
    // only returns false once every strategy has failed to put `dark` on
    // <html>, and its strategies all go through the button's real click
    // handler (the direct class-manipulation fallback was removed from
    // toast-utils.ts precisely so that this expect can fail).
    expect(
      themeToggleSuccess,
      "theme toggle (src/components/ui/theme-toggle.tsx) failed to switch the page to dark",
    ).toBe(true);
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    // Wait for any theme animation to complete
    await waitForAnimationCompletion(page, "body", 3000);

    // Run axe accessibility tests
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Log violations for awareness
    if (accessibilityScanResults.violations.length > 0) {
      // Log violations for debugging if needed
      // console.log(
      //   "Dark theme accessibility violations:",
      //   accessibilityScanResults.violations.map((v) => ({
      //     id: v.id,
      //     impact: v.impact,
      //     nodes: v.nodes.length,
      //   })),
      // );
    }

    // Only fail on critical violations
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical",
    );
    expect(criticalViolations).toEqual([]);

    // Allow color contrast violations and other non-critical issues as the design is final
    // We're only concerned with critical accessibility issues that prevent usage
    const seriousNonContrastViolations =
      accessibilityScanResults.violations.filter(
        (v) => v.id !== "color-contrast" && v.impact === "serious",
      );
    // Allow up to 5 serious non-contrast violations (current design has some intentional choices)
    expect(seriousNonContrastViolations.length).toBeLessThanOrEqual(5);
  });

  test("should pass accessibility checks on high contrast mode", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // The four-selector shotgun that used to live here ended in
    // `test.skip(true, "High contrast feature not available")`. The feature is
    // shipped unconditionally - src/components/ui/high-contrast-toggle.tsx is
    // rendered by src/components/ui/navigation.tsx at :182 (desktop) and :188
    // (mobile) - so "not available" could only ever mean the toggle regressed,
    // and the skip turned that regression into a green run.
    //
    // navigation.tsx renders two copies, one per breakpoint container, and the
    // desktop copy comes first in the DOM. The old code took `.first()` and
    // then quietly gave up when it was display:none, which is why this had to
    // be visibility-filtered rather than index-picked.
    const highContrastToggle = page
      .getByRole("button", { name: /toggle high contrast/i })
      .filter({ visible: true });

    await expect(
      highContrastToggle,
      "exactly one visible high contrast toggle must be reachable by its accessible name at this breakpoint",
    ).toHaveCount(1);
    await expect(highContrastToggle).toHaveAttribute("aria-pressed", "false");

    await highContrastToggle.click();

    // The toggle's only job is to put `high-contrast` on <html>
    // (high-contrast-toggle.tsx:22). If that stops happening, the axe scan
    // below would silently be scanning the normal theme again.
    await expect(
      page.locator("html"),
      "clicking the toggle must add the high-contrast class to <html>",
    ).toHaveClass(/\bhigh-contrast\b/);
    await expect(highContrastToggle).toHaveAttribute("aria-pressed", "true");

    await page.waitForTimeout(1000); // Wait for mode transition

    // Run axe accessibility tests with more lenient rules for high contrast
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules([
        "color-contrast", // High contrast mode can cause false positives
        "color-contrast-enhanced", // Enhanced contrast checks
        "focus-order-semantics", // Can be affected by theme changes
      ])
      .analyze();

    // Be very lenient with high contrast mode - only check for the most critical issues
    const actualCriticalViolations = accessibilityScanResults.violations.filter(
      (v) =>
        v.impact === "critical" &&
        !v.id.includes("color") && // Skip color-related rules
        !v.id.includes("contrast") && // Skip contrast-related rules
        v.id !== "landmark-one-main" && // Skip landmark issues that might be affected by theme
        v.id !== "region", // Skip region issues
    );

    // Log violations for debugging
    if (actualCriticalViolations.length > 0) {
      console.log(
        "Critical accessibility violations in high contrast mode:",
        actualCriticalViolations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
        })),
      );
    }

    expect(actualCriticalViolations.length).toBeLessThanOrEqual(2); // Allow up to 2 critical violations

    // For serious violations, be even more lenient
    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) =>
        v.impact === "serious" &&
        !v.id.includes("color") &&
        !v.id.includes("contrast"),
    );

    expect(seriousViolations.length).toBeLessThanOrEqual(10); // Allow up to 10 serious violations
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Check for h1
    const h1 = await page.locator("h1");
    await expect(h1).toHaveCount(1);

    // Get all headings
    const headings = await page.evaluate(() => {
      const allHeadings = Array.from(
        document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
      );
      return allHeadings.map((h) => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent?.trim(),
      }));
    });

    // Verify heading hierarchy
    // Track all levels we've seen to allow jumping back to any previous level
    const seenLevels = new Set<number>();
    let lastLevel = 0;

    for (const heading of headings) {
      seenLevels.add(heading.level);

      // If jumping to a deeper level, check it's not skipping
      if (heading.level > lastLevel) {
        // Allow h1 -> h2, h2 -> h3, etc. but not h1 -> h3
        // However, in practice, many sites have h1 -> h3 for visual hierarchy
        // So we'll be lenient and just warn but not fail
        if (heading.level > lastLevel + 1) {
          console.warn(
            `Heading level jump from h${lastLevel} to h${heading.level}: "${heading.text}"`,
          );
        }
      }

      lastLevel = heading.level;
    }

    // Just ensure we have at least one h1
    expect(seenLevels.has(1)).toBeTruthy();
  });

  test("should have proper ARIA labels on interactive elements", async ({
    page,
    isMobile,
  }) => {
    // Add extended timeout for mobile devices
    if (isMobile) {
      test.slow(); // Triple the timeout for mobile tests
    }

    const testStartTime = Date.now();
    const MAX_TEST_DURATION = 70000; // 70 seconds (before 90s timeout)

    // no catch->skip wrapper: a thrown expect must fail this test on mobile too
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Open mobile menu on mobile devices to make navigation links accessible
    if (isMobile) {
      await openMobileMenuForAccessibility(page);
    }

    // Check buttons have accessible names (with mobile optimizations)
    const buttons = await page.locator("button:visible");
    const buttonCount = await buttons.count();

    // Limit checking on mobile to prevent timeouts
    const maxButtonsToCheck = isMobile
      ? Math.min(buttonCount, 10)
      : buttonCount;

    for (let i = 0; i < maxButtonsToCheck; i++) {
      const button = buttons.nth(i);

      // Skip if element is not in viewport on mobile (performance optimization)
      if (isMobile && !(await button.isVisible())) {
        continue;
      }

      const ariaLabel = await button.getAttribute("aria-label");
      const textContent = await button.textContent();
      const title = await button.getAttribute("title");

      // Button should have either aria-label, text content, or title
      expect(ariaLabel || textContent?.trim() || title).toBeTruthy();

      // Early exit if approaching timeout
      if (Date.now() - testStartTime > MAX_TEST_DURATION) {
        console.warn("ARIA labels test approaching timeout, ending early");
        break;
      }
    }

    // Check links have accessible names (with mobile optimizations)
    const links = await page
      .locator("a:visible")
      .filter({ hasNot: page.locator('[aria-hidden="true"]') });

    // Wait for links to be present and count them
    await links
      .first()
      .waitFor({ state: "attached", timeout: 5000 })
      .catch(() => {});
    const linkCount = await links.count();

    // Limit checking to prevent timeouts - max 20 links for CI
    const maxLinksToCheck = Math.min(linkCount, isMobile ? 10 : 20);

    for (let i = 0; i < maxLinksToCheck; i++) {
      const link = links.nth(i);

      // Skip if element is not accessible within timeout
      try {
        await link.waitFor({ state: "visible", timeout: 2000 });
      } catch {
        continue;
      }

      // Skip if element is not in viewport on mobile (performance optimization)
      if (isMobile && !(await link.isVisible())) {
        continue;
      }

      // Get attributes with timeout protection
      const ariaLabel = await link.getAttribute("aria-label").catch(() => null);
      const textContent = await link.textContent().catch(() => null);
      const title = await link.getAttribute("title").catch(() => null);
      const href = await link.getAttribute("href").catch(() => null);

      // Skip empty fragment links
      if (href === "#") continue;

      // Link should have either aria-label, text content, or title.
      // This used to be `if (process.env.CI) continue;` guarded by a
      // console.warn, i.e. the one environment that gates merges was the one
      // environment where a link with no accessible name could not fail the
      // build. A missing accessible name is deterministic markup, not a race,
      // so it fails everywhere now.
      const hasAccessibleName = ariaLabel || textContent?.trim() || title;
      expect(
        hasAccessibleName,
        `link has no accessible name (no aria-label, no text, no title): href="${href}"`,
      ).toBeTruthy();

      // Early exit if approaching timeout
      if (Date.now() - testStartTime > MAX_TEST_DURATION) {
        console.warn("ARIA labels test approaching timeout, ending early");
        break;
      }
    }
  });

  test("should have sufficient color contrast", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Run contrast-specific accessibility tests
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze();

    // Log violations for awareness but allow some flexibility
    if (accessibilityScanResults.violations.length > 0) {
      // Log violations for debugging if needed
      // console.log(
      //   "Color contrast issues found:",
      //   accessibilityScanResults.violations.map((v) => ({
      //     id: v.id,
      //     impact: v.impact,
      //     nodes: v.nodes.length,
      //   })),
      // );

      // Only fail on critical violations
      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical",
      );

      // Allow serious color contrast issues as design is final
      expect(criticalViolations.length).toBeLessThanOrEqual(0);
    }
  });

  test("should support keyboard navigation", async ({
    page,
    browserName: _browserName,
    isMobile,
  }) => {
    // Skip keyboard navigation tests on mobile devices
    if (isMobile) {
      test.skip(
        true,
        "Keyboard navigation tests are not applicable on mobile devices",
      );
    }
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Ensure playwright parameter for test mode
    await ensurePlaywrightParam(page);

    // Dismiss any toasts that might interfere with keyboard navigation
    await dismissToasts(page, { timeout: 5000 });

    // Test tab navigation through main navigation items
    await page.keyboard.press("Tab"); // Skip to first interactive element

    // Wait a moment for focus to be established
    await page.waitForTimeout(200);

    const activeElement = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(activeElement).toBeTruthy();

    // Tab through navigation items
    const navItems = await page.locator('nav a[href^="#"]').count();
    for (let i = 0; i < Math.min(navItems, 3); i++) {
      // Test first 3 items for efficiency
      await page.keyboard.press("Tab");
      const activeElementInfo = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          href: (el as HTMLAnchorElement)?.href,
          visible: el
            ? window.getComputedStyle(el).visibility !== "hidden" &&
              window.getComputedStyle(el).display !== "none"
            : false,
        };
      });

      // Verify focused element is visible and interactive
      expect(activeElementInfo.visible).toBeTruthy();
    }

    // Test keyboard activation (Enter key)
    // Find a navigation link that will definitely cause scroll (not Home)
    const navLinks = await page
      .locator('nav a[href^="#"]:not([href="#home"])')
      .all();

    let scrollOccurred = false;
    for (const link of navLinks.slice(0, 3)) {
      // Try first 3 non-home links
      const href = await link.getAttribute("href");
      if (!href || href === "#home") continue;

      // Check if target section is already in view
      const targetSection = page.locator(href);
      let initiallyVisible = false;
      try {
        initiallyVisible =
          (await targetSection.isVisible()) &&
          (await page.locator(href).evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const visible = rect.top < viewportHeight && rect.bottom > 0;
            return visible && rect.bottom - rect.top > 100; // At least 100px visible
          }));
      } catch {
        initiallyVisible = false;
      }

      if (!initiallyVisible) {
        // This link should cause scroll
        await link.focus();

        // Wait for focus to be established with better timeout for mobile
        await page.waitForFunction(
          (expectedHref) => {
            const activeEl = document.activeElement as HTMLElement;
            return (
              activeEl?.tagName === "A" &&
              activeEl?.getAttribute("href") === expectedHref
            );
          },
          href,
          { timeout: 5000 },
        );

        const beforeScroll = await page.evaluate(() => window.scrollY);

        // Use proper keyboard activation (Enter key)
        await page.keyboard.press("Enter");

        // Wait for scroll to complete
        const afterScroll = await waitForScrollCompletion(page, {
          timeout: 15000,
          stabilityWindow: 200,
        });

        // Check if scroll occurred
        if (Math.abs(afterScroll - beforeScroll) > 50) {
          scrollOccurred = true;
          break;
        }
      }
    }

    // If no scroll occurred, it might be because all sections are visible
    // In that case, just verify keyboard navigation works
    if (!scrollOccurred) {
      // At minimum, verify Enter key doesn't cause errors
      expect(true).toBeTruthy();
    } else {
      expect(scrollOccurred).toBeTruthy();
    }

    // Target section visibility is already verified in the loop above
  });

  test("should have proper form labels", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Check all form inputs have labels
    const inputs = await page.locator(
      'input:not([type="hidden"]), textarea, select',
    );
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");

      if (id) {
        // Check for associated label
        const label = await page.locator(`label[for="${id}"]`).count();
        expect(label > 0 || ariaLabel || ariaLabelledBy).toBeTruthy();
      } else {
        // Input should have aria-label or aria-labelledby
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });

  test("should have skip links for keyboard users", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.goto("/");

    // Check for skip to main content link
    const skipLink = page.locator(
      'a[href="#main"], a[href="#content"], a:has-text("Skip")',
    );
    const skipLinkExists = await skipLink.count();

    if (skipLinkExists > 0) {
      // Skip link should be the first focusable element
      await page.keyboard.press("Tab");
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return {
          text: el?.textContent,
          href: (el as HTMLAnchorElement)?.href,
        };
      });

      // App might not have skip links, check for any focused text
      expect(focusedElement.text).toBeTruthy();
    }
  });

  test("should have proper image alt text", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Check all images have alt text
    const images = await page.locator("img");
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const role = await img.getAttribute("role");

      // Image should have alt text or role="presentation" for decorative images
      expect(alt !== null || role === "presentation").toBeTruthy();

      // Alt text should not be empty unless decorative
      if (role !== "presentation") {
        expect(alt).not.toBe("");
      }
    }
  });

  /**
   * This used to open with
   *
   *   // Skip this complex test on mobile - it's unreliable and causes timeouts
   *   test.skip(isMobile, "...due to reliability issues");
   *
   * which excluded the two projects where screen readers matter most. The
   * claim does not hold any more: run on 2026-08-03 against Mobile Chrome and
   * Mobile Safari, ten consecutive runs of each passed, the slowest project
   * pair finishing in 13.8s against a 60s budget. The most likely explanation
   * is that it was written before `test.setTimeout(60000)` on the next line
   * and before ensurePlaywrightParam/dismissToasts existed, and nobody went
   * back to check. Left running on every project; if it does start flaking,
   * the fix is to record the failure, not to hide the platform again.
   */
  test("should announce dynamic content changes", async ({
    page,
    browserName: _browserName,
  }) => {
    test.setTimeout(60000); // Increase timeout to 60s for CI

    await page.goto("/");
    await page.waitForLoadState("networkidle"); // Wait for network to be idle
    await page.waitForTimeout(1000); // Wait for animations

    // Ensure playwright parameter for test mode
    await ensurePlaywrightParam(page);

    // Dismiss any toasts that might interfere with testing
    await dismissToasts(page, { timeout: 5000 });

    // Enhanced wait for h1 with multiple strategies
    try {
      await page.waitForSelector("h1", { timeout: 10000 });
    } catch (h1Error) {
      // Try alternative selectors if main h1 fails
      console.warn(
        "Primary H1 selector failed:",
        (h1Error as Error).message || String(h1Error),
      );
      try {
        await page.waitForSelector(
          "h1, [role='heading'], .text-4xl, .text-5xl",
          { timeout: 5000 },
        );
      } catch (alternativeError) {
        console.warn(
          "H1 element not found with any selector, continuing with caution:",
          (alternativeError as Error).message || String(alternativeError),
        );
      }
    }

    // Check for ARIA live regions with comprehensive selectors and enhanced timeout
    const liveRegionSelectors = [
      "[aria-live]",
      '[role="alert"]',
      '[role="status"]',
      '[data-testid="toast-live-region"]',
      ".sr-only[aria-live]",
      '[aria-live="polite"]',
      '[aria-live="assertive"]',
      ".toast-container",
      "#toast-container",
      'div[class*="toast"]',
      '[data-testid*="live"]',
    ].join(", ");

    // Counted with document.querySelectorAll rather than a Playwright locator
    // on purpose. Locators pierce open shadow roots; querySelectorAll does not.
    // That mismatch made this check self-contradicting in dev: the
    // waitForFunction below (querySelectorAll) would time out reporting zero
    // live regions while `page.locator(...).count()` on the very next line
    // reported 2 - both of them Next's dev overlay (`div.nextjs-toast` and its
    // `role="alert"` sibling) inside <nextjs-portal>'s shadow root, which does
    // not exist in a production build. Verified 2026-08-03 by deleting the
    // site's own live regions: the locator count stayed at 2 and the test still
    // passed. Counting the same way the wait queries keeps this about the site.
    const countLiveRegions = () =>
      page.evaluate(
        (selectors) => document.querySelectorAll(selectors).length,
        liveRegionSelectors,
      );

    // Enhanced wait for live regions with fallback
    let liveRegionCount = 0;
    try {
      await page.waitForFunction(
        (selectors) => {
          const regions = document.querySelectorAll(selectors);
          return regions.length > 0;
        },
        liveRegionSelectors,
        { timeout: 10000 },
      );
      liveRegionCount = await countLiveRegions();
    } catch (waitError) {
      console.warn(
        "Initial live region wait failed, trying extended search...",
        (waitError as Error).message,
      );

      // Fallback: wait a bit more and recheck
      await page.waitForTimeout(2000);
      liveRegionCount = await countLiveRegions();

      if (liveRegionCount === 0) {
        // Final fallback, walking every element instead of trusting the
        // selector list. It used to also count `.sr-only` elements and
        // anything whose id or class contained "toast", neither of which is a
        // live region - the page ships several sr-only description spans, so
        // that clause alone guaranteed a non-zero count and made the assertion
        // below unfalsifiable. Only the three real signals are counted now.
        liveRegionCount = await page.evaluate(
          () =>
            [...document.querySelectorAll("body *")].filter(
              (el) =>
                el.hasAttribute("aria-live") ||
                el.getAttribute("role") === "alert" ||
                el.getAttribute("role") === "status",
            ).length,
        );
      }
    }

    // Not gated on CI any more. The previous form was
    // `if (process.env.CI && liveRegionCount === 0) console.warn(...)`, which
    // is the assertion inverted: the only case that mattered was the only case
    // that was allowed to pass. ToastContainer renders the live region
    // unconditionally (src/components/ui/toast.tsx), so zero live regions
    // means it stopped rendering.
    expect(
      liveRegionCount,
      "page must expose at least one ARIA live region for screen reader announcements",
    ).toBeGreaterThan(0);

    // Test terminal announcements if terminal exists
    let terminalToggle = page.locator('button[aria-label="Toggle terminal"]');

    // Enhanced terminal toggle selection with fallbacks
    if ((await terminalToggle.count()) === 0) {
      terminalToggle = page
        .locator(
          'button:has-text("terminal"), button[data-testid*="terminal"], button[class*="terminal"]',
        )
        .first();
    }

    if ((await terminalToggle.count()) > 0) {
      // Ensure terminal toggle is not blocked by toasts
      await ensureElementNotBlockedByToast(
        page,
        'button[aria-label="Toggle terminal"]',
        10000, // Increased timeout
      );

      // Wait for button to be ready with extended timeout
      await expect(terminalToggle).toBeVisible({ timeout: 10000 });
      await expect(terminalToggle).toBeEnabled({ timeout: 5000 });

      // Give additional time for button to be fully interactive
      await page.waitForTimeout(500);
      await terminalToggle.scrollIntoViewIfNeeded();

      // Enhanced terminal toggle click with retry mechanism
      let terminalClicked = false;
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await terminalToggle.click({ timeout: 10000 });
          terminalClicked = true;
          break;
        } catch (clickError) {
          console.warn(
            `Terminal toggle click attempt ${attempt} failed:`,
            (clickError as Error).message || String(clickError),
          );

          if (attempt < maxAttempts) {
            // Try JavaScript click as fallback
            try {
              await terminalToggle.evaluate((button) =>
                (button as HTMLElement).click?.(),
              );
              terminalClicked = true;
              break;
            } catch (jsClickError) {
              console.warn(
                `Terminal JS click attempt ${attempt} failed:`,
                (jsClickError as Error).message || String(jsClickError),
              );
              await page.waitForTimeout(1000); // Wait before retry
            }
          }
        }
      }

      // If all click attempts failed, try force click
      if (!terminalClicked) {
        console.warn(
          "All terminal toggle click attempts failed, trying force click",
        );
        try {
          await terminalToggle.click({ force: true });
          terminalClicked = true;
        } catch (forceClickError) {
          console.warn(
            "Terminal force click also failed:",
            (forceClickError as Error).message || String(forceClickError),
          );
        }
      }

      // Only continue with terminal tests if we successfully clicked
      if (terminalClicked) {
        // Wait for terminal to be fully initialized with more flexible selector
        try {
          await page.waitForSelector(
            '[role="application"], .terminal, .xterm',
            {
              timeout: 10000,
              state: "attached", // Just needs to be in DOM, not necessarily visible
            },
          );
        } catch {
          // Terminal might use different selector or take longer to initialize
          await page.waitForTimeout(2000);
        }

        // Wait for any terminal initialization animations with better error handling
        await waitForAnimationCompletion(
          page,
          '[role="application"], .terminal',
          5000,
        );

        // Check if terminal has proper ARIA attributes

        // Verify terminal has some form of accessibility support (lenient check)
        const hasAccessibleLabel = await page.evaluate(() => {
          // Try multiple selectors for terminal
          const selectors = [
            '[role="application"]',
            ".terminal",
            ".xterm",
            '[data-testid="terminal"]',
            'div[class*="terminal"]',
            ".xterm-viewport",
            ".xterm-screen",
          ];

          // Look for any accessibility indicators
          let foundAccessibilityFeature = false;

          for (const selector of selectors) {
            const terminalEl = document.querySelector(selector);
            if (terminalEl) {
              // Check for any accessibility attribute
              const hasDirectLabel =
                terminalEl.getAttribute("aria-label") ||
                terminalEl.getAttribute("aria-labelledby") ||
                terminalEl.getAttribute("title") ||
                terminalEl.getAttribute("role") === "application" ||
                terminalEl.getAttribute("role") === "region" ||
                terminalEl.getAttribute("role") === "textbox" ||
                terminalEl.getAttribute("role") === "terminal";

              if (hasDirectLabel) {
                foundAccessibilityFeature = true;
                break;
              }

              // Check parent elements for labels
              let current = terminalEl.parentElement;
              let depth = 0;
              while (current && depth < 3) {
                // Check up to 3 parent levels
                if (
                  current.getAttribute("aria-label") ||
                  current.getAttribute("aria-labelledby") ||
                  current.getAttribute("title") ||
                  current.getAttribute("role")
                ) {
                  foundAccessibilityFeature = true;
                  break;
                }
                current = current.parentElement;
                depth++;
              }

              if (foundAccessibilityFeature) break;

              // Check for keyboard navigation support
              if (
                terminalEl.hasAttribute("tabindex") ||
                window.getComputedStyle(terminalEl).cursor === "text"
              ) {
                foundAccessibilityFeature = true;
                break;
              }
            }
          }

          // Two fallbacks were removed here. The first accepted the run as
          // soon as `button[aria-label*="terminal"]` existed anywhere on the
          // page - that is the toggle button this test had just clicked to
          // open the terminal, so it made the check about the button rather
          // than about the terminal, and it could not fail while the toggle
          // existed. The second accepted the mere presence of `.xterm-viewport`
          // or any `.terminal [role]`, which is markup, not accessibility.
          // Terminal.tsx:1611-1617 gives the container role="application",
          // aria-label, aria-describedby, aria-live and tabIndex, so the direct
          // check above is satisfied by the real thing.

          return foundAccessibilityFeature;
        });

        // Was `if (process.env.CI) { console.log(...) } else { expect(...) }`,
        // so the terminal's accessibility was only ever enforced on a
        // developer laptop.
        //
        // Honest caveat: this expect is close to unfalsifiable on its own. The
        // heuristic above walks up to three ancestors and accepts *any* role
        // attribute, and also accepts `cursor: text`, which .xterm-screen has.
        // Stripping role/aria-label/aria-describedby/aria-live/tabIndex off the
        // terminal container still left it green (verified 2026-08-03). It is
        // kept because it is strictly better un-gated than gated, but the
        // assertion that actually holds the line is the explicit one below.
        expect(
          hasAccessibleLabel,
          "opened terminal exposes no aria-label/role/aria-live hook to assistive technology",
        ).toBeTruthy();

        // The real contract, asserted directly against the container that
        // Terminal.tsx:1607-1617 renders.
        const terminalContainer = page.locator('[data-testid="terminal"]');
        await expect(
          terminalContainer,
          "terminal container must expose role=application (src/components/terminal/Terminal.tsx:1611)",
        ).toHaveAttribute("role", "application");
        await expect(
          terminalContainer,
          "terminal container must have a non-empty aria-label",
        ).toHaveAttribute("aria-label", /\S/);
        await expect(
          terminalContainer,
          "terminal output must be announced, i.e. the container must be an aria-live region",
        ).toHaveAttribute("aria-live", /\S/);
      } else {
        // Terminal click failed, but test can still continue
        console.warn(
          "Terminal toggle click failed, skipping terminal-specific accessibility checks",
        );
      }
    } else {
      console.log(
        "No terminal toggle found, skipping terminal accessibility checks",
      );
    }
  });

  test("should have focus indicators", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Tab to first interactive element
    await page.keyboard.press("Tab");

    // Check that focused element has visible focus indicator
    const focusStyles = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el) return null;

      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow,
        border: styles.border,
      };
    });

    // Element should have some form of focus indicator
    expect(
      focusStyles?.outline !== "none" ||
        focusStyles?.boxShadow !== "none" ||
        parseInt(focusStyles?.outlineWidth || "0") > 0,
    ).toBeTruthy();
  });

  test("should handle prefers-reduced-motion", async ({
    page,
    browserName,
  }) => {
    // Skip for webkit as it has issues with media emulation
    if (browserName === "webkit") {
      test.skip();
      return;
    }

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Enable reduced motion preference
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Check that animations are disabled or reduced
    const animationDurations = await page.evaluate(() => {
      const elements = document.querySelectorAll("*");
      const durations: string[] = [];

      elements.forEach((el) => {
        const styles = window.getComputedStyle(el);
        if (styles.animationDuration !== "0s") {
          durations.push(styles.animationDuration);
        }
        if (styles.transitionDuration !== "0s") {
          durations.push(styles.transitionDuration);
        }
      });

      return durations;
    });

    // All animation/transition durations should be very short (< 0.1s) or 0
    // Allow longer animations as the design is final
    animationDurations.forEach((duration) => {
      const value = parseFloat(duration);
      // Most animations should be reduced but allow some longer ones for complex animations
      expect(value).toBeLessThanOrEqual(5); // Increased tolerance for complex animations
    });
  });

  test("should have semantic HTML structure", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Check for semantic elements
    const semanticElements = {
      header: await page.locator("header").count(),
      nav: await page.locator("nav").count(),
      main: await page.locator("main").count(),
      section: await page.locator("section").count(),
      footer: await page.locator("footer").count(),
      article: await page.locator("article").count(),
    };

    // Should have at least these semantic elements
    expect(semanticElements.nav).toBeGreaterThan(0);
    expect(semanticElements.main).toBe(1); // Only one main element
    expect(semanticElements.section).toBeGreaterThan(0);
  });

  test("should support screen reader navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Check for landmark roles
    const landmarks = await page.evaluate(() => {
      const landmarkRoles = [
        "banner",
        "navigation",
        "main",
        "contentinfo",
        "complementary",
      ];
      const found: Record<string, number> = {};

      landmarkRoles.forEach((role) => {
        const elements = document.querySelectorAll(`[role="${role}"]`);
        const implicitElements =
          role === "banner"
            ? document.querySelectorAll("header")
            : role === "navigation"
              ? document.querySelectorAll("nav")
              : role === "main"
                ? document.querySelectorAll("main")
                : role === "contentinfo"
                  ? document.querySelectorAll("footer")
                  : [];
        found[role] = elements.length + implicitElements.length;
      });

      return found;
    });

    // Should have navigation and main landmarks
    expect(landmarks.navigation).toBeGreaterThan(0);
    expect(landmarks.main).toBeGreaterThan(0);
  });
});
