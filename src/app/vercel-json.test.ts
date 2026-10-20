import { describe, it, expect } from "vitest";
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * vercel.json as the deploy reads it. Its `functions` block named
 * app/api/fetch-github/route.ts and app/api/medium-posts/route.ts, while
 * the routes live under src/app/api/, so the settings applied to nothing.
 */

const root = process.cwd();
const config = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));

describe("vercel.json", () => {
  it("configures only functions that exist", () => {
    const unmatched = Object.keys(config.functions ?? {}).filter(
      (pattern) => globSync(pattern, { cwd: root }).length === 0,
    );

    expect(unmatched).toEqual([]);
  });

  it("runs the functions on Fluid compute", () => {
    // On Hobby without Fluid a function stops at 10 s by default (60 s at
    // most), which the Medium route's chained fetches can pass; with it,
    // 300 s, and one instance serves concurrent requests, so the in-memory
    // rate limiter sees more of them. The dashboard's setting was nowhere
    // on record.
    expect(config.fluid).toBe(true);
  });
});
