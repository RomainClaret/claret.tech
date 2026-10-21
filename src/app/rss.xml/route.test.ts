import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, maxDuration } from "./route";

/**
 * The feed is built from Medium's own, as the blog section's API reads it,
 * not by calling the site's API over HTTP. That cost every poll a second
 * request through the API's rate limiter, made the API scrape each post's
 * page for images the feed never uses, and had a local or preview build
 * read production's API.
 */
const FEED = "https://medium.com/feed/@romainclaret";

interface Post {
  title: string;
  link: string;
  pubDate: string;
  content: string;
}

/** Text in CDATA, a "]]>" split across two sections, as Medium writes it. */
const cdata = (value: string) =>
  `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Medium's RSS for these posts. */
const rss = (posts: Post[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>${posts
    .map(
      (post) =>
        `<item><title>${cdata(post.title)}</title><link>${escape(post.link)}</link><pubDate>${post.pubDate}</pubDate><content:encoded>${cdata(post.content)}</content:encoded></item>`,
    )
    .join("")}</channel></rss>`;

/** Medium's feed for FEED; anything else (the site's own API) has no posts. */
const answering = (posts: Post[]) =>
  vi.fn(
    async (url: RequestInfo | URL) =>
      ({
        ok: true,
        status: 200,
        text: async () => (String(url) === FEED ? rss(posts) : '{"items":[]}'),
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
