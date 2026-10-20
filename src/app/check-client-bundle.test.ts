import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * .github/scripts/check-client-bundle.mjs fails the build job when a client
 * chunk ships a package client-bundle-deny.json names. Run here on source
 * maps made up for each case, as a build writes them.
 */

const script = join(process.cwd(), ".github/scripts/check-client-bundle.mjs");
const dists: string[] = [];

/** A .next folder whose chunks' maps name these sources. */
function dist(chunks: Record<string, string[]>) {
  const dir = mkdtempSync(join(tmpdir(), "client-bundle-"));
  dists.push(dir);
  for (const [name, sources] of Object.entries(chunks)) {
    const path = join(dir, "static/chunks", `${name}.js.map`);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, JSON.stringify({ version: 3, sources, mappings: "" }));
  }
  return dir;
}

const check = (dir: string) =>
  spawnSync(process.execPath, [script, dir], { encoding: "utf8" });

afterEach(() => {
  for (const dir of dists.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("check-client-bundle.mjs", () => {
  it("passes chunks without a denied package", () => {
    const result = check(
      dist({
        "app/page-0a1b": [
          "webpack://_N_E/./src/app/page.tsx",
          "webpack://_N_E/./node_modules/@vercel/analytics/dist/index.mjs",
        ],
      }),
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/1 client chunks, none with styled-jsx/);
  });

  it("fails on a chunk that ships one, and says which and why", () => {
    const result = check(
      dist({
        "app/page-0a1b": ["webpack://_N_E/./src/app/page.tsx"],
        "3334-cf3b": [
          "webpack://_N_E/./node_modules/next/dist/client/image.js",
          "webpack://_N_E/./node_modules/styled-jsx/dist/index/index.js",
        ],
      }),
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/^3334-cf3b\.js ships styled-jsx: round 26/);
    expect(result.stderr).not.toMatch(/page-0a1b/);
  });

  it("finds a package nested under another's node_modules", () => {
    const result = check(
      dist({
        "642-aa": [
          "webpack://_N_E/./node_modules/next/node_modules/styled-jsx/style.js",
        ],
      }),
    );

    expect(result.status).toBe(1);
  });

  it("takes only a package for a package, not a file named after one", () => {
    const result = check(
      dist({ "8500-bb": ["webpack://_N_E/./src/lib/styled-jsx-notes.ts"] }),
    );

    expect(result.status).toBe(0);
  });

  it("fails on a build without source maps, which it cannot read", () => {
    const empty = mkdtempSync(join(tmpdir(), "client-bundle-"));
    dists.push(empty);
    mkdirSync(join(empty, "static/chunks"), { recursive: true });

    const result = check(empty);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/No source maps/);
  });
});
