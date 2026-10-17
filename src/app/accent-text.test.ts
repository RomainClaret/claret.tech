import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import precomputedColors from "@/lib/utils/precomputed-colors.json";
import { adjustColorBrightness } from "@/lib/hooks/useColorExtraction";
import { workExperiences } from "@/data/sections/experience";
import { researchSection } from "@/data/sections/research";
import { languageColors } from "@/lib/utils/language-colors";

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

const rgb = (color: string): Rgb => {
  const match = /rgb\((\d+), (\d+), (\d+)\)/.exec(color);
  if (!match) throw new Error(`Not an rgb() colour: ${color}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

describe("accent text in a company's colour", () => {
  // Experience cards write dates, links and tags in their company's logo
  // colour (precomputed-colors.json), doubled in brightness on the dark
  // theme (ExperienceTimeline.tsx). The navy brands need that doubling to
  // read on the dark background even through the mix.
  const light = mix(".accent-text");
  const dark = mix(".dark .accent-text");
  const logos = new Set(
    workExperiences.experience.map((role) => role.companyLogo),
  );

  for (const logo of logos) {
    it(`reads at 4.5:1 or more for ${logo}, both themes`, () => {
      const color = precomputedColors[logo as keyof typeof precomputedColors];
      expect(color).toBeDefined();

      const onLight = blend(rgb(color), light.share, light.toward);
      for (const surface of [WHITE, SLATE_50]) {
        expect(contrast(onLight, surface)).toBeGreaterThanOrEqual(4.5);
      }
      const doubled = rgb(adjustColorBrightness(color, 2.0));
      const onDark = blend(doubled, dark.share, dark.toward);
      expect(contrast(onDark, DARK)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// The surfaces a colour's text sits on: the page and its own 10 and 20%
// tints (a chip's or a card's background), for each theme.
function worstContrast(
  color: Rgb,
  light: ReturnType<typeof mix>,
  dark: ReturnType<typeof mix>,
) {
  const onLight = blend(color, light.share, light.toward);
  const onDark = blend(color, dark.share, dark.toward);
  return Math.min(
    ...[
      WHITE,
      SLATE_50,
      blend(color, 0.1, WHITE),
      blend(color, 0.2, WHITE),
    ].map((surface) => contrast(onLight, surface)),
    ...[DARK, blend(color, 0.1, DARK), blend(color, 0.2, DARK)].map((surface) =>
      contrast(onDark, surface),
    ),
  );
}

describe("accent text in a research project's colour", () => {
  // Research cards write their technologies in the project's colour
  // (research.ts), on a tint of it: read from the data, so a new colour
  // there is checked here.
  const light = mix(".accent-text");
  const dark = mix(".dark .accent-text");

  for (const project of researchSection.projects) {
    it(`reads at 4.5:1 or more for ${project.title}, both themes`, () => {
      const color = rgb(`rgb(${project.color ?? "139, 92, 246"})`);

      expect(worstContrast(color, light, dark)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("accent text in any colour", () => {
  // The project dialog writes topics in the repository's language colour,
  // which GitHub gives: no list here can hold them all. .accent-text-any is
  // checked on every colour of a 16-step sample of the colour cube, its
  // corners included (white on light and black on dark are the worst).
  const light = mix(".accent-text-any");
  const dark = mix(".dark .accent-text-any");
  const steps = Array.from({ length: 16 }, (_, i) => i * 17);

  it("reads at 4.5:1 or more for any colour, both themes", () => {
    const short: string[] = [];
    for (const r of steps) {
      for (const g of steps) {
        for (const b of steps) {
          const worst = worstContrast([r, g, b], light, dark);
          if (worst < 4.5) short.push(`${r}, ${g}, ${b}: ${worst.toFixed(2)}`);
        }
      }
    }

    expect(short).toEqual([]);
  });

  it("is needed: .accent-text falls short for some language colours", () => {
    // Lua's navy, Crystal's black and Ruby's dark red on the dark theme,
    // JSON's near-white on the light one.
    const light = mix(".accent-text");
    const dark = mix(".dark .accent-text");
    const short = Object.entries(languageColors)
      .filter(
        ([, color]) => worstContrast(rgb(`rgb(${color})`), light, dark) < 4.5,
      )
      .map(([name]) => name);

    expect(short.length).toBeGreaterThan(0);
  });
});
