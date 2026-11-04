import { test, expect, type Locator, type Page } from "./utils/fixtures";
import AxeBuilder from "@axe-core/playwright";
import { acknowledgeCookieNotice } from "./utils/cookie-notice";
import { waitForSplashToEnd } from "./utils/splash";

/**
 * The research, skills, paper and blog cards open their details in a dialog
 * above the page (round 27). They grew in place, which pushed the rest of
 * the page around: one research card took the grid from 800 to 1,332 px at
 * 1280 px. The philosophy cards had all 24 points out (790 px tall at
 * 1280 px, 2,308 at 390), and the journey's short and long texts were of
 * about the same length. A link to #<card> points at the card;
 * #<card>-full opens its details.
 *
 * The data is the site's own but for the Medium posts, which are this
 * file's (MEDIUM_POSTS); the one Kudos story has a long text.
 */

/** scroll-to-section.ts's offset under the navigation bar. */
const NAV_OFFSET = 64;

/** The test Medium posts' anchors: their URLs' last segment, as Blog.tsx does. */
const MEDIUM_LONG = "a-post-under-its-picture-0a1b2c3d4e5f";
const MEDIUM_SHORT = "a-short-post-6a7b8c9d0e1f";

/** The research card whose dialog has pictures and animations (research-media.ts). */
const BREEDER = "Breeding with an Evolvable Vocabulary";

/**
 * The blog's Medium posts, as Medium writes them. The page asks
 * /api/medium-posts with no query string, so the API's own test posts
 * (served to ?playwright=true on the API's address, removed since) never
 * reached it, and the blog showed whatever the server could fetch. The long post has a photo
 * under its first lines and the credit in its caption, as the site's real
 * posts do: the text was cut at that credit until 2026-10-21, which left
 * the card with no Read more. The short one has none.
 */
const MEDIUM_POSTS = [
  {
    title: "A post under its picture",
    link: `https://medium.com/@romainclaret/${MEDIUM_LONG}`,
    guid: "https://medium.com/p/0a1b2c3d4e5f",
    pubDate: "Fri, 02 Oct 2026 10:00:00 GMT",
    author: "Romain Claret",
    categories: [],
    content:
      "<p>The start of a post, before its picture, as Medium writes them.</p>" +
      '<figure><img alt="" src="/images/paper_geenns_2024.webp" />' +
      '<figcaption>Photo by <a href="https://unsplash.com/@someone">Someone</a>' +
      ' on <a href="https://unsplash.com">Unsplash</a></figcaption></figure>' +
      "<p>The rest of it comes after the picture, whose credit is in the" +
      " caption: the card used to stop at the credit.</p>" +
      "<p>The last lines of the post.</p>",
    image: "/images/paper_geenns_2024.webp",
    enrichedColor: "rgb(59, 130, 246)",
  },
  {
    title: "A short post",
    link: `https://medium.com/@romainclaret/${MEDIUM_SHORT}`,
    guid: "https://medium.com/p/6a7b8c9d0e1f",
    pubDate: "Thu, 01 Oct 2026 10:00:00 GMT",
    author: "Romain Claret",
    categories: [],
    content: "<p>Only a few words, too few for a Read more.</p>",
    image: "/images/jax_es_hyperneat.webp",
    enrichedColor: "rgb(16, 185, 129)",
  },
];

interface Kind {
  name: string;
  /** What must keep its size while its details are open. */
  card: (page: Page) => Locator;
  /** Its Read more. */
  trigger: (page: Page) => Locator;
  /** The dialog's name: the card's title. */
  dialog: string | RegExp;
}

const holographicCard = (page: Page, heading: string | RegExp) =>
  page
    .locator(".group\\/card")
    .filter({ has: page.getByRole("heading", { name: heading }) });

const KINDS: Kind[] = [
  {
    name: "a research card",
    card: (page) => page.locator("#graphqa"),
    trigger: (page) =>
      page.getByRole("button", { name: /^Read more about GraphQA/ }),
    dialog: /^GraphQA/,
  },
  {
    name: "the research journey",
    card: (page) => holographicCard(page, "My Research Journey"),
    trigger: (page) =>
      page.getByRole("button", { name: "Read the full story" }),
    dialog: "My Research Journey",
  },
  {
    name: "a core activity",
    card: (page) => holographicCard(page, /^Evolutionary AI/),
    trigger: (page) =>
      page.getByRole("button", { name: /^Read more about Evolutionary AI/ }),
    dialog: /^Evolutionary AI/,
  },
  {
    name: "a philosophy card",
    card: (page) => holographicCard(page, "Current Focus"),
    trigger: (page) =>
      page.getByRole("button", { name: "Read more about Current Focus" }),
    dialog: "Current Focus",
  },
  {
    name: "a publication",
    card: (page) => page.locator("#claret2026emr"),
    trigger: (page) =>
      page.getByRole("button", { name: /^Read more about Tensor-Accelerated/ }),
    dialog: /^Tensor-Accelerated/,
  },
  {
    name: "an Other Work card",
    card: (page) => page.locator("#claret2016blockchain"),
    trigger: (page) =>
      page.getByRole("button", {
        name: "Read more about Blockchain, a techie overview",
      }),
    dialog: "Blockchain, a techie overview",
  },
  {
    name: "a blog post",
    card: (page) => page.locator("#gecco-2024-tuning-evolution"),
    trigger: (page) =>
      page.getByRole("button", {
        name: /^Read more about Teaching AI to Evolve/,
      }),
    dialog: /^Teaching AI to Evolve/,
  },
  {
    name: "a Medium post",
    card: (page) => page.locator(`[id="${MEDIUM_LONG}"]`),
    trigger: (page) =>
      page.getByRole("button", {
        name: "Read more about A post under its picture",
      }),
    dialog: "A post under its picture",
  },
  // Last, because LINKED and the tests below name the others by index.
  {
    name: "a research card with pictures and animations",
    card: (page) => page.locator("#evolvable-vocabulary"),
    trigger: (page) =>
      page.getByRole("button", {
        name: `Read more about ${BREEDER}`,
      }),
    dialog: BREEDER,
  },
];

/** The cards with an anchor, and what a link to their details opens. */
const LINKED = [
  { id: "graphqa", trigger: KINDS[0].trigger, dialog: KINDS[0].dialog },
  { id: "claret2026emr", trigger: KINDS[4].trigger, dialog: KINDS[4].dialog },
  {
    id: "claret2016blockchain",
    trigger: KINDS[5].trigger,
    dialog: KINDS[5].dialog,
  },
  {
    id: "gecco-2024-tuning-evolution",
    trigger: KINDS[6].trigger,
    dialog: KINDS[6].dialog,
  },
  { id: MEDIUM_LONG, trigger: KINDS[7].trigger, dialog: KINDS[7].dialog },
];

async function openSite(page: Page, hash = "") {
  await acknowledgeCookieNotice(page);
  await page.route("**/api/medium-posts**", (route) =>
    route.fulfill({
      json: { status: "ok", items: MEDIUM_POSTS, cachedColors: {} },
    }),
  );
  await page.goto(`/?playwright=true${hash}`);
  await waitForSplashToEnd(page);
}

// The layout's height, not the drawn one: the cards zoom 2% under the
// pointer, and WebKit keeps that hover while a backdrop covers a pointer
// that has not moved.
const height = (locator: Locator) =>
  locator.evaluate((element) => (element as HTMLElement).offsetHeight);

const sidewaysOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

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

test.describe("A card's details", () => {
  test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });

  for (const kind of KINDS) {
    test(`open above the page for ${kind.name}, which keeps its size`, async ({
      page,
    }) => {
      await openSite(page);
      const trigger = kind.trigger(page);
      await trigger.scrollIntoViewIfNeeded();
      await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
      const card = kind.card(page);
      const before = await height(card);

      await trigger.click();

      const dialog = page.getByRole("dialog", { name: kind.dialog });
      await expect(dialog).toBeVisible();
      expect(Math.abs((await height(card)) - before)).toBeLessThanOrEqual(1);
      // In a portal at the end of the page, not inside the card.
      expect(
        await dialog.evaluate(
          (element) => element.parentElement?.parentElement === document.body,
        ),
      ).toBe(true);
      expect(
        await winsHitTest(
          dialog.getByRole("button", { name: "Close details" }),
        ),
      ).toBe(true);

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }

  test("point at a card for #<card>, without opening it", async ({ page }) => {
    await openSite(page);
    // The blog's cards come with their own chunk and the articles.
    await expect(page.locator("#gecco-2024-tuning-evolution")).toBeAttached();

    for (const { id } of LINKED) {
      await page.evaluate((hash) => (window.location.hash = hash), id);
      await expect(page.locator(`[id="${id}"]`)).toHaveClass(
        /deep-link-highlight/,
      );
      await expect(page.locator(`[id="${id}"]`)).toBeInViewport();
      // A moment for a dialog that would open, whose code loads first.
      await page.waitForTimeout(500);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });

  for (const { id, trigger, dialog: name } of LINKED) {
    test(`open for #${id}-full, and close back to the card`, async ({
      page,
    }) => {
      await openSite(page, `#${id}-full`);

      const dialog = page.getByRole("dialog", { name });
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);

      // The link now points at the card, as copy-link writes it, so a
      // reload does not open the dialog again; the page is at the card, and
      // the focus on its Read more.
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect
        .poll(() =>
          page
            .locator(`[id="${id}"]`)
            .evaluate(
              (element, offset) =>
                Math.abs(element.getBoundingClientRect().top - offset),
              NAV_OFFSET,
            ),
        )
        .toBeLessThanOrEqual(2);
      await expect(trigger(page)).toBeFocused();
    });
  }

  test("show a Medium post's whole text, without its photo's credit", async ({
    page,
  }) => {
    await openSite(page, `#${MEDIUM_LONG}-full`);

    const dialog = page.getByRole("dialog", {
      name: "A post under its picture",
    });
    await expect(dialog).toContainText("The last lines of the post.");
    await expect(dialog).not.toContainText("Photo by");
  });

  test("give the focus to a card's first control when it has no Read more", async ({
    page,
  }) => {
    // A text too short for a Read more: closing gave the focus back to the
    // page itself, so Tab started from the top.
    await openSite(page, `#${MEDIUM_SHORT}-full`);
    const dialog = page.getByRole("dialog", { name: "A short post" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).toHaveCount(0);
    await expect(
      page
        .locator(`[id="${MEDIUM_SHORT}"]`)
        .getByRole("button", { name: "Copy link to this post" }),
    ).toBeFocused();
  });

  test("let the PDF reader open above a paper's details, one Escape a layer", async ({
    page,
  }) => {
    await openSite(page);
    const trigger = KINDS[4].trigger(page);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const details = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("button", { name: "Close details" }) });
    await expect(details).toBeVisible();

    await details.getByRole("button", { name: /Read Paper/ }).click();

    const reader = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("button", { name: "Close PDF viewer" }) });
    await expect(reader).toBeVisible();
    expect(
      await winsHitTest(
        reader.getByRole("button", { name: "Close PDF viewer" }),
      ),
    ).toBe(true);

    await page.keyboard.press("Escape");
    await expect(reader).toHaveCount(0);
    await expect(details).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(details).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("pass the accessibility rules, closed", async ({ page }) => {
    await openSite(page);

    for (const section of ["#research", "#skills", "#papers", "#blogs"]) {
      await page.locator(section).scrollIntoViewIfNeeded();
      const cards = await new AxeBuilder({ page })
        .include(section)
        .withRules([
          "nested-interactive",
          "button-name",
          "aria-allowed-attr",
          "aria-valid-attr-value",
        ])
        .analyze();
      expect(cards.violations, section).toEqual([]);
    }
  });

  // One test a dialog: all of them in one test ran out of its 60 s at the
  // fourth of eight in WebKit in the Linux container, under load, and CI's
  // runners are about 3.7 times slower than that container.
  for (const kind of KINDS) {
    test(`pass the accessibility rules, open for ${kind.name}`, async ({
      page,
    }) => {
      await openSite(page);
      const trigger = kind.trigger(page);
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      await expect(
        page.getByRole("dialog", { name: kind.dialog }),
      ).toBeVisible();

      const dialog = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withRules([
          "aria-dialog-name",
          "scrollable-region-focusable",
          "link-name",
          "button-name",
          "nested-interactive",
          "list",
          "listitem",
          "image-alt",
        ])
        .analyze();
      expect(dialog.violations).toEqual([]);
    });
  }

  // The breeder's card shows pictures and two animations in its dialog
  // (research-media.ts). Reduced motion is on in this describe: the
  // animations wait on their last frame, and fetch nothing until Play.
  test("show the breeder's pictures, its animations still under reduced motion", async ({
    page,
  }) => {
    // A film fetched is a response with an HTTP status. Linux WebKit, CI's,
    // reports a request for a preload="none" film that it never sends: its
    // response has status 0, and nothing reaches the server. play() then
    // fetches the film with status 200 (Chromium: 206, and no event before).
    // Measured in CI's Playwright 1.64 image, 2026-11-04.
    const videoResponses: string[] = [];
    page.on("response", (response) => {
      if (
        /\/images\/research\/.+\.(webm|mp4)$/.test(response.url()) &&
        response.status() > 0
      ) {
        videoResponses.push(response.url());
      }
    });
    await openSite(page, "#evolvable-vocabulary-full");
    const dialog = page.getByRole("dialog", { name: BREEDER });
    await expect(dialog).toBeVisible();

    // Every picture decoded: served, and allowed by the CSP.
    const pictures = dialog.locator("img");
    await expect(pictures).toHaveCount(10);
    await expect
      .poll(() =>
        pictures.evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);

    const videos = dialog.locator("video");
    await expect(videos).toHaveCount(2);
    expect(
      await videos.evaluateAll((elements) =>
        elements.map((element) => {
          const video = element as HTMLVideoElement;
          return [video.autoplay, video.paused, video.preload, video.muted];
        }),
      ),
    ).toEqual([
      [false, true, "none", true],
      [false, true, "none", true],
    ]);

    // Each file with its type, and in ranges, which Safari asks a video in.
    const urls = await dialog.evaluate((element) => [
      ...[...element.querySelectorAll("img")].map((image) => image.src),
      ...[...element.querySelectorAll("video")].map((video) => video.poster),
      ...[...element.querySelectorAll("source")].map((source) => source.src),
    ]);
    expect(urls).toHaveLength(16);
    for (const url of urls) {
      const response = await page.request.get(url, {
        headers: { Range: "bytes=0-1" },
      });
      expect(response.status(), url).toBe(206);
      expect(response.headers()["content-type"], url).toBe(
        url.endsWith(".webm")
          ? "video/webm"
          : url.endsWith(".mp4")
            ? "video/mp4"
            : "image/webp",
      );
    }
    expect(videoResponses).toEqual([]);
  });

  test("keep the skills and the journey compact", async ({ page }) => {
    // Measured at 1280 px when the cards stopped growing in place (round
    // 27), plus 15%: core activities 354 px, the philosophy row 226 px (it
    // was 790), the journey 308 px.
    await openSite(page);
    const grids = page.locator("#skills .grid");
    await grids.nth(1).scrollIntoViewIfNeeded();

    expect(await height(grids.nth(0))).toBeLessThanOrEqual(407);
    expect(await height(grids.nth(1))).toBeLessThanOrEqual(260);
    // The four philosophy cards in one row.
    const tops = await grids
      .nth(1)
      .locator(":scope > *")
      .evaluateAll((cards) =>
        cards.map((card) => Math.round(card.getBoundingClientRect().top)),
      );
    expect(tops).toHaveLength(4);
    expect(new Set(tops).size).toBe(1);
    expect(
      await height(holographicCard(page, "My Research Journey")),
    ).toBeLessThanOrEqual(354);
  });
});

test.describe("A link the page opens with", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  // Its card's highlight pulses for 2.6 s once the splash has gone. It
  // started with the link, under the splash, which covered about 2 s of it
  // on a production build (2026-10-21).
  test("highlights its card once the splash has gone, not under it", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const seen = { lit: false, litUnderSplash: false };
      Object.assign(window, { highlightSeen: seen });
      new MutationObserver(() => {
        const card = document.getElementById("graphqa");
        if (!card?.classList.contains("deep-link-highlight")) return;
        seen.lit = true;
        if (
          document.querySelector(
            '[data-splash-backdrop], [aria-label="Loading portfolio"]',
          )
        ) {
          seen.litUnderSplash = true;
        }
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    });

    await openSite(page, "#graphqa");

    await expect(page.locator("#graphqa")).toHaveClass(/deep-link-highlight/);
    expect(
      await page.evaluate(
        () => (window as unknown as { highlightSeen: object }).highlightSeen,
      ),
    ).toEqual({ lit: true, litUnderSplash: false });
  });
});

test.describe("A card's details on a phone", () => {
  test.use({ isMobile: true, hasTouch: true, reducedMotion: "reduce" });

  for (const width of [390, 320]) {
    test.describe(`at ${width} px`, () => {
      test.use({ viewport: { width, height: width === 390 ? 844 : 640 } });

      test("open as a sheet at the bottom, nothing wider than the screen", async ({
        page,
      }) => {
        await openSite(page);
        const viewport = page.viewportSize()!;

        // The longest of the texts, the one dialog with a footer, and the
        // one with pictures and animations.
        for (const kind of [KINDS[3], KINDS[6], KINDS[8]]) {
          const trigger = kind.trigger(page);
          await trigger.scrollIntoViewIfNeeded();
          await trigger.tap();
          const dialog = page.getByRole("dialog", { name: kind.dialog });
          await expect(dialog).toBeVisible();

          const box = (await dialog.boundingBox())!;
          expect(
            Math.abs(box.y + box.height - viewport.height),
          ).toBeLessThanOrEqual(1);
          expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(box.width - viewport.width)).toBeLessThanOrEqual(1);
          expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
          expect(
            await dialog.evaluate(
              (element) => element.scrollWidth - element.clientWidth,
            ),
          ).toBeLessThanOrEqual(0);

          await dialog.getByRole("button", { name: "Close details" }).tap();
          await expect(dialog).toHaveCount(0);
        }
      });
    });
  }

  test.describe("at 390 px", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("keep the philosophy block short", async ({ page }) => {
      // 772 px when only each card's key point stayed on the page (round
      // 27), plus 15%; with all 24 points out it was 2,308.
      await openSite(page);
      const philosophy = page.locator("#skills .grid").nth(1);
      await philosophy.scrollIntoViewIfNeeded();

      expect(await height(philosophy)).toBeLessThanOrEqual(888);
    });
  });
});

// With motion allowed, the breeder's animations play by themselves, muted and
// looping. Chromium only: it always has AV1, while whether a WebKit build
// decodes AV1 or H.264 depends on the machine it runs on.
test.describe("A card's animations, motion allowed", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "chromium only: its AV1 decoder is built in",
  );
  test.use({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "no-preference",
  });

  // A first frame decoded and playing: 20 s, not the default 8. Under a
  // load average of 105 on the Mac one run took longer (2026-11-04), and CI's
  // runners are slower than the Mac.
  const PLAYING = { timeout: 20_000 };

  test("play by themselves from the AV1 file, the end pause kept", async ({
    page,
  }) => {
    await openSite(page, "#evolvable-vocabulary-full");
    const dialog = page.getByRole("dialog", { name: BREEDER });
    await expect(dialog).toBeVisible();
    const videos = dialog.locator("video");
    await expect(videos).toHaveCount(2);

    // The GIFs' own lengths, their last frame's 3.6 s included.
    const durations = [26.4, 24];
    for (const [i, duration] of durations.entries()) {
      const video = videos.nth(i);
      await video.scrollIntoViewIfNeeded();
      await expect
        .poll(
          () =>
            video.evaluate((element) => {
              const media = element as HTMLVideoElement;
              return media.readyState >= 2 && !media.paused;
            }),
          PLAYING,
        )
        .toBe(true);
      const state = await video.evaluate((element) => {
        const media = element as HTMLVideoElement;
        return { src: media.currentSrc, duration: media.duration };
      });
      expect(state.src).toMatch(/\.webm$/);
      expect(Math.abs(state.duration - duration)).toBeLessThan(0.1);
    }
  });

  test("pause and play again with Space on the focused animation", async ({
    page,
  }) => {
    await openSite(page, "#evolvable-vocabulary-full");
    const dialog = page.getByRole("dialog", { name: BREEDER });
    const video = dialog.locator("video").first();
    const paused = () =>
      video.evaluate((element) => (element as HTMLVideoElement).paused);
    // Playing first: Chromium holds a muted autoplay while it is off screen.
    await video.scrollIntoViewIfNeeded();
    await expect.poll(paused, PLAYING).toBe(false);

    // One press, one toggle: the dialog's handler, Chromium's own prevented.
    await video.focus();
    await page.keyboard.press("Space");
    await expect.poll(paused).toBe(true);
    await page.keyboard.press("Space");
    await expect.poll(paused, PLAYING).toBe(false);
  });
});
