import { test as base } from "@playwright/test";

export * from "@playwright/test";

/**
 * Each test its own client for the API's rate limit.
 *
 * src/lib/utils/rate-limiter.ts keys a client by its IP (x-real-ip or
 * x-forwarded-for, which Vercel sets) and the start of its user agent. With
 * no proxy in front of a local server, every test browser of one engine was
 * one client with 100 requests a minute, and a homepage load spends 6: one
 * run of terminal.spec (27 loads in 26 s) had 38% of them refused, 99% right
 * after another run, and the sections fell back without a word.
 *
 * A header, not a route: routing turns the HTTP cache off. Merged into what
 * the config sets (X-Test-Mode in CI), and a plain fixture, not an option,
 * which the config's `use` would set over it. A retry is a new client.
 */
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, testInfo) => {
    await use({
      ...extraHTTPHeaders,
      "x-real-ip": `e2e-${testInfo.testId}-${testInfo.retry}`,
    });
  },
});
