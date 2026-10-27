import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, maxDuration } from "./route";
import { RATE_LIMIT_CONFIG } from "@/lib/utils/rate-limiter";

const feedRequest = (path = "/rss.xml", ip = "203.0.113.7") =>
  new NextRequest(`https://claret.tech${path}`, {
    headers: { "x-forwarded-for": ip },
  });

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

  // Each distinct query missed the CDN's cached feed and ran the function,
  // and nothing counted the calls (security audit run 1, hardening).
  it("sends a query to the one cached URL, without reading the feed", async () => {
    const fetchMock = answering([]);
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(feedRequest("/rss.xml?nocache=1"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://claret.tech/rss.xml",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts each client's requests in the default limit", async () => {
    vi.stubGlobal("fetch", answering([]));
    const statuses: number[] = [];
    for (let i = 0; i <= RATE_LIMIT_CONFIG.maxRequests; i++) {
      statuses.push(
        (await GET(feedRequest("/rss.xml?n=" + i, "198.51.100.9"))).status,
      );
    }

    expect(statuses.at(-1)).toBe(429);
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

    const response = await GET(feedRequest());
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

    const xml = await (await GET(feedRequest())).text();

    expect(xml).toContain("<title><![CDATA[a ]]]]><![CDATA[> b]]></title>");
    expect(xml).toContain(
      "<link>https://medium.com/@x/p?a=1&amp;b=&lt;2&gt;</link>",
    );
  });

  it("writes no character XML forbids, no view counter, and its own picture", async () => {
    // A control character (decoded from &#11;) made the whole feed
    // ill-formed; the feed carried Medium's view counter and pointed its
    // enclosure at Medium, which a reader then contacted (security audit
    // run 1, hardening).
    const picture = "https://cdn-images-1.medium.com/max/1024/0*rss-picture";
    vi.stubGlobal(
      "fetch",
      answering([
        {
          title: "tab\u000bbell\u0007",
          link: "https://medium.com/@x/p",
          pubDate: "2026-10-01 10:00:00",
          content: `<p>x\u0001</p><img src="${picture}"><img src="https://medium.com/_/stat?event=post.clientViewed" width="1" height="1">`,
        },
      ]),
    );

    const xml = await (await GET(feedRequest())).text();

    // The characters XML 1.0 forbids.
    // eslint-disable-next-line no-control-regex
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(xml).not.toContain("medium.com/_/stat");
    expect(xml).toMatch(
      /<enclosure url="https:\/\/claret\.tech\/api\/blog-image\/[0-9a-f]{16}\?w=960" type="image\/webp" \/>/,
    );
  });
});
