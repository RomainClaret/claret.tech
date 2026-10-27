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

  it("turns Vercel's Git deployments off, by both keys", () => {
    // Deploys go through deploy.yml alone, after CI and the browser tests.
    // Vercel reads this file from the commit it would build, so a pull
    // request could flip one key in its own tree; the project's Git link is
    // removed too (2026-10-27, security audit run 1, lead 3), and both keys
    // keep the switch if it is ever connected again. `git` is the documented
    // successor of `github`.
    expect(config.github?.enabled).toBe(false);
    expect(config.git?.deploymentEnabled).toBe(false);
  });

  it("installs from the lockfile", () => {
    // Without it, the install inside `vercel build` followed the project's
    // dashboard setting at deploy time (npm install, which may move off the
    // lockfile).
    expect(config.installCommand).toBe("npm ci");
  });
});
