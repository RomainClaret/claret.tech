import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Text in a colour that comes from data (a paper's status, a project's
 * colour) goes through globals.css's `.accent-text`, which mixes the colour
 * with black on the light theme and with white on the dark one. Used as
 * they were, these colours read at 1.5 to 4.3:1 on their own light tints.
 * The mix is read from globals.css and checked here, for every data colour
 * the site uses, on the surfaces it sits on: 4.5:1 for small text.
 */

type Rgb = [number, number, number];

const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const mix = (selector: string) => {
  const rule = new RegExp(
    `${selector.replace(".", "\\.")}\\s*\\{\\s*color:\\s*color-mix\\(in srgb, var\\(--accent\\) (\\d+)%, (black|white)\\);`,
  ).exec(css);
  if (!rule) throw new Error(`No ${selector} color-mix rule in globals.css`);
  return {
    share: Number(rule[1]) / 100,
    toward: (rule[2] === "black" ? [0, 0, 0] : [255, 255, 255]) as Rgb,
  };
};

const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
const blend = (color: Rgb, share: number, other: Rgb): Rgb =>
  color.map((c, i) => c * share + other[i] * (1 - share)) as Rgb;

// The colours the site's data gives text (Papers, Research, the blog
// cards, the certification timeline): Tailwind's -500/-600 hues.
const DATA_COLOURS: Record<string, Rgb> = {
  blue: [59, 130, 246],
  teal: [20, 184, 166],
  violet: [139, 92, 246],
  green: [34, 197, 94],
  gray: [107, 114, 128],
  amber: [245, 158, 11],
  yellow: [250, 204, 21],
  orange: [234, 88, 12],
  pink: [197, 60, 106],
  emerald: [16, 185, 129],
  red: [239, 68, 68],
};

const WHITE: Rgb = [255, 255, 255];
const SLATE_50: Rgb = [248, 250, 252];
const DARK: Rgb = [2, 8, 23]; // --background, dark theme

describe("accent text", () => {
  const light = mix(".accent-text");
  const dark = mix(".dark .accent-text");

  for (const [name, color] of Object.entries(DATA_COLOURS)) {
    it(`reads at 4.5:1 or more in ${name}, both themes`, () => {
      const onLight = blend(color, light.share, light.toward);
      for (const surface of [
        WHITE,
        SLATE_50,
        blend(color, 0.1, WHITE),
        blend(color, 0.2, WHITE),
      ]) {
        expect(contrast(onLight, surface)).toBeGreaterThanOrEqual(4.5);
      }
      const onDark = blend(color, dark.share, dark.toward);
      for (const surface of [
        DARK,
        blend(color, 0.1, DARK),
        blend(color, 0.2, DARK),
      ]) {
        expect(contrast(onDark, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
