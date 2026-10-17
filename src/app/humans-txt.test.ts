import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * public/humans.txt names the site's stack by hand, and said "Next.js 15,
 * React 18" a round after both majors moved. Read against what is installed.
 */
const root = process.cwd();
const major = (name: string) =>
  JSON.parse(
    readFileSync(join(root, "node_modules", name, "package.json"), "utf8"),
  ).version.split(".")[0];

describe("humans.txt", () => {
  it("names the Next.js and React majors the site runs", () => {
    const humans = readFileSync(join(root, "public/humans.txt"), "utf8");
    const stack = humans.match(/^Components: (.*)$/m)?.[1] ?? "";

    expect(stack).toContain(`Next.js ${major("next")},`);
    expect(stack).toContain(`React ${major("react")},`);
  });
});
