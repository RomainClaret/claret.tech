import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config.mjs";

/**
 * What Next's image optimizer may fetch, and how long it keeps it. On
 * Vercel's Hobby plan it has 5,000 transformations a month. With any image
 * of Medium, Unsplash or jsDelivr, or any GitHub avatar, allowed, anyone
 * could spend them, and past them every image not yet cached failed until
 * the month ended. The blog's pictures have their own route
 * (src/app/api/blog-image); the optimizer keeps the GitHub avatar alone.
 */
describe("the image optimizer's sources", () => {
  it("fetches no remote image", () => {
    // Even the avatar alone was too much: a pattern pins host and path, not
    // the query, fragment or userinfo, so each spelling of its URL was a new
    // transformation (security audit run 1, lead 11). The avatar is a local
    // file now.
    expect(nextConfig.images?.remotePatterns).toEqual([]);
  });

  it("takes local images from /images only, with no query", () => {
    // Next's default, every local path, made the optimizer fetch PDFs and
    // API routes before refusing them.
    expect(nextConfig.images?.localPatterns).toEqual([
      { pathname: "/images/**", search: "" },
    ]);
  });

  it("keeps an optimized image for a month", () => {
    // Each cache miss and each stale refresh costs a transformation.
    expect(nextConfig.images?.minimumCacheTTL).toBe(2_678_400);
  });
});
