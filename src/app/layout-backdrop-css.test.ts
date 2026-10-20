import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * The layout's inline CSS gave every backdrop-blur-* element a near-clear
 * background "for Safari", under @supports not (backdrop-filter: ...).
 * Safari blurs through -webkit-backdrop-filter and took the unprefixed
 * property only in 18, so the block fired on Safari and iOS 16.4 to 17.x,
 * in the browserslist, and on no other supported browser: the floating
 * nav and its tooltips, the modal scrims, the toasts and the cookie notice
 * lost their backgrounds there. A fallback for browsers that cannot blur
 * has to test both forms.
 */

const layout = readFileSync(join(__dirname, "layout.tsx"), "utf8");
const css = [...layout.matchAll(/__html: `([\s\S]*?)`/g)]
  .map((match) => match[1])
  .join("\n");

describe("the layout's inline CSS", () => {
  it("is read from the layout", () => {
    expect(css).toContain("enable-animations");
  });

  it("gives no fallback to browsers that blur through -webkit-backdrop-filter", () => {
    const conditions = [...css.matchAll(/@supports\s+not\s*\(([^{]*)\)\s*\{/g)]
      .map((match) => match[1])
      .filter((condition) => condition.includes("backdrop-filter"));

    expect(
      conditions.filter(
        (condition) => !condition.includes("-webkit-backdrop-filter"),
      ),
    ).toEqual([]);
  });
});
