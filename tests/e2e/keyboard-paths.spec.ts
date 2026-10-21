import { test, expect, type Locator, type Page } from "./utils/fixtures";
import { acknowledgeCookieNotice } from "./utils/cookie-notice";
import { waitForSplashToEnd } from "./utils/splash";

/**
 * Content a mouse reached and a keyboard did not, until round 14: the
 * research grid cards and the education thesis rows opened only on a click,
 * and the PhD highlights' explanations, the language levels and the
 * floating navigation's labels showed only on hover. Each is reached here
 * from the keyboard, in a browser, where :focus-visible and <details> apply
 * (the unit tests can only read the classes).
 */

// The element an id names; React's ids are not valid CSS selectors.
const byId = (page: Page, id: string | null) => {
  expect(id).toBeTruthy();
  return page.locator(`[id="${id}"]`);
};

// Focus from the keyboard: Tab from the element before, so the target
// matches :focus-visible whatever the browser decides for a script's focus.
// macOS WebKit's Tab skips buttons (Safari's default), Alt+Tab does not;
// Linux WebKit and the other engines take Tab.
async function tabTo(page: Page, before: Locator, browserName: string) {
  await before.focus();
  await page.keyboard.press(
    browserName === "webkit" && process.platform === "darwin"
      ? "Alt+Tab"
      : "Tab",
  );
}

test.describe("Keyboard paths", () => {
  test.beforeEach(async ({ page }) => {
    await acknowledgeCookieNotice(page);
    await page.goto("/");
    await waitForSplashToEnd(page);
  });

  test("opens a research card's details with Enter, and comes back", async ({
    page,
  }) => {
    // The cards grew in place; their details open above the page now.
    const button = page
      .locator("#research")
      .getByRole("button", { name: /^Read more about / })
      .first();
    const title = (await button.getAttribute("aria-label"))!.replace(
      "Read more about ",
      "",
    );
    await button.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test("opens a thesis with Enter", async ({ page }) => {
    const summary = page.locator("#education summary").first();
    await summary.focus();
    await expect(summary).toBeFocused();
    const bullets = summary.locator("xpath=following-sibling::*[1]");
    await expect(bullets).toBeHidden();

    await page.keyboard.press("Enter");

    await expect(summary.locator("xpath=..")).toHaveAttribute("open", "");
    await expect(bullets).toBeVisible();
  });

  test("shows a PhD highlight's explanation on focus", async ({ page }) => {
    const box = page.locator("#research [aria-describedby]").first();
    const explanation = byId(page, await box.getAttribute("aria-describedby"));
    await expect(explanation).toHaveCSS("opacity", "0");

    await box.focus();

    await expect(explanation).toHaveCSS("opacity", "1");
  });

  test("shows a language's level on focus", async ({ page }) => {
    const badge = page.locator("#skills [tabindex='0']", {
      hasText: "English",
    });
    await badge.focus();

    // The level shows as text, not only to a screen reader.
    await expect(
      badge.locator("span:not(.sr-only)", { hasText: "(Academic)" }),
    ).toBeVisible();
  });

  test("opens the skill card, and picks a skill from its list", async ({
    page,
    browserName,
  }) => {
    // The sentence and the list's rows were divs only a click reached.
    const tab = () =>
      page.keyboard.press(
        browserName === "webkit" && process.platform === "darwin"
          ? "Alt+Tab"
          : "Tab",
      );
    // Scoped: Projects has its own "List view" and "Show all projects".
    const skills = page.locator("#skills");
    const button = (name: string) =>
      skills.getByRole("button", { name, exact: true });
    const compactView = button("Compact view");

    // After the controls comes the sentence, which opens the card.
    await tabTo(page, button("Show all"), browserName);
    const sentence = skills.locator("button:focus");
    await expect(sentence).toHaveAccessibleDescription("Opens the card view");
    await page.keyboard.press("Enter");
    await expect(compactView).toBeFocused();

    // The card's List view, then the third skill's row.
    await tab();
    await expect(button("List view")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(button("Close list view")).toBeFocused();
    for (let row = 0; row < 3; row++) await tab();
    await page.keyboard.press("Enter");

    await expect(compactView).toBeFocused();
    await expect(skills.getByText(/^Skill 3 of \d+$/)).toBeAttached();
  });

  test("shows the floating navigation's labels on keyboard focus", async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      "Phones have no section rail (mobile-navigation.spec.ts)",
    );
    await page.evaluate(() => window.scrollTo(0, innerHeight * 2));
    const home = page.getByRole("button", { name: /^Home/ });
    await expect(home).toBeEnabled();

    await tabTo(page, home, browserName);

    await expect(
      page.getByRole("button", { name: "Scroll to previous section" }),
    ).toBeFocused();
    await expect(page.getByText("Previous", { exact: true })).toHaveCSS(
      "opacity",
      "1",
    );
  });

  test("takes a section link from the keyboard to its focused section", async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      "Phones keep the section links in the menu (mobile-navigation.spec.ts)",
    );
    // Two tests held this and could not fail: one ended in
    // `if (!scrollOccurred) expect(true)`, the other in `scrollY >= 0`. The
    // link scrolls to its section and moves focus there, as a native
    // in-page link does.
    const nav = page.locator("#main-navigation");
    await tabTo(
      page,
      nav.getByRole("link", { name: "Research", exact: true }),
      browserName,
    );
    await expect(
      nav.getByRole("link", { name: "Papers", exact: true }),
    ).toBeFocused();

    await page.keyboard.press("Enter");

    const papers = page.locator("#papers");
    await expect(papers).toBeInViewport();
    await expect(papers).toBeFocused();
  });
});
