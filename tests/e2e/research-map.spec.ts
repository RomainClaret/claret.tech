import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "./utils/fixtures";
import { acknowledgeCookieNotice } from "./utils/cookie-notice";
import { waitForSplashToEnd } from "./utils/splash";
import { runCommand, waitForTerminalReady } from "./utils/terminal-utils";

/**
 * The research map, opened from the terminal with `research`: a modal
 * dialog over the page, the terminal aside while it is open. Under reduced
 * motion, as the terminal's own spec runs.
 */

test.use({ reducedMotion: "reduce" });

async function openTerminal(page: Page) {
  await acknowledgeCookieNotice(page);
  await page.goto("/?playwright=true");
  await waitForSplashToEnd(page);
  await page.getByRole("button", { name: "Toggle terminal" }).first().click();
  await expect(page.getByTestId("terminal")).toBeVisible({ timeout: 30_000 });
  await waitForTerminalReady(page);
}

async function openMap(page: Page) {
  await openTerminal(page);
  await runCommand(page, "research", /Research map opened/);
  const map = page.getByRole("dialog", { name: "Research map" });
  await expect(map).toBeVisible({ timeout: 30_000 });
  return map;
}

const item = (page: Page, id: string) =>
  page
    .getByRole("group", { name: "Research map" })
    .locator(`[data-node="${id}"]`);
const focusedNode = (page: Page) =>
  page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset.node ?? null,
  );
const terminalHasFocus = (page: Page) =>
  page.evaluate(
    () =>
      document.activeElement?.classList.contains("xterm-helper-textarea") ??
      false,
  );

test.describe("The research map", () => {
  test("opens from the terminal, which steps aside", async ({ page }) => {
    const map = await openMap(page);

    // Above every dialog, the terminal would cover the map and take its
    // clicks.
    await expect(page.getByTestId("terminal")).toBeHidden();
    await expect(map).toBeFocused();
    await expect(item(page, "claret2026emr")).toBeVisible();
  });

  test("closes on Escape and gives the terminal back, focus in its input", async ({
    page,
  }) => {
    const map = await openMap(page);

    await page.keyboard.press("Escape");

    await expect(map).toHaveCount(0);
    await expect(page.getByTestId("terminal")).toBeVisible();
    await expect.poll(() => terminalHasFocus(page)).toBe(true);
  });

  test("closes from its close button too", async ({ page }) => {
    const map = await openMap(page);

    await page.getByRole("button", { name: "Close research map" }).click();

    await expect(map).toHaveCount(0);
    await expect(page.getByTestId("terminal")).toBeVisible();
    await expect.poll(() => terminalHasFocus(page)).toBe(true);
  });

  test("takes the keyboard from Tab to an item's details", async ({ page }) => {
    await openMap(page);

    // The map is one Tab stop, on the newest item.
    for (let presses = 0; presses < 25; presses++) {
      if (await focusedNode(page)) break;
      await page.keyboard.press("Tab");
    }
    expect(await focusedNode(page)).toBe("claret2026bio");

    await page.keyboard.press("ArrowLeft");
    expect(await focusedNode(page)).toBe("claret2026neuromodulation");
    await page.keyboard.press("Enter");

    const details = page.getByRole("complementary", { name: "Details" });
    await expect(
      details.getByRole("heading", {
        level: 3,
        name: /Multi-Behavioral Evolved Substrates/,
      }),
    ).toBeVisible();
    await expect(item(page, "claret2026neuromodulation")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("opens a paper in the reader over the map, and Tab stays in the reader", async ({
    page,
  }) => {
    const map = await openMap(page);
    await item(page, "claret2026emr").click();

    // In the map: the page's own paper cards, behind it, have one each.
    await map.getByRole("button", { name: "Read Paper" }).click();

    const reader = page.getByRole("dialog", { name: /^Tensor-Accelerated/ });
    await expect(reader).toBeVisible({ timeout: 30_000 });
    for (let presses = 0; presses < 6; presses++) {
      await page.keyboard.press("Tab");
      expect(
        await reader.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    // One Escape closes one layer: the reader, then the map.
    await page.keyboard.press("Escape");
    await expect(reader).toHaveCount(0);
    await expect(map).toBeVisible();
  });

  test("goes to an item's card with Show on page", async ({ page }) => {
    const map = await openMap(page);
    await item(page, "claret2026emr").click();

    await page.getByRole("button", { name: "Show on page" }).click();

    await expect(map).toHaveCount(0);
    await expect(page).toHaveURL(/#claret2026emr$/);
    await expect(page.locator("#claret2026emr")).toBeInViewport({
      timeout: 15_000,
    });
    // Back, but minimized, out of the card's way.
    await expect(
      page.getByRole("button", { name: "Restore terminal" }).first(),
    ).toBeVisible();
  });

  test("has no animation under reduced motion, and no backdrop filter", async ({
    page,
  }) => {
    const map = await openMap(page);

    expect(
      await map.evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
    const filtered = await page
      .getByTestId("research-map")
      .evaluate(
        (root) =>
          [root, ...root.querySelectorAll("*")].filter(
            (element) =>
              !["none", ""].includes(
                getComputedStyle(element).getPropertyValue("backdrop-filter"),
              ),
          ).length,
      );
    expect(filtered).toBe(0);
  });

  for (const [scheme, highContrast] of [
    ["light", false],
    ["dark", false],
    ["light", true],
  ] as const) {
    for (const view of ["Map", "List"] as const) {
      test(`reads at WCAG contrast: ${scheme}${highContrast ? " high contrast" : ""}, ${view.toLowerCase()}`, async ({
        page,
      }) => {
        await page.addInitScript(
          ([theme, contrast]) => {
            try {
              localStorage.setItem("theme", theme);
              localStorage.setItem("highContrast", String(contrast));
            } catch {
              // Storage blocked: the page's defaults, which the scan shows.
            }
          },
          [scheme, highContrast] as const,
        );
        await openMap(page);
        await page.getByRole("button", { name: view, exact: true }).click();
        if (view === "Map") {
          await item(page, "claret2026emr").click();
        } else {
          await page
            .getByRole("button", { name: "EMR-HyperNEAT Paper, July 2026" })
            .click();
        }

        const scan = await new AxeBuilder({ page })
          .include('[data-testid="research-map"]')
          .withRules(["color-contrast"])
          .analyze();
        expect(
          scan.violations.flatMap((violation) =>
            violation.nodes.map((node) => node.target.join(" ")),
          ),
        ).toEqual([]);
      });
    }
  }
});

test.describe("The research map on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("is a bottom sheet that starts in the list", async ({ page }) => {
    const map = await openMap(page);

    const box = await map.boundingBox();
    expect(box?.width).toBe(390);
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
    await expect(
      page.getByRole("button", { name: "List", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "EMR-HyperNEAT Paper, July 2026" }),
    ).toBeVisible();
  });
});
