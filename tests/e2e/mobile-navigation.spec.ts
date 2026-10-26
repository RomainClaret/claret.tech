import { test, expect, type Locator, type Page } from "./utils/fixtures";
import { dismissToasts } from "./utils/toast-utils";
import { waitForSplashToEnd } from "./utils/splash";
import { runCommand, waitForTerminalReady } from "./utils/terminal-utils";
import { gotoWithoutScripts } from "./utils/no-script";

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
  // and focus moving there, as an in-page link's would: the link went away
  // with the menu, and focus fell to the body
  await expect(page.locator(`#${sectionId}`)).toBeFocused();
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

  // The section rail (floating-nav.tsx) is for screens with room for it:
  // on a phone its column, fixed at the right, covered the end of the
  // hero's View Resume and a strip of whatever was under it, and in
  // landscape most of the height. Phones scroll by touch, and the menu
  // lists the sections.
  test("leaves the section rail out, upright and turned", async ({ page }) => {
    const rail = page
      .locator("div.fixed.right-8")
      .filter({ has: page.locator('[aria-label="Scroll to next section"]') });

    // It mounts half a second after hydration: attached first, so that
    // hidden means hidden, not not there yet. Hydration first: in Mobile
    // Safari at a GitHub runner's 4 CPUs the page loaded at 15 s, the rail
    // came 8 to 11 s later, and under the whole phone job once more than
    // this wait's 15 s after the hook's 2 s (2026-10-22).
    await waitForSplashToEnd(page);
    await expect(rail).toBeAttached();
    await expect(rail).toBeHidden();

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(rail).toBeAttached();
    await expect(rail).toBeHidden();
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

    // It names the panel it opens. (The desktop navigation spec checked the
    // attribute with toBeDefined, which a missing one, null, passes.)
    const controls = await menuButton.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    await openMobileMenu(page);
    await expect(page.locator(`[id="${controls}"]`)).toBeVisible();
  });

  // The terminal opens on a phone too, over most of the screen. xterm 6 has
  // no touch scrolling of its own: a swipe over it scrolled the page behind
  // it, 200 to 1,500 px, and the scrollback was out of reach (2026-10-26).
  test("scrolls the terminal under a finger, never the page behind it", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "a test can swipe a finger (CDP's synthesized gesture) in Chromium only",
    );
    test.slow();
    await waitForSplashToEnd(page);
    await dismissToasts(page, { timeout: 3000 });
    await page.getByRole("button", { name: "Toggle terminal" }).first().tap();
    const terminal = page.getByTestId("terminal");
    await expect(terminal).toBeVisible();
    await waitForTerminalReady(page);
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight / 2),
    );
    const pageY = () => page.evaluate(() => Math.round(window.scrollY));
    const start = await pageY();
    expect(start, "the page can scroll either way").toBeGreaterThan(0);

    const output = terminal.locator('[aria-label="Terminal output"]');
    const topRow = () =>
      output.locator(".xterm-rows > div").first().textContent();
    // A finger put down, moved in ten steps, lifted: raw touch points.
    // CDP's synthesized scroll gesture moved nothing in CI's Linux Chromium,
    // not even the page, where these do. A finger moving down (yDistance
    // above 0) shows what is above.
    const cdp = await page.context().newCDPSession(page);
    const drag = async (x: number, y: number, yDistance: number) => {
      const at = (dy: number) => [
        { x: Math.round(x), y: Math.round(y + dy), id: 1 },
      ];
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: at(0),
      });
      for (let step = 1; step <= 10; step++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: at((yDistance * step) / 10),
        });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    };
    const swipe = async (target: Locator, yDistance: number) => {
      const box = (await target.boundingBox())!;
      await drag(box.x + box.width / 2, box.y + box.height / 2, yDistance);
      // The page would have moved with the finger, which has lifted.
      await page.waitForTimeout(300);
      expect(await pageY(), `the page moved on a swipe of ${yDistance}`).toBe(
        start,
      );
    };

    // No scrollback yet, then the title bar.
    await swipe(output, -250);
    await swipe(output, 250);
    await swipe(terminal.getByTestId("terminal-header"), 200);

    // With scrollback (help prints 37 lines into the window), the finger
    // moves the lines, and past both ends the page still stays put.
    await runCommand(page, "help", /Use Ctrl\+C to cancel current input/);
    const atEnd = await topRow();
    await swipe(output, 250);
    await expect.poll(topRow).not.toBe(atEnd);
    for (let swipes = 0; swipes < 6; swipes++) await swipe(output, 250);
    for (let swipes = 0; swipes < 6; swipes++) await swipe(output, -250);
    await expect.poll(topRow).toBe(atEnd);

    // Below the window, a finger still scrolls the page.
    const box = (await terminal.boundingBox())!;
    const viewport = page.viewportSize()!;
    const below = Math.min(viewport.height - 10, box.y + box.height + 30);
    await drag(viewport.width / 2, below, -250);
    await expect.poll(pageY).toBeGreaterThan(start);
  });
});

// The training and memberships badges stacked 15 cards, 1,038 px on a 390 px
// wide phone (2026-10-26): a phone shows the newest few of each, then
// "Show all".
test.describe("The badges on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "These tests are mobile-only");

  const badgesOf = async (page: Page, button: Locator) =>
    page.locator(`[id="${await button.getAttribute("aria-controls")}"] > div`);
  // The button by the list it opens: its name changes on a tap, and a
  // locator by the old name then finds nothing.
  const byList = async (page: Page, button: Locator) =>
    page.locator(
      `button[aria-controls="${await button.getAttribute("aria-controls")}"]`,
    );

  test("shows the newest few, and all of them on a tap", async ({ page }) => {
    test.slow();
    await page.goto("/?playwright=true");
    await waitForSplashToEnd(page);
    await dismissToasts(page, { timeout: 3000 });
    const education = page.locator("#education");
    const training = education.getByRole("button", {
      name: "Show all 7 certifications",
    });
    const memberships = education.getByRole("button", {
      name: "Show all 8 memberships",
    });
    const trainingBadges = await badgesOf(page, training);
    await expect(trainingBadges.filter({ visible: true })).toHaveCount(3);
    await expect(
      (await badgesOf(page, memberships)).filter({ visible: true }),
    ).toHaveCount(4);
    // Newest first, though the HTML lists them oldest first.
    const top = async (name: string) =>
      (await trainingBadges.filter({ hasText: name }).boundingBox())!.y;
    expect(await top("Summer/Winter Schools")).toBeLessThan(
      await top("Surviving a Ph.D."),
    );

    const toggle = await byList(page, training);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Centered first: scrolled just into view, the fixed header covers it.
    await toggle.evaluate((button) =>
      button.scrollIntoView({ block: "center" }),
    );
    await toggle.click();
    await expect(trainingBadges.filter({ visible: true })).toHaveCount(7);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAccessibleName("Show fewer certifications");
  });

  test.describe("without scripts", () => {
    test.use({ javaScriptEnabled: false });

    test("shows every badge, and no button", async ({ page }) => {
      // layout.tsx's <noscript> style shows what a phone folds.
      await gotoWithoutScripts(page, "/?playwright=true");
      const badges = page.locator("#education [style*='--rank']");
      await expect(badges).toHaveCount(15);
      await expect(badges.filter({ visible: true })).toHaveCount(15);
      await expect(
        page.locator("#education").getByRole("button", { name: /^Show all/ }),
      ).toHaveCount(0);
    });
  });
});
