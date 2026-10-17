import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * .github/scripts/check-static-home.mjs fails the build job when the
 * homepage stops being a static file. Run here on the manifests a build
 * writes, made up for each case.
 */

const script = join(process.cwd(), ".github/scripts/check-static-home.mjs");
const dists: string[] = [];

function dist({
  prerendered = ["/"],
  middleware = {},
  functions = {},
}: {
  prerendered?: string[];
  middleware?: Record<string, unknown>;
  functions?: Record<string, unknown>;
}) {
  const dir = mkdtempSync(join(tmpdir(), "static-home-"));
  dists.push(dir);
  mkdirSync(join(dir, "server"));
  writeFileSync(
    join(dir, "prerender-manifest.json"),
    JSON.stringify({
      routes: Object.fromEntries(prerendered.map((route) => [route, {}])),
    }),
  );
  writeFileSync(
    join(dir, "server/middleware-manifest.json"),
    JSON.stringify({ middleware }),
  );
  writeFileSync(
    join(dir, "server/functions-config-manifest.json"),
    JSON.stringify({ version: 1, functions }),
  );
  return dir;
}

const check = (dir: string) => {
  const run = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  return { code: run.status, output: run.stdout + run.stderr };
};

afterEach(() => {
  for (const dir of dists.splice(0)) rmSync(dir, { recursive: true });
});

describe("check-static-home", () => {
  it("passes a prerendered homepage with nothing in front of it", () => {
    expect(check(dist({})).code).toBe(0);
  });

  it("fails when / is not prerendered", () => {
    const run = check(dist({ prerendered: ["/pdf/cv"] }));

    expect(run.code).toBe(1);
    expect(run.output).toMatch(/\/ is not prerendered/);
  });

  it("fails on an edge middleware", () => {
    const run = check(dist({ middleware: { "/": {} } }));

    expect(run.code).toBe(1);
    expect(run.output).toMatch(/a middleware runs on: \//);
  });

  it("fails on a proxy, which Next 16 records with the functions", () => {
    // proxy.ts, Next 16's name for a middleware, runs on Node.js and leaves
    // middleware-manifest.json empty: the guard read only that, so a proxy
    // that returned passed the build.
    const run = check(
      dist({
        functions: {
          "/_middleware": {
            runtime: "nodejs",
            matchers: [{ regexp: "^.*$", originalSource: "/:path*" }],
          },
        },
      }),
    );

    expect(run.code).toBe(1);
    expect(run.output).toMatch(
      /a proxy or Node.js middleware runs on: \/:path\*/,
    );
  });
});
