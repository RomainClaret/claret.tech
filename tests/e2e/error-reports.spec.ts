import { test, expect, type ConsoleMessage, type Page } from "./utils/fixtures";

/**
 * An error that stops a page is reported to /api/client-error, which files
 * it as an issue in the site's repository when the server has
 * GITHUB_ISSUES_TOKEN (src/app/api/client-error/route.ts). A test build has
 * none, so the route answers 204 and the page claims no report; a 202,
 * routed here, brings the note.
 *
 * Each error is forced: one ResizeObserver.observe() call, on one element,
 * throws, so one component fails in an effect, as a real bug would, and
 * nothing else does.
 */

const MARKER = "e2e: observing failed";

function failObserving({
  selector,
  marker,
}: {
  selector: string;
  marker: string;
}) {
  const observe = ResizeObserver.prototype.observe;
  ResizeObserver.prototype.observe = function (target, options) {
    if (target instanceof Element && target.matches(selector)) {
      throw new Error(marker);
    }
    return observe.call(this, target, options);
  };
}

// The first frame in the site's own chunks, as real stacks have it.
const FRAME = /^\/_next\/static\/chunks\/[\w./%-]+\.js:\d+:\d+$/;

/**
 * Whether a console message is the forced error. Its text will not do:
 * Chromium's holds the error's message, Firefox's only "Error", the class
 * name. The arguments are the logged values themselves.
 */
async function isForcedError(message: ConsoleMessage): Promise<boolean> {
  const values = await Promise.all(
    message
      .args()
      .map((arg) =>
        arg
          .evaluate((value) =>
            value instanceof Error ? value.message : String(value),
          )
          .catch(() => ""),
      ),
  );
  return [message.text(), ...values].some((text) => text.includes(MARKER));
}

// The note, in its live region (the layout's toasts have one too).
const reportNote = (page: Page) =>
  page.getByRole("status").filter({ hasText: "A report of it was sent." });

const boundaries = [
  {
    // The PDF viewer fits its pages to the "Pages" region it observes.
    name: "the page's error.tsx",
    path: "/pdf/cv",
    selector: '[role="region"][aria-label="Pages"]',
    heading: "Something went wrong",
  },
  {
    // The cookie notice sits in the root layout, outside the page's
    // boundary and AppWrapper's: only global-error.tsx catches it.
    name: "the root's global-error.tsx",
    path: "/",
    selector: '[role="region"][aria-label="Privacy notice"]',
    heading: "Something went wrong!",
  },
];

for (const { name, path, selector, heading } of boundaries) {
  test.describe(`An error caught by ${name}`, () => {
    test("is reported, and no report is claimed while none is filed", async ({
      page,
      context,
      baseURL,
    }) => {
      // A cookie the report has to leave behind: the site sets none, so with
      // no cookie in the browser "no cookie sent" held whatever the fetch did.
      await context.addCookies([
        { name: "probe", value: "1", url: new URL(baseURL ?? "").origin },
      ]);
      const consoleErrors: ConsoleMessage[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message);
      });
      await page.addInitScript(failObserving, { selector, marker: MARKER });
      const posted = page.waitForRequest(
        (request) =>
          request.url().endsWith("/api/client-error") &&
          request.method() === "POST",
      );

      const visit = await page.goto(`${path}?playwright=true`);
      // The control: the page's own request carries it.
      expect(await visit?.request().headerValue("cookie")).toContain("probe=1");

      const request = await posted;
      expect(request.postDataJSON()).toEqual({
        name: "Error",
        message: MARKER,
        frame: expect.stringMatching(FRAME),
        path,
        // The built commit (next.config.mjs); "unknown" from a git archive.
        build: expect.stringMatching(/^([0-9a-f]{7}|unknown)$/),
      });
      // Nothing else goes with it: no cookie, and no Referer, which held
      // the page's full address, query included.
      const headers = await request.allHeaders();
      expect(headers.referer).toBeUndefined();
      expect(headers.cookie).toBeUndefined();
      expect((await request.response())?.status()).toBe(204);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      // Two frames for the answer to reach the page.
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await expect(page.getByText("A report of it was sent.")).toHaveCount(0);

      // The forced error only: no CSP refusal or failed request.
      const others = [];
      for (const message of consoleErrors) {
        if (!(await isForcedError(message))) others.push(message.text());
      }
      expect(others).toEqual([]);
    });

    test("says a report was sent once the server has it on record", async ({
      page,
    }) => {
      await page.addInitScript(failObserving, { selector, marker: MARKER });
      await page.route("**/api/client-error", (route) =>
        route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ reported: true }),
        }),
      );

      await page.goto(`${path}?playwright=true`);

      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await expect(reportNote(page)).toBeVisible();
    });
  });
}
