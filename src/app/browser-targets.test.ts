import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import postcss from "postcss";
import autoprefixer from "autoprefixer";

/**
 * Which browsers the CSS is written for. With no browserslist, autoprefixer
 * took browserslist's defaults, which follow caniuse's usage data: an update
 * of that data (npm audit fix, round 14) dropped Safari 17, and with it the
 * -webkit-backdrop-filter that Safari and iOS before 18 need, so panels lost
 * their blur there. package.json names Next's own JavaScript targets, and
 * iOS, so the CSS and the JavaScript aim at the same browsers, with Firefox
 * at 128: Tailwind 4's CSS needs it (@property, color-mix), and Next's
 * target for it is 111.
 */
const root = process.cwd();
const targets: string[] =
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")).browserslist ??
  [];

describe("browser targets", () => {
  it("keep the prefix Safari and iOS before 18 need for a blur", async () => {
    const { css } = await postcss([autoprefixer()]).process(
      ".panel { backdrop-filter: blur(4px); }",
      { from: join(root, "src/app/globals.css") },
    );

    expect(css).toContain("-webkit-backdrop-filter: blur(4px)");
  });

  it("are the ones Next builds the JavaScript for, Firefox from 128, and iOS", () => {
    const require = createRequire(join(root, "package.json"));
    const next: string[] = require("next/dist/shared/lib/modern-browserslist-target");
    const firefoxFrom128 = (target: string) => {
      const [browser, version] = target.split(" ");
      return browser === "firefox"
        ? `firefox ${Math.max(128, Number(version))}`
        : target;
    };

    expect(next.length).toBeGreaterThan(0);
    expect(targets).toEqual(expect.arrayContaining(next.map(firefoxFrom128)));
    expect(targets).toContain("ios_saf 16.4");
  });
});
