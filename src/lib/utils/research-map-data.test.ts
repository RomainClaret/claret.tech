import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import mapData from "@/data/research-map.json";
import { buildResearchGraph, parseMapConfig } from "./graph-algorithms";
import { STATIC_PUBLICATIONS } from "@/lib/api/fetch-publications";
import { papersSection } from "@/data/sections/papers";
import { researchSection } from "@/data/sections/research";

/**
 * src/data/research-map.json, the research map's hand-edited data: what it
 * names must exist, its relations must not loop, and its lane colours must
 * stand out on both themes. The map leaves out what it cannot use rather
 * than break, so a slip there shows here and not on the page.
 */

const config = parseMapConfig(mapData);
const graph = buildResearchGraph({
  publications: STATIC_PUBLICATIONS,
  papers: papersSection.papersCards,
  projects: researchSection.projects,
  config,
  now: new Date().getFullYear(),
});
const shown = new Set(graph.nodes.map((node) => node.id));

type Rgb = [number, number, number];

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
const hex = (color: string): Rgb =>
  [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16)) as Rgb;
const hsl = (h: number, s: number, l: number): Rgb => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
};

/** A theme's --background, read from globals.css. */
const background = (selector: string): Rgb => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const block = css.slice(css.indexOf(`${selector} {`));
  const match = /--background:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/.exec(block);
  if (!match) throw new Error(`No --background under ${selector}`);
  return hsl(Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100);
};

describe("src/data/research-map.json", () => {
  it("loses nothing when the map reads it", () => {
    expect(config.lanes).toHaveLength(mapData.lanes.length);
    expect(config.relations).toHaveLength(mapData.relations.length);
    expect(Object.keys(config.labels)).toHaveLength(
      Object.keys(mapData.labels).length,
    );
  });

  it("names only items the map shows", () => {
    const named = [
      ...config.lanes.flatMap((lane) => lane.members),
      ...Object.keys(config.labels),
      ...config.relations.flatMap((relation) => [relation.from, relation.to]),
    ];

    expect(named.filter((id) => !shown.has(id))).toEqual([]);
  });

  it("has one id per lane, one fallback lane, and puts each item in a lane", () => {
    const ids = config.lanes.map((lane) => lane.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(config.lanes.filter((lane) => lane.fallback)).toHaveLength(1);
    expect(graph.nodes.filter((node) => !ids.includes(node.lane))).toEqual([]);
  });

  it("has no loop among the relations that point", () => {
    const pointing = config.relations.filter(
      (relation) => relation.kind !== "companion",
    );
    const next = new Map<string, string[]>();
    for (const { from, to } of pointing) {
      next.set(from, [...(next.get(from) ?? []), to]);
    }
    const reaches = (start: string, goal: string, seen = new Set<string>()) => {
      for (const id of next.get(start) ?? []) {
        if (id === goal) return true;
        if (!seen.has(id)) {
          seen.add(id);
          if (reaches(id, goal, seen)) return true;
        }
      }
      return false;
    };

    expect(
      pointing
        .filter(({ from }) => reaches(from, from))
        .map(({ from }) => from),
    ).toEqual([]);
  });

  it("keeps em and en dashes out of its words", () => {
    const words = [
      ...config.lanes.map((lane) => lane.label),
      ...Object.values(config.labels),
      ...config.relations.map((relation) => relation.note),
    ];

    expect(words.filter((text) => /[\u2013\u2014]/.test(text))).toEqual([]);
  });

  it("colours every lane at 3:1 or more against both themes", () => {
    // Lane colours draw the dots, rings and lines, which are not text:
    // WCAG's 3:1 for graphics, on the light and the dark background.
    const light = background(":root");
    const dark = background(".dark");
    expect(light).toEqual([255, 255, 255]);

    const weak = config.lanes.flatMap((lane) => {
      const color = hex(lane.color);
      const low = Math.min(contrast(color, light), contrast(color, dark));
      return low < 3 ? [`${lane.id} ${lane.color} ${low.toFixed(2)}:1`] : [];
    });
    expect(weak).toEqual([]);
  });
});
