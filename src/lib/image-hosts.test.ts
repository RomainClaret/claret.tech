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
  it("fetches only the GitHub avatar", () => {
    expect(nextConfig.images?.remotePatterns).toEqual([
      {
        protocol: "https",
        hostname: "github.com",
        pathname: "/RomainClaret.png",
      },
      {
        // Where github.com/RomainClaret.png redirects (user 8895475).
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/u/8895475",
      },
    ]);
  });

  it("keeps an optimized image for a month", () => {
    // Each cache miss and each stale refresh costs a transformation.
    expect(nextConfig.images?.minimumCacheTTL).toBe(2_678_400);
  });
});
