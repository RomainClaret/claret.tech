import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * The layout's head script wraps Element.prototype.setAttribute so that a
 * circle never gets a radius the browser rejects ("Expected length,
 * \"undefined\""): it runs before any component, so it covers every
 * circle the site draws. The test runs the script as the layout ships it.
 */

const layout = readFileSync(join(__dirname, "layout.tsx"), "utf8");
const guard = [...layout.matchAll(/__html: `([\s\S]*?)`/g)]
  .map((match) => match[1])
  .find((script) => script.includes("__SVG_PROTECTION_ACTIVE__"));

type GuardedWindow = Window & { __SVG_PROTECTION_ACTIVE__?: boolean };

const SVG = "http://www.w3.org/2000/svg";
const circle = () => document.createElementNS(SVG, "circle");

describe("the head script's circle guard", () => {
  const original = Element.prototype.setAttribute;

  beforeAll(() => {
    expect(guard).toBeDefined();
    new Function(guard!)();
  });

  afterAll(() => {
    // Every later test file in this worker gets the real setAttribute back.
    Element.prototype.setAttribute = original;
    delete (window as GuardedWindow).__SVG_PROTECTION_ACTIVE__;
  });

  it.each([undefined, null, "undefined", "null", "NaN", "", "abc"])(
    "gives a circle the fallback radius for %j",
    (value) => {
      const element = circle();
      element.setAttribute("r", value as string);
      expect(element.getAttribute("r")).toBe("4");
    },
  );

  it.each(["3", "2.5", "0"])("keeps a radius of %s", (value) => {
    const element = circle();
    element.setAttribute("r", value);
    expect(element.getAttribute("r")).toBe(value);
  });

  it("leaves other elements and attributes alone", () => {
    const div = document.createElement("div");
    div.setAttribute("r", "abc");
    const element = circle();
    element.setAttribute("cx", "abc");

    expect(div.getAttribute("r")).toBe("abc");
    expect(element.getAttribute("cx")).toBe("abc");
  });

  it("wraps setAttribute once, however often it runs", () => {
    const wrapped = Element.prototype.setAttribute;
    new Function(guard!)();
    expect(Element.prototype.setAttribute).toBe(wrapped);
  });
});
