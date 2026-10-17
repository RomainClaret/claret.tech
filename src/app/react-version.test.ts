import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The site never runs the installed React: the App Router bundles Next's own
 * build of it (next/dist/compiled), and the installed one only reaches the
 * pages-router fallback chunk, which the homepage never loads. The unit tests
 * do run the installed one. With Next 16.4.1 production ran React 19.3 while
 * every unit test ran 18.3.1, so a test could pass on behaviour the site did
 * not have. Next's vendored package.json has no version, hence the source.
 */

const read = (path: string) =>
  readFileSync(join(process.cwd(), "node_modules", path), "utf8");
const major = (version: string | undefined) => version?.split(".")[0];

describe("the React the unit tests run", () => {
  it.each([
    ["react", "react/cjs/react.production.js"],
    ["react-dom", "react-dom/cjs/react-dom.production.js"],
  ])("%s has the major version Next ships to the site", (name, file) => {
    const vendored = read(`next/dist/compiled/${file}`).match(
      /exports\.version = "([^"]+)"/,
    )?.[1];
    const installed = JSON.parse(read(`${name}/package.json`)).version;

    expect(vendored).toMatch(/^\d+\.\d+\.\d+/);
    expect(major(installed)).toBe(major(vendored));
  });
});
