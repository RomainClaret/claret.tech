import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import type { NextRequest } from "next/server";
import sharp from "sharp";
import { blogImageId } from "@/lib/blog-images/sources";

/**
 * GET /api/blog-image/<id>?w=480|960. The Medium feed is faked (it says
 * which images exist) and so is fetch (Medium's image hosts); the resize is
 * sharp's own. Each test imports the route afresh, a new instance with an
 * empty rate limiter.
 */

const feed = vi.hoisted(() => ({
  items: [] as { content?: string; thumbnail?: string }[],
}));
// Hoisted, so every fresh import of the route shares it.
const fetchMediumFeed = vi.hoisted(() => vi.fn());
vi.mock("@/lib/utils/medium-feed", () => ({ fetchMediumFeed }));

const SOURCE = "https://cdn-images-1.medium.com/max/1024/0*foSWTIlQM-cdYK3S";
const ID = blogImageId(SOURCE);

let photo: Buffer;
beforeAll(async () => {
  // 1200 by 800, with an EXIF field the output must not carry.
  photo = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#336699" },
  })
    .jpeg()
    .withExif({ IFD0: { Copyright: "exif-probe" } })
    .toBuffer();
});

const image = (body: BodyInit | null = new Uint8Array(photo), init = {}) =>
  new Response(body, {
    status: 200,
    headers: { "content-type": "image/jpeg" },
    ...init,
  });

function get(path: string, ip = "10.2.0.1") {
  return {
    headers: new Headers({ "x-real-ip": ip, "user-agent": "vitest" }),
    nextUrl: new URL(`https://claret.tech${path}`),
  } as unknown as NextRequest;
}

describe("GET /api/blog-image/[id]", () => {
  let GET: typeof import("./route").GET;
  let upstream: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    feed.items = [
      {
        // The feed's post: its picture, then Medium's tracking pixel.
        content: `<figure><img src="${SOURCE}"></figure><img src="https://medium.com/_/stat?event=post.clientViewed">`,
      },
    ];
    fetchMediumFeed.mockReset();
    fetchMediumFeed.mockImplementation(async () => feed);
    upstream = vi.fn(async () => image());
    vi.stubGlobal("fetch", upstream);
    ({ GET } = await import("./route"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves the feed's picture as WebP at the width asked, without its EXIF", async () => {
    const response = await GET(get(`/api/blog-image/${ID}?w=480`));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=2678400, s-maxage=2678400, immutable",
    );
    const output = sharp(Buffer.from(await response.arrayBuffer()));
    const meta = await output.metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 480, 320]);
    expect(meta.exif).toBeUndefined();
    expect(upstream).toHaveBeenCalledWith(
      SOURCE,
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("fetches and resizes a picture once per width, however often it is asked", async () => {
    // The CDN keys on the URL a client sends, and Next hands the route a
    // normalized query, so spellings the route cannot see (empty pairs,
    // escapes, nxtP parameters) each reached it as ?w=480: the work is
    // bounded per (id, width) here (security audit run 1, lead 15).
    for (const ip of ["10.2.1.1", "10.2.1.2", "10.2.1.3"]) {
      const response = await GET(get(`/api/blog-image/${ID}?w=480`, ip));
      expect(response.status).toBe(200);
    }
    expect(upstream).toHaveBeenCalledTimes(1);

    expect((await GET(get(`/api/blog-image/${ID}?w=960`))).status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("tries again after a failure, which it does not keep", async () => {
    upstream.mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect((await GET(get(`/api/blog-image/${ID}?w=480`))).status).toBe(502);

    expect(
      (await GET(get(`/api/blog-image/${ID}?w=480`, "10.2.1.4"))).status,
    ).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("resizes only raster formats, whatever type the upstream declares", async () => {
    // sharp picks its loader from the bytes: an SVG labeled image/png went
    // to librsvg (security audit run 1, hardening).
    upstream.mockResolvedValueOnce(
      image(
        '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>',
      ),
    );

    const response = await GET(get(`/api/blog-image/${ID}?w=480`));

    expect(response.status).toBe(502);
  });

  it("refuses an id that is not one, without reading the feed", async () => {
    const response = await GET(get("/api/blog-image/not-an-id?w=480"));

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMediumFeed).not.toHaveBeenCalled();
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses an image the feed does not name, without fetching it", async () => {
    const response = await GET(
      get(
        `/api/blog-image/${blogImageId("https://miro.medium.com/v2/other")}?w=480`,
      ),
    );

    expect(response.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses the tracking pixel the feed also holds", async () => {
    const pixel = "https://medium.com/_/stat?event=post.clientViewed";
    const response = await GET(
      get(`/api/blog-image/${blogImageId(pixel)}?w=480`),
    );

    expect(response.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each([
    ["another width", "?w=500"],
    ["no width", ""],
    ["anything else in the query", "?w=480&q=100"],
  ])("refuses %s", async (_label, query) => {
    const response = await GET(get(`/api/blog-image/${ID}${query}`));

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("follows a redirect within Medium's hosts", async () => {
    const moved = "https://miro.medium.com/v2/resize:fit:1024/0*foSWTIlQM";
    upstream.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: moved } }),
    );

    const response = await GET(get(`/api/blog-image/${ID}?w=480`));

    expect(response.status).toBe(200);
    expect(upstream.mock.calls.map(([url]) => url)).toEqual([SOURCE, moved]);
  });

  it("does not follow a redirect off Medium's hosts", async () => {
    upstream.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
      }),
    );

    const response = await GET(get(`/api/blog-image/${ID}?w=480`));

    expect(response.status).toBe(502);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("stops after two redirects", async () => {
    const hop = (n: number) =>
      new Response(null, {
        status: 302,
        headers: { location: `https://miro.medium.com/v2/hop-${n}` },
      });
    upstream
      .mockResolvedValueOnce(hop(1))
      .mockResolvedValueOnce(hop(2))
      .mockResolvedValueOnce(hop(3));

    const response = await GET(get(`/api/blog-image/${ID}?w=480`));

    expect(response.status).toBe(502);
    expect(upstream).toHaveBeenCalledTimes(3);
  });

  it("gives up on an image host that does not answer", async () => {
    // Fake timers do not reach AbortSignal.timeout: the fetch is checked for
    // a signal, and its timing out is answered as the route would see it.
    upstream.mockRejectedValueOnce(
      new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      ),
    );

    const response = await GET(get(`/api/blog-image/${ID}?w=480`));

    expect(response.status).toBe(504);
    expect(upstream.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["an error page", () => image(null, { status: 404 })],
    [
      // An image's bytes, so the type is what refuses it, not sharp.
      "something it says is not an image",
      () =>
        image(new Uint8Array(photo), {
          headers: { "content-type": "text/html" },
        }),
    ],
    [
      // One sharp would render.
      "an SVG",
      () =>
        new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>',
          { headers: { "content-type": "image/svg+xml" } },
        ),
    ],
    [
      "a file it says is too large",
      () =>
        image(new Uint8Array(photo), {
          headers: {
            "content-type": "image/jpeg",
            "content-length": String(11 * 1024 * 1024),
          },
        }),
    ],
    [
      // A real JPEG, padded past the limit: decoders ignore what follows it.
      "a file too large that does not say so",
      () =>
        image(
          new Uint8Array(
            Buffer.concat([photo, Buffer.alloc(11 * 1024 * 1024)]),
          ),
        ),
    ],
    ["bytes sharp cannot read", () => image(new Uint8Array([1, 2, 3]))],
  ])("refuses %s from upstream", async (_label, answer) => {
    upstream.mockResolvedValueOnce(answer());

    const response = await GET(get(`/api/blog-image/${ID}?w=480`));

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("limits a client to sixty images a minute", async () => {
    const statuses: number[] = [];
    for (let n = 0; n < 61; n++) {
      statuses.push(
        (await GET(get("/api/blog-image/not-an-id?w=480", "10.2.0.9"))).status,
      );
    }

    expect(statuses.slice(0, 60).every((status) => status === 404)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});
