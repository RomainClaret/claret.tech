import {
  test,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from "./utils/fixtures";
import AxeBuilder from "@axe-core/playwright";
import { waitForSplashToEnd } from "./utils/splash";

/**
 * A GitHub card's details open in one dialog above the page.
 *
 * They opened in a panel inside the card's grid item: the card grew with
 * blank space, the panel painted under the next row's card, its links'
 * clicks reached that card, and a pulsing ring sat off-centre on its dot.
 * Keyboard users could not open a card at all.
 *
 * In CI the section has no data (public/profile.json is not committed and
 * the build has no GitHub token), so both APIs are answered here.
 */

const repo = (
  id: string,
  name: string,
  description: string | null,
  stars: number,
  language: { name: string; color: string } | null,
) => ({
  id,
  name,
  description,
  forkCount: 3,
  stargazers: { totalCount: stars },
  url: `https://github.com/user/${name}`,
  diskUsage: 2048,
  primaryLanguage: language,
});

const TS = { name: "TypeScript", color: "#3178c6" };
const LONG_NAME = "NeuroevolutionOfAugmentingTopologiesReimplementation";
const HYPHENATED = "es-hyperneat-optimization-studies";
const LONG_DESCRIPTION =
  "A description that runs well past the lines a card shows: it covers the " +
  "search over hyperparameters, the pruners that stop a run early from its " +
  "fitness curve, the partitions of the substrate, and the plots that go " +
  "with each, so the clamp has text to hide at every width the grid uses.";
const PINNED = [
  repo("R_flag", "flagship", "The most starred.", 500, {
    name: "Python",
    color: "#3572A5",
  }),
  repo("R_neat", "neat-tool", "Evolves small networks on a laptop.", 42, TS),
  repo("R_bare", "archived-notes", null, 1, null),
  repo("R_long", LONG_NAME, "A name with no place to break.", 7, TS),
  // The grid leaves out flagship, the spotlight, so its cards run from
  // neat-tool (0) to filler-one (5): a card sits under neat-tool's, where
  // the old panel slid underneath, and cards 4 and 5 share a row with 2
  // columns (390 and 800 px) and with 3 (1280 px): a title that wraps to
  // several lines next to a description longer than its clamp.
  repo("R_two", "filler-two", "And another.", 4, TS),
  repo("R_hyph", HYPHENATED, "Search, pruners and partitions.", 6, TS),
  repo("R_one", "filler-one", LONG_DESCRIPTION, 5, TS),
];

/** The All view's record: pinned data plus what only that API returns. */
const full = (pinned: (typeof PINNED)[number], extra: object = {}) => ({
  ...pinned,
  stargazerCount: pinned.stargazers.totalCount,
  homepageUrl: null,
  languages: { edges: [] },
  topics: { edges: [] },
  createdAt: "2023-01-10T00:00:00Z",
  updatedAt: "2024-03-01T00:00:00Z",
  pushedAt: "2024-03-05T00:00:00Z",
  isPrivate: false,
  isArchived: false,
  isFork: false,
  parent: null,
  ...extra,
});
const topics = (...names: string[]) => ({
  edges: names.map((name) => ({ node: { topic: { name } } })),
});
const ALL = [
  full(PINNED[0]),
  full(PINNED[1], {
    homepageUrl: "https://demo.example/neat",
    topics: topics("neuroevolution", "jax"),
    languages: {
      edges: [
        { node: TS, size: 800 },
        { node: { name: "CSS", color: "#563d7c" }, size: 200 },
      ],
    },
  }),
  // archived-notes is pinned only: what a pinned repository shows alone.
  full(PINNED[3], {
    topics: topics("averyveryverylongtopicnamewithoutanybreakpoint"),
  }),
];

async function answerData(context: BrowserContext) {
  await context.route("**/api/fetch-github", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { pinnedItems: { edges: PINNED.map((node) => ({ node })) } },
      },
    }),
  );
  await context.route("**/api/fetch-all-repos", (route) =>
    route.fulfill({ json: { success: true, data: ALL } }),
  );
  for (const site of ["https://github.com/**", "https://demo.example/**"]) {
    await context.route(site, (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>stub</title>" }),
    );
  }
}

async function openSite(page: Page, { acceptCookies = true } = {}) {
  await answerData(page.context());
  await page.goto("/?playwright=true");
  await waitForSplashToEnd(page);
  if (acceptCookies) {
    await page.getByRole("button", { name: "Accept cookie notice" }).click();
  }
}

const cardButton = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
/** The card, found by its heading, which the old cards had too. */
const card = (page: Page, name: string) =>
  page
    .locator(".group\\/card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });

/** The element under the centre of `locator` is it, or inside it. */
const winsHitTest = (locator: Locator) =>
  locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    return !!hit && element.contains(hit);
  });

const sidewaysOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

const focusedName = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return active?.getAttribute("aria-label") ?? active?.innerText.trim() ?? "";
  });

test.describe("A GitHub card's details", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("open in one dialog above the page, and the card keeps its size", async ({
    page,
  }) => {
    await openSite(page);
    const theCard = card(page, "neat-tool");
    await theCard.scrollIntoViewIfNeeded();
    const before = await theCard.evaluate(
      (element) => (element as HTMLElement).offsetHeight,
    );

    await theCard.getByText("Evolves small networks on a laptop.").click();
    await page.waitForTimeout(500); // the old panel faded in

    // The panel grew the card with blank space, and HolographicCard put a
    // pulsing ring off-centre on a dot in its corner.
    const after = await theCard.evaluate(
      (element) => (element as HTMLElement).offsetHeight,
    );
    expect.soft(Math.abs(after - before)).toBeLessThanOrEqual(1);
    await expect
      .soft(page.locator("#projects .absolute.top-2.right-2.z-20"))
      .toHaveCount(0);

    // The panel painted under the next card, which took its links'
    // clicks: the details' GitHub link must be the element under its own
    // centre, wherever the details are.
    const github = page.locator('a[href="https://github.com/user/neat-tool"]');
    await expect.soft(github).toHaveCount(1);
    if ((await github.count()) === 1) {
      await github.scrollIntoViewIfNeeded();
      expect.soft(await winsHitTest(github)).toBe(true);
    }

    await expect(page.getByRole("dialog")).toHaveCount(1);
    const dialog = page.getByRole("dialog", { name: "neat-tool" });
    expect(
      await dialog.evaluate((element) => !!element.closest("#projects")),
    ).toBe(false);
    for (const control of [
      dialog.getByRole("button", { name: "Close details" }),
      dialog.getByRole("link", { name: /View on GitHub/ }),
      dialog.getByRole("link", { name: /Live Demo/ }),
    ]) {
      expect.soft(await winsHitTest(control)).toBe(true);
    }
    expect.soft(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("follow both links, and stay open", async ({ page, context }) => {
    await openSite(page);
    await cardButton(page, "neat-tool").click();
    const dialog = page.getByRole("dialog", { name: "neat-tool" });

    for (const [name, url] of [
      [/View on GitHub/, "https://github.com/user/neat-tool"],
      [/Live Demo/, "https://demo.example/neat"],
    ] as const) {
      const opened = context.waitForEvent("page");
      await dialog.getByRole("link", { name }).click();
      const tab = await opened;
      await tab.waitForLoadState();
      expect(tab.url()).toBe(url);
      await tab.close();
      await expect(dialog).toBeVisible();
    }
  });

  test("open and close from the keyboard, with Tab kept inside", async ({
    page,
  }) => {
    await openSite(page);
    const button = cardButton(page, "neat-tool");
    await button.focus();

    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "neat-tool" });
    await expect(dialog).toBeFocused();

    // Plain Tab, links included: WebKit's own Tab skips links.
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      order.push(await focusedName(page));
    }
    expect(order).toEqual([
      "Close details",
      "View on GitHub",
      "Live Demo",
      "Close details",
    ]);
    await page.keyboard.press("Shift+Tab");
    expect(await focusedName(page)).toBe("Live Demo");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();

    await page.keyboard.press("Space");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close details" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();

    await button.click();
    await page
      .getByTestId("project-details-backdrop")
      .click({ position: { x: 8, y: 8 } });
    await expect(dialog).toHaveCount(0);
  });

  test("show no empty block for a repository with little data", async ({
    page,
  }) => {
    await openSite(page);
    await cardButton(page, "archived-notes").click();
    const dialog = page.getByRole("dialog", { name: "archived-notes" });

    for (const name of ["Topics", "Languages", "Activity"]) {
      await expect(dialog.getByRole("heading", { name })).toHaveCount(0);
    }
    await expect(dialog.getByRole("link", { name: /Live Demo/ })).toHaveCount(
      0,
    );
  });

  test("pass the accessibility rules, closed and open", async ({ page }) => {
    await openSite(page);
    await card(page, "neat-tool").scrollIntoViewIfNeeded();
    const cards = await new AxeBuilder({ page })
      .include("#projects")
      .withRules([
        "nested-interactive",
        "button-name",
        "aria-allowed-attr",
        "aria-valid-attr-value",
      ])
      .analyze();
    expect(cards.violations).toEqual([]);

    await cardButton(page, "neat-tool").click();
    const dialog = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withRules([
        "aria-dialog-name",
        "scrollable-region-focusable",
        "link-name",
        "button-name",
        "nested-interactive",
      ])
      .analyze();
    expect(dialog.violations).toEqual([]);
  });

  test("open when framer's chunk failed", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await context.route(/\/_next\/static\/chunks\//, async (route) => {
      const response = await route.fetch();
      if ((await response.text()).includes("inView:{Feature")) {
        return route.abort();
      }
      return route.fulfill({ response });
    });
    const page = await context.newPage();
    await openSite(page);

    await cardButton(page, "neat-tool").click();

    await expect(page.getByRole("dialog", { name: "neat-tool" })).toBeVisible();
    // A chunk still being read when the context closes fails the test with
    // "Response has been disposed".
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
  });
});

test.describe("A GitHub card's details on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });

  test("open as a sheet above the cookie notice", async ({ page }) => {
    await openSite(page, { acceptCookies: false });
    const theCard = card(page, "neat-tool");
    await theCard.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );

    await theCard.getByText("Evolves small networks on a laptop.").tap();
    const dialog = page.getByRole("dialog", { name: "neat-tool" });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) =>
      Promise.all(element.getAnimations().map((a) => a.finished)),
    );

    const box = (await dialog.boundingBox())!;
    const width = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(Math.abs(box.y + box.height - 844)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.width - width)).toBeLessThanOrEqual(1);

    // The cookie notice (z-50 at the page's root) covers the same strip,
    // and the sheet's link still takes the tap.
    const link = dialog.getByRole("link", { name: /View on GitHub/ });
    const notice = page
      .getByText("Cookie Selection:")
      .locator("xpath=ancestor::div[contains(@class, 'fixed')][1]");
    const [a, b] = [(await link.boundingBox())!, (await notice.boundingBox())!];
    expect(a.y < b.y + b.height && b.y < a.y + a.height).toBe(true);
    expect(await winsHitTest(link)).toBe(true);
  });

  test("leave nothing wider than the screen with a long name", async ({
    page,
  }) => {
    await openSite(page);
    // The description: the name runs out of the card, unbroken.
    await card(page, LONG_NAME)
      .getByText("A name with no place to break.")
      .tap();
    await expect(page.getByRole("dialog", { name: LONG_NAME })).toBeVisible();

    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    expect(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(0);
  });

  test("keep the page's place and give the focus back on close", async ({
    page,
  }) => {
    // Without the cards' entrance. Scrolled into view, a card gets its 20 px
    // rise a frame or two later (an IntersectionObserver adds it), and a tap
    // on a moving button waits, retries, and can scroll the page itself:
    // Playwright 1.64 did, by 410 px, after the place below was read. The
    // place and the focus this checks do not depend on motion.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openSite(page);
    const button = cardButton(page, "neat-tool");
    await button.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    const scrollY = await page.evaluate(() => window.scrollY);

    await button.tap();
    const dialog = page.getByRole("dialog", { name: "neat-tool" });
    await dialog.getByRole("button", { name: "Close details" }).tap();

    await expect(dialog).toHaveCount(0);
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - scrollY),
    ).toBeLessThanOrEqual(1);
    await expect(button).toBeFocused();
  });
});

test.describe("A GitHub card's summary", () => {
  // The description's paragraph had flex-grow: when a neighbour in its row
  // was taller (a name wrapping over more lines), it stretched past its
  // clamp, and the lines after the ellipsis showed in the extra height (5
  // lines under a 2-line clamp on a phone).
  for (const width of [390, 800, 1280]) {
    test(`shows no more description lines than its clamp at ${width} px`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      await openSite(page);
      await card(page, "filler-one").scrollIntoViewIfNeeded();
      await page.waitForTimeout(800); // the cards' entrance

      const bleeding = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            "#projects [class*='line-clamp-']",
          ),
        ]
          .filter((element) => {
            const style = getComputedStyle(element);
            const clamp = Number(style.webkitLineClamp);
            if (!clamp) return false;
            return (
              element.clientHeight / parseFloat(style.lineHeight) > clamp + 0.15
            );
          })
          .map((element) => (element.textContent ?? "").slice(0, 30)),
      );
      expect(bleeding).toEqual([]);
      await context.close();
    });
  }

  test("wraps a long name at its hyphens, not inside a word", async ({
    browser,
  }) => {
    // The title's min-w-0 and break-words split "optimization" into
    // "optimizatio" and "n-studies" on a phone.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await openSite(page);
    const heading = page.getByRole("heading", {
      name: HYPHENATED,
      exact: true,
    });
    await heading.scrollIntoViewIfNeeded();

    // The name's characters, grouped by the line they sit on. Each goes in
    // a span of its own, which moves no break, and the span's box gives its
    // line: a one-character Range at the start of a line also reports the
    // end of the line before in WebKit.
    const lines = await heading.evaluate((element) => {
      const target = element.querySelector("span") ?? element;
      const characters = [...(target.textContent ?? "")];
      target.textContent = "";
      const out: { top: number; text: string }[] = [];
      for (const character of characters) {
        const span = document.createElement("span");
        span.textContent = character;
        target.appendChild(span);
      }
      for (const span of target.querySelectorAll("span")) {
        const top = Math.round(span.getBoundingClientRect().top);
        const last = out[out.length - 1];
        if (last && Math.abs(last.top - top) < 4) last.text += span.textContent;
        else out.push({ top, text: span.textContent ?? "" });
      }
      return out.map((line) => line.text);
    });
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(0, -1)) expect(line).toMatch(/-$/);
    await context.close();
  });
});
