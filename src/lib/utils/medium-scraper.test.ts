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
 * The article URL reaches a server-side fetch straight from the rss2json
 * response, so it is third-party input. These tests pin the host guard.
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
});
