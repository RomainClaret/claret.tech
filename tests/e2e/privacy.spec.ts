import { test, expect } from "./utils/fixtures";
import { waitForSplashToEnd } from "./utils/splash";

/**
 * What the privacy policy promises, checked in the browser
 * (PRIVACY-POLICY.md): the site sets no cookies, and a visit contacts no
 * host but the site's own.
 */

test.describe("Privacy", () => {
  test("sets no cookie, a theme switch included", async ({ page, context }) => {
    // The theme lived in a year's cookie too until round 25, sent with
    // every request though no server read it.
    await page.goto("/?playwright=true");
    await waitForSplashToEnd(page);

    await page
      .getByRole("button", { name: /toggle theme/i })
      .first()
      .click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    expect(await context.cookies()).toEqual([]);
  });

  test("contacts no host but its own, scrolled to the end", async ({
    page,
    baseURL,
  }) => {
    // Cards took their color from their image, and a remote image (the
    // Kudos card's Unsplash photo) loaded in the visitor's browser.
    const own = new URL(baseURL ?? "").origin;
    const foreign = new Set<string>();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== own) {
        foreign.add(url.host);
      }
    });

    await page.goto("/?playwright=true");
    await waitForSplashToEnd(page);
    // Down a screen at a time: the sections and the cards' colors load as
    // they come near.
    for (let screen = 0; screen < 40; screen++) {
      const atEnd = await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
        return (
          window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2
        );
      });
      await page.waitForTimeout(250);
      if (atEnd) break;
    }
    await page.waitForTimeout(1500);

    expect([...foreign]).toEqual([]);
  });

  test("expires the theme cookie an earlier visit left", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "theme", value: "dark", url: new URL(baseURL ?? "").origin },
    ]);

    await page.goto("/?playwright=true");
    await waitForSplashToEnd(page);

    await expect
      .poll(async () => (await context.cookies()).map((cookie) => cookie.name))
      .toEqual([]);
  });
  test("shows a blog post's picture from the site's own route", async ({
    page,
    baseURL,
  }) => {
    // Medium's pictures went through Next's image optimizer, which let anyone
    // spend Hobby's 5,000 transformations a month on any Medium, Unsplash
    // or jsDelivr image. The blog gets a path on the site's route instead
    // (src/app/api/blog-image), answered here with one of the site's images.
    const own = new URL(baseURL ?? "").origin;
    const foreign = new Set<string>();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== own) {
        foreign.add(url.host);
      }
    });
    const path = "/api/blog-image/0123456789abcdef";
    await page.route("**/api/medium-posts**", (route) =>
      route.fulfill({
        json: {
          status: "ok",
          items: [
            {
              title: "A post with a picture",
              link: "https://medium.com/@romainclaret/a-post",
              pubDate: "2026-10-01 10:00:00",
              content: "<p>Text</p>",
              guid: "post-1",
              categories: [],
              image: path,
              enrichedColor: "rgb(59, 130, 246)",
            },
          ],
          cachedColors: {},
        },
      }),
    );
    await page.route(
      (url) => url.pathname === path,
      (route) =>
        route.fulfill({
          path: "public/images/kudos_gecco_2024.webp",
          contentType: "image/webp",
        }),
    );

    await page.goto("/?playwright=true");
    await waitForSplashToEnd(page);
    await page.locator("#blogs").scrollIntoViewIfNeeded();
    const picture = page
      .locator("#blogs")
      .getByRole("img", { name: "A post with a picture" });
    await picture.scrollIntoViewIfNeeded();

    await expect
      .poll(() =>
        picture.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    const source = await picture.evaluate(
      (image: HTMLImageElement) => image.currentSrc,
    );
    expect(source).toMatch(new RegExp(`^${own}${path}\\?w=(480|960)$`));
    expect([...foreign]).toEqual([]);
  });

  test("whose route refuses what is not a blog picture", async ({
    request,
  }) => {
    // Both refused before the route reads the feed or fetches anything.
    const notAnId = await request.get("/api/blog-image/not-an-id?w=480");
    expect(notAnId.status()).toBe(404);
    expect(notAnId.headers()["cache-control"]).toBe("no-store");

    const otherWidth = await request.get(
      "/api/blog-image/0123456789abcdef?w=500",
    );
    expect(otherWidth.status()).toBe(400);
  });
  test("whose image optimizer takes no image from elsewhere", async ({
    request,
  }) => {
    // It took any image on Medium, Unsplash or jsDelivr, or any GitHub
    // avatar, which anyone could use to spend Vercel's 5,000 monthly
    // transformations. Only the site's own GitHub avatar is left.
    for (const source of [
      "https://images.unsplash.com/photo-1717501218385-55bc3a95be94",
      "https://miro.medium.com/v2/resize:fit:1024/0*foSWTIlQM-cdYK3S",
      "https://avatars.githubusercontent.com/u/1",
    ]) {
      const answer = await request.get(
        `/_next/image?url=${encodeURIComponent(source)}&w=640&q=75`,
      );
      expect(answer.status(), source).toBe(400);
    }

    // The control: the avatar the contact section shows still comes through
    // (github.com redirects it to avatars.githubusercontent.com/u/8895475).
    const avatar = await request.get(
      `/_next/image?url=${encodeURIComponent("https://github.com/RomainClaret.png")}&w=64&q=75`,
    );
    expect(avatar.status()).toBe(200);
  });
});
