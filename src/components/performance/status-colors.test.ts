import { describe, it, expect } from "vitest";
import colors from "tailwindcss/colors";
import { STATUS_BG, STATUS_TEXT } from "./status-colors";

/**
 * The dashboard's metric values and scores take their colour from their
 * status, and each status only shows when the page measures it: one axe run
 * sees the statuses of that moment. The -500 text it used read at 1.7 to
 * 2.3:1 on its light cards. Every status is measured here, in both themes,
 * on the cards it sits on, against the 3:1 its large values need (24 px
 * bold, WCAG 1.4.3).
 */

type Rgb = [number, number, number];

const fromHex = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const luminance = ([r, g, b]: Rgb) => {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

const contrast = (a: Rgb, b: Rgb) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

/** `color` at `alpha` over `under`. */
const over = (color: Rgb, alpha: number, under: Rgb): Rgb =>
  color.map((c, i) => c * alpha + under[i] * (1 - alpha)) as Rgb;

/** A Tailwind palette colour by its class, "text-green-700" or
 *  "bg-green-500/10" (with its alpha). */
const palette = (className: string): { rgb: Rgb; alpha: number } => {
  const match = /^(?:text|bg)-([a-z]+)-(\d+)(?:\/(\d+))?$/.exec(className);
  if (!match) throw new Error(`Not a palette class: ${className}`);
  const [, family, shade, alpha] = match;
  const scale = colors[family as keyof typeof colors] as Record<string, string>;
  return {
    rgb: fromHex(scale[shade]),
    alpha: alpha ? Number(alpha) / 100 : 1,
  };
};

/** The class a theme applies: its "dark:" one in the dark theme, if it
 *  has one, else the class every theme uses. */
const forTheme = (classes: string, theme: "light" | "dark") => {
  const names = classes.split(" ");
  const base = names.find((name) => !name.includes(":"))!;
  if (theme === "light") return base;
  return names.find((name) => name.startsWith("dark:"))?.slice(5) ?? base;
};

// The cards under a value: the dialog's background, or the active browser
// card (primary at 5% over it). globals.css's tokens: light --background
// white and --primary hsl(217 91% 48%); dark --background hsl(222.2 84%
// 4.9%) and --primary hsl(210 40% 98%).
const SURFACES = {
  light: [fromHex("#ffffff"), over(fromHex("#0b60ea"), 0.05, [255, 255, 255])],
  dark: [
    fromHex("#020817"),
    over(fromHex("#f8fafc"), 0.05, fromHex("#020817")),
  ],
} as const;

describe("the dashboard's status colours", () => {
  for (const status of Object.keys(STATUS_TEXT)) {
    for (const theme of ["light", "dark"] as const) {
      it(`reads at 3:1 or more for "${status}", ${theme} theme`, () => {
        const text = palette(forTheme(STATUS_TEXT[status], theme)).rgb;
        const tint = palette(STATUS_BG[status]);
        for (const surface of SURFACES[theme]) {
          const card = over(tint.rgb, tint.alpha, surface as Rgb);
          expect(contrast(text, card)).toBeGreaterThanOrEqual(3);
        }
      });
    }
  }
});
