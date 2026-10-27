import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The scraper persists results to src/lib/utils/medium-cache.json under
 * process.cwd(). Left real, a URL fetched by one test is served from cache to
 * the next and to every later run, so `fetch` is not called and assertions
 * about it fail on the second run having passed on the first. Reading always
 * misses and writing goes nowhere, so each test starts cold.
 */
vi.mock("fs", () => {
  const promises = {
    readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
  // Both shapes: the scraper uses the named `promises` export, and the module
  // still needs a default for anything reaching it through interop.
  return { promises, default: { promises } };
});

import { fetchMediumArticle } from "./medium-scraper";

/**
 * The article URL reaches a server-side fetch straight from Medium's feed,
 * so it is third-party input. These tests pin the host guard.
 *
 * The assertion that matters in each rejection case is `fetch` not being
 * called at all: returning nulls while still having made the request would
 * look identical from the return value and would not be a fix.
 */
describe("fetchMediumArticle host guard", () => {
  const originalSkip = process.env.SKIP_EXTERNAL_APIS;

  beforeEach(() => {
    // The function short-circuits on this before it looks at the URL, and CI
    // sets it globally - without clearing it every assertion below would pass
    // for the wrong reason.
    delete process.env.SKIP_EXTERNAL_APIS;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    if (originalSkip === undefined) delete process.env.SKIP_EXTERNAL_APIS;
    else process.env.SKIP_EXTERNAL_APIS = originalSkip;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const refused = [
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["loopback", "http://localhost:3000/api/publications"],
    ["private range", "http://10.0.0.1/"],
    ["arbitrary host", "https://example.invalid/article"],
    // The reason the check is endsWith and not includes.
    ["suffix lookalike", "https://medium.com.example.invalid/post"],
    // Right host, wrong scheme: plaintext is downgradeable in transit.
    ["http medium", "http://medium.com/@romainclaret/post"],
    ["not a url", "notaurl"],
  ] as const;

  it.each(refused)("refuses %s without fetching", async (_label, url) => {
    const result = await fetchMediumArticle(url);

    expect(result).toEqual({ image: null, color: null });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches a real Medium article URL", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html></html>", { status: 200 }),
    );

    await fetchMediumArticle("https://medium.com/@romainclaret/some-post-abc");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "https://medium.com/@romainclaret/some-post-abc",
    );
  });

  it("accepts a Medium subdomain", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html></html>", { status: 200 }),
    );

    await fetchMediumArticle("https://towardsdatascience.medium.com/post-abc");

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not follow redirects off the allowlisted host", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html></html>", { status: 200 }),
    );

    // Distinct URL per test as hygiene, not because it is required: with fs
    // mocked above there is no cross-test cache, and this passes on the same
    // URL an earlier test uses. It was load-bearing before the mock existed.
    await fetchMediumArticle("https://medium.com/@romainclaret/redirect-probe");

    // A guard on the initial URL alone is defeated by a 302, so the request
    // must not follow one.
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeDefined();
  });

  it("gives up on the article's image after a timeout too", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          '<meta property="og:image" content="https://miro.medium.com/v2/resize:fit:1200/0*probe">',
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    await fetchMediumArticle("https://medium.com/@romainclaret/image-probe");

    expect(fetch).toHaveBeenCalledTimes(2);
    const init = vi.mocked(fetch).mock.calls[1][1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

/**
 * The image leg fetches a URL the article page names, so it gets the same
 * controls as /api/blog-image: Medium's image hosts only, every redirect hop
 * re-checked, the body counted as it arrives (security audit run 1, 4.3).
 */
describe("fetchMediumArticle image leg", () => {
  const originalSkip = process.env.SKIP_EXTERNAL_APIS;
  // The color the scraper falls back to when no picture yields one.
  const FALLBACK = "rgb(251, 146, 60)";
  const page = (image: string) =>
    new Response(`<meta property="og:image" content="${image}">`, {
      status: 200,
    });

  beforeEach(() => {
    delete process.env.SKIP_EXTERNAL_APIS;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    if (originalSkip === undefined) delete process.env.SKIP_EXTERNAL_APIS;
    else process.env.SKIP_EXTERNAL_APIS = originalSkip;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not fetch a picture off Medium's image hosts", async () => {
    // medium.com's own redirector passed the old *.medium.com check.
    vi.mocked(fetch).mockResolvedValueOnce(
      page("https://medium.com/r/?url=http://127.0.0.1/"),
    );

    const result = await fetchMediumArticle(
      "https://medium.com/@romainclaret/redirector-probe",
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.color).toBe(FALLBACK);
  });

  it("stops at a redirect off Medium's image hosts", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        page("https://miro.medium.com/v2/resize:fit:1200/0*hop-probe"),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/internal-probe" },
        }),
      );

    const result = await fetchMediumArticle(
      "https://medium.com/@romainclaret/hop-probe",
    );

    expect(fetch).toHaveBeenCalledTimes(2);
    const init = vi.mocked(fetch).mock.calls[1][1] as RequestInit;
    expect(init.redirect).toBe("manual");
    expect(result.color).toBe(FALLBACK);
  });

  it("stops reading a picture past 10 MiB with no declared length", async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      // 12 MiB, one MiB a chunk: finite, so a reader with no cap ends too.
      pull(controller) {
        pulled += 1;
        if (pulled > 12) controller.close();
        else controller.enqueue(new Uint8Array(1024 * 1024));
      },
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        page("https://miro.medium.com/v2/resize:fit:1200/0*size-probe"),
      )
      .mockResolvedValueOnce(
        new Response(body, { headers: { "content-type": "image/jpeg" } }),
      );

    const result = await fetchMediumArticle(
      "https://medium.com/@romainclaret/size-probe",
    );

    expect(result.color).toBe(FALLBACK);
    // 11 read (past 10 MiB), plus the one the stream pulls ahead; reading
    // to the end takes 13.
    expect(pulled).toBeLessThanOrEqual(12);
  });
});

/**
 * The 24-hour article cache was a file under the app directory, which is
 * read-only on Vercel: it never saved, so every request that missed the CDN
 * scraped every article again (security audit run 1, lead 14). The file
 * mock above refuses reads, as a fresh deployment's missing file does.
 */
describe("fetchMediumArticle cache", () => {
  const originalSkip = process.env.SKIP_EXTERNAL_APIS;
  const page = () =>
    new Response("<html><title>cached</title></html>", { status: 200 });

  beforeEach(() => {
    delete process.env.SKIP_EXTERNAL_APIS;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => page()),
    );
  });

  afterEach(() => {
    if (originalSkip === undefined) delete process.env.SKIP_EXTERNAL_APIS;
    else process.env.SKIP_EXTERNAL_APIS = originalSkip;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("scrapes an article once, though its cache file cannot be saved", async () => {
    const url = "https://medium.com/@romainclaret/cache-probe";
    await fetchMediumArticle(url);
    await fetchMediumArticle(url);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("scrapes an article once for requests in flight together", async () => {
    const url = "https://medium.com/@romainclaret/in-flight-probe";
    await Promise.all([fetchMediumArticle(url), fetchMediumArticle(url)]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
