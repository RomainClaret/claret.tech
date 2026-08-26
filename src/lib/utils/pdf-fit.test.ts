import { describe, it, expect, vi } from "vitest";
import { fitScale, widestPageWidth, MIN_SCALE, MAX_SCALE } from "./pdf-fit";

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

describe("widestPageWidth", () => {
  const pdfOf = (widths: number[]) => ({
    numPages: widths.length,
    getPage: (n: number) =>
      Promise.resolve({
        getViewport: () => ({ width: widths[n - 1] }),
      }),
  });

  it("finds a landscape page buried in a portrait document", async () => {
    // The actual shape of the thesis: portrait throughout, landscape at 56.
    const widths = Array.from({ length: 60 }, (_, i) => (i === 55 ? 841 : 595));

    await expect(widestPageWidth(pdfOf(widths))).resolves.toBe(841);
  });

  it("does not just read the first page", async () => {
    await expect(widestPageWidth(pdfOf([595, 595, 841]))).resolves.toBe(841);
  });

  it("returns the page width for a uniform document", async () => {
    await expect(widestPageWidth(pdfOf([595, 595, 595]))).resolves.toBe(595);
  });

  it("ignores pages it cannot read rather than failing the whole scan", async () => {
    const pdf = {
      numPages: 3,
      getPage: (n: number) =>
        n === 2
          ? Promise.reject(new Error("corrupt page"))
          : Promise.resolve({ getViewport: () => ({ width: 595 }) }),
    };

    await expect(widestPageWidth(pdf)).resolves.toBe(595);
  });

  it("reports 0 when the document cannot be measured at all", async () => {
    const pdf = {
      numPages: 2,
      getPage: vi.fn(() => {
        throw new Error("no document");
      }),
    };

    await expect(widestPageWidth(pdf)).resolves.toBe(0);
  });
});
