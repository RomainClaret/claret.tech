import { createRequire } from "node:module";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { mediumUsername } from "./medium-username";

const require = createRequire(import.meta.url);
const {
  extractMediumColors,
  mediumRssUrl,
} = require("../../../scripts/extract-medium-colors.js");

// Medium's URLs carry their own "@", and the old .env.example asked for one
// in the variable as well.
const cases: [string, string][] = [
  ["romainclaret", "romainclaret"],
  ["@romainclaret", "romainclaret"],
  ["  @someone ", "someone"],
  ["@", "romainclaret"],
  ["", "romainclaret"],
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mediumUsername", () => {
  it.each(cases)("reads %j as %s", (value, expected) => {
    expect(mediumUsername(value)).toBe(expected);
  });

  it("reads NEXT_PUBLIC_MEDIUM_USERNAME by default", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIUM_USERNAME", "@fromenv");

    expect(mediumUsername()).toBe("fromenv");
  });
});

// scripts/extract-medium-colors.js runs before the build, as plain Node, and
// fetches the same feed.
describe("the build's Medium color script", () => {
  it.each(cases)("reads %j as %s too", (value, expected) => {
    expect(mediumRssUrl(value)).toBe(
      `https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@${expected}`,
    );
  });

  it("reads NEXT_PUBLIC_MEDIUM_USERNAME by default", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIUM_USERNAME", "@fromenv");

    expect(mediumRssUrl()).toBe(
      "https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@fromenv",
    );
  });
});

// The color map is tracked, and the script runs before every build: a map
// more than a day old is fetched again. A failed feed (offline, or rss2json
// refusing) used to write {} over it.
describe("the build's Medium color map", () => {
  const twoDaysAgo = () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  let file: string;

  beforeEach(() => {
    file = join(mkdtempSync(join(tmpdir(), "medium-colors-")), "map.json");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(join(file, ".."), { recursive: true, force: true });
  });

  it.each([
    ["the network fails", () => Promise.reject(new Error("offline"))],
    [
      "rss2json refuses",
      () => Promise.resolve({ json: async () => ({ status: "error" }) }),
    ],
  ])("keeps the saved map when %s", async (_, answer) => {
    const saved = `${JSON.stringify({ post: { color: "rgb(1, 2, 3)" } })}\n`;
    writeFileSync(file, saved);
    utimesSync(file, twoDaysAgo(), twoDaysAgo());
    vi.stubGlobal("fetch", vi.fn(answer));

    await extractMediumColors(file);

    expect(readFileSync(file, "utf8")).toBe(saved);
  });

  it("writes an empty map when there is none, for Blog.tsx's import", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    await extractMediumColors(file);

    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({});
  });
});
