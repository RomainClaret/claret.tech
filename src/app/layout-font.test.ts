import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ranges from "@/lib/fonts/montserrat-ranges.json";

/**
 * The site preloads only the Latin part of Montserrat and declares the full
 * font for every other character (scripts/subset-montserrat.py). next/font
 * accepts literals only, so layout.tsx repeats the Latin range by hand; if
 * it drifted from the subset, characters in the gap would render in the
 * fallback font, or two faces would claim the same character.
 */

const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

function points(list: string): Set<number> {
  const out = new Set<number>();
  for (const part of list.split(",")) {
    const [low, high = low] = part.trim().replace("U+", "").split("-");
    for (let p = parseInt(low, 16); p <= parseInt(high, 16); p++) out.add(p);
  }
  return out;
}

describe("Montserrat's two faces", () => {
  it("preloads the Latin range the subset was cut to", () => {
    const literal = layout.match(
      /prop: "unicode-range",\s*value:\s*"([^"]+)"/,
    )?.[1];

    expect(literal).toBe(ranges.latin);
  });

  it("leaves the full font only what the subset does not have", () => {
    const latin = points(ranges.latin);
    const shared = [...points(ranges.rest)].filter((p) => latin.has(p));

    expect(shared).toEqual([]);
  });
});
