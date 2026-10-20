import { describe, it, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SourceMapGenerator } from "source-map-js";

/**
 * scripts/map-frame.mjs turns a client error report's frame (a minified
 * chunk's line and column) into a source file and line, from the chunk's
 * published map. Run here on a .next folder holding one small map.
 */

const script = join(process.cwd(), "scripts/map-frame.mjs");
const dir = mkdtempSync(join(tmpdir(), "map-frame-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// The chunk's line 1, column 11 (0-based 10) was written from
// src/components/sections/Blog.tsx, line 291, column 7 (0-based 6).
const map = new SourceMapGenerator({ file: "page-0a1b2c3d4e5f6a7b.js" });
map.addMapping({
  generated: { line: 1, column: 10 },
  original: { line: 291, column: 6 },
  source: "webpack://_N_E/./src/components/sections/Blog.tsx",
  name: "renderKudos",
});
mkdirSync(join(dir, "static/chunks/app/pdf/[slug]"), { recursive: true });
writeFileSync(
  join(dir, "static/chunks/app/page-0a1b2c3d4e5f6a7b.js.map"),
  map.toString(),
);
writeFileSync(
  join(dir, "static/chunks/app/pdf/[slug]/page-0a1b2c3d4e5f6a7b.js.map"),
  map.toString(),
);

const mapFrame = (...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

describe("map-frame.mjs", () => {
  it("names the source line of a reported frame", () => {
    const result = mapFrame(
      "/_next/static/chunks/app/page-0a1b2c3d4e5f6a7b.js:1:11",
      dir,
    );

    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "webpack://_N_E/src/components/sections/Blog.tsx:291:7 (renderKudos)\n",
    );
  });

  it("reads a dynamic route's chunk, encoded as in the report", () => {
    const result = mapFrame(
      "/_next/static/chunks/app/pdf/%5Bslug%5D/page-0a1b2c3d4e5f6a7b.js:1:11",
      dir,
    );

    expect(result.stdout).toMatch(/Blog\.tsx:291:7/);
  });

  it("refuses what is not a frame", () => {
    const result = mapFrame("/etc/passwd:1:1", dir);

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/^usage:/);
  });
});
