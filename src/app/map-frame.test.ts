import { describe, it, expect, afterAll } from "vitest";
import { execFile, spawnSync } from "node:child_process";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
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

  // An older deployment sits behind Vercel's protection, which redirects to
  // a login page: followed, the page came back as a map and JSON.parse
  // failed with no word of why (security audit run 1, hardening).
  describe("from a protected deployment", () => {
    const seen: IncomingHttpHeaders[] = [];
    const server = createServer((request, response) => {
      seen.push(request.headers);
      if (request.headers["x-vercel-protection-bypass"] === "dummy-secret") {
        response.end(map.toString());
      } else {
        response.writeHead(302, { location: "https://vercel.com/sso" });
        response.end();
      }
    });
    const origin = new Promise<string>((resolve) =>
      server.listen(0, "127.0.0.1", () =>
        resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
      ),
    );
    afterAll(() => server.close());

    const mapFrameAsync = async (env: Record<string, string>) => {
      const from = await origin;
      return new Promise<{ code: number; stdout: string; stderr: string }>(
        (resolve) => {
          execFile(
            process.execPath,
            [
              script,
              "/_next/static/chunks/app/page-0a1b2c3d4e5f6a7b.js:1:11",
              from,
            ],
            {
              env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
              encoding: "utf8",
            },
            (error, stdout, stderr) =>
              resolve({ code: error ? Number(error.code) : 0, stdout, stderr }),
          );
        },
      );
    };

    it("says what to do, without following the redirect", async () => {
      const result = await mapFrameAsync({});

      expect(result.code).toBe(1);
      expect(result.stderr).toMatch(/VERCEL_AUTOMATION_BYPASS_SECRET/);
    });

    it("passes the protection with the bypass secret", async () => {
      const result = await mapFrameAsync({
        VERCEL_AUTOMATION_BYPASS_SECRET: "dummy-secret",
      });

      expect(result.stdout).toMatch(/Blog\.tsx:291:7/);
      expect(seen.at(-1)?.["x-vercel-protection-bypass"]).toBe("dummy-secret");
    });
  });
});
