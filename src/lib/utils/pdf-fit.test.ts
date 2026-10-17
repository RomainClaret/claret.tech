import { describe, it, expect, vi } from "vitest";
import { fitScale, pageSizes, MIN_SCALE, MAX_SCALE } from "./pdf-fit";

/**
 * Numbers here are the real ones measured in the reader: an A4 portrait page
 * is 595pt wide, the same page rotated is 841pt, and a 1152px viewer has
 * 1120px left after its padding.
 */

describe("fitScale", () => {
  it("grows a page that is narrower than the viewer", () => {
    // A4 portrait in a desktop viewer. Left at 1 it used half the pane; the
    // reader fits it to the width instead.
    const scale = fitScale(595, 1120, 1);

    expect(scale).toBeGreaterThan(1);
    expect(595 * scale).toBeLessThanOrEqual(1120);
    // ...and close enough to the edge that the slack is gone.
    expect(595 * scale).toBeGreaterThan(1100);
  });

  it("grows a landscape page that fits, and still never shrinks it", () => {
    const scale = fitScale(841, 1120, 1);

    expect(scale).toBeGreaterThan(1);
    expect(841 * scale).toBeLessThanOrEqual(1120);
  });

  it("does not blow a tiny page up without limit", () => {
    // A thumbnail-sized page in a wide viewer would otherwise reach 20x.
    expect(fitScale(50, 1120, 1)).toBe(MAX_SCALE);
  });

  it("never returns a scale the zoom control cannot reach", () => {
    for (const [content, available] of [
      [50, 1120],
      [595, 1120],
      [100000, 100],
    ] as const) {
      const scale = fitScale(content, available, 1);
      expect(scale).toBeGreaterThanOrEqual(MIN_SCALE);
      expect(scale).toBeLessThanOrEqual(MAX_SCALE);
    }
  });

  it("scales a page down to fit a narrow viewer", () => {
    // 841pt landscape page, 756px available.
    const scale = fitScale(841, 756, 1);

    expect(scale).toBeLessThan(1);
    expect(841 * scale).toBeLessThanOrEqual(756);
  });

  it("rounds down so the result is never a fraction too wide", () => {
    const scale = fitScale(1000, 333, 1);

    expect(scale).toBe(0.33);
    expect(1000 * scale).toBeLessThanOrEqual(333);
  });

  it("compounds with the current scale rather than replacing it", () => {
    // Measuring content already drawn at 2x must not treat it as native size.
    expect(fitScale(1682, 841, 2)).toBe(1);
  });

  it("never zooms out past the readable floor", () => {
    expect(fitScale(100000, 100, 1)).toBe(MIN_SCALE);
  });

  it.each([
    ["zero width", 0, 1120],
    ["negative width", -595, 1120],
    ["zero available", 595, 0],
    ["NaN available", 595, Number.NaN],
  ])("leaves the scale untouched for %s", (_label, content, available) => {
    expect(fitScale(content, available, 1)).toBe(1);
  });
});

describe("pageSizes", () => {
  const pdfOf = (sizes: [number, number][]) => ({
    numPages: sizes.length,
    getPage: (n: number) =>
      Promise.resolve({
        getViewport: () => ({
          width: sizes[n - 1][0],
          height: sizes[n - 1][1],
        }),
      }),
  });

  it("measures every page, in order", async () => {
    // A4 portrait, then the landscape page the thesis turns to.
    await expect(
      pageSizes(
        pdfOf([
          [595, 842],
          [842, 595],
        ]),
      ),
    ).resolves.toEqual([
      { width: 595, height: 842 },
      { width: 842, height: 595 },
    ]);
  });

  it("gives a page it cannot read no size, and keeps the others", async () => {
    const pdf = {
      numPages: 2,
      getPage: (n: number) =>
        n === 1
          ? Promise.reject(new Error("corrupt page"))
          : Promise.resolve({
              getViewport: () => ({ width: 595, height: 842 }),
            }),
    };

    await expect(pageSizes(pdf)).resolves.toEqual([
      { width: 0, height: 0 },
      { width: 595, height: 842 },
    ]);
  });

  it("measures nothing when the document cannot be read", async () => {
    const pdf = {
      numPages: 2,
      getPage: vi.fn(() => {
        throw new Error("no document");
      }),
    };

    await expect(pageSizes(pdf)).resolves.toEqual([]);
  });
});
