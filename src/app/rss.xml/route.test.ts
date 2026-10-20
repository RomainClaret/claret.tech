import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, maxDuration } from "./route";

/**
 * The feed is built from Medium's own (through rss2json, as the blog
 * section's API reads it), not by calling the site's API over HTTP. That
 * cost every poll a second request through the API's rate limiter, made the
 * API scrape each post's page for images the feed never uses, and had a
 * local or preview build read production's API.
 */
const FEED =
  "https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@romainclaret";

/** Medium's feed for FEED; anything else (the site's own API) has no posts. */
const answering = (items: unknown[]) =>
  vi.fn(
    async (url: RequestInfo | URL) =>
      ({
        ok: true,
        status: 200,
        json: async () =>
          String(url) === FEED ? { status: "ok", items } : { items: [] },
      }) as Response,
  );

describe("GET /rss.xml", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_MEDIUM_USERNAME", "romainclaret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://claret.tech");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ends within half a minute, whatever the feed does", () => {
    // The feed's fetch refreshes in the background once stale, and Next
    // drops its timeout there (next/dist/server/lib/patch-fetch.js).
    expect(maxDuration).toBe(30);
  });

  it("reads Medium's feed, not the site's own API", async () => {
    const fetchMock = answering([
      {
        title: "Growing minds",
        link: "https://medium.com/@romainclaret/growing-minds",
        pubDate: "2026-10-01 10:00:00",
        content: "<p>Hello</p>",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();
    const xml = await response.text();

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url.includes("/api/medium-posts"))).toEqual([]);
    expect(urls).toContain(FEED);
    expect(response.status).toBe(200);
    expect(xml).toContain("<title><![CDATA[Growing minds]]></title>");
  });

  it("escapes what Medium sends", async () => {
    vi.stubGlobal(
      "fetch",
      answering([
        {
          title: "a ]]> b",
          link: "https://medium.com/@x/p?a=1&b=<2>",
          pubDate: "2026-10-01 10:00:00",
          content: "<p>x</p>",
        },
      ]),
    );

    const xml = await (await GET()).text();

    expect(xml).toContain("<title><![CDATA[a ]]]]><![CDATA[> b]]></title>");
    expect(xml).toContain(
      "<link>https://medium.com/@x/p?a=1&amp;b=&lt;2&gt;</link>",
    );
  });
});
