import { createRequire } from "node:module";
import { afterEach, describe, it, expect, vi } from "vitest";
import { mediumUsername } from "./medium-username";

const require = createRequire(import.meta.url);
const { mediumRssUrl } = require("../../../scripts/extract-medium-colors.js");

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
describe("the build's Medium colour script", () => {
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
