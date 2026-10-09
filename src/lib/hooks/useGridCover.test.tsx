import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import React from "react";
import { useGridCoverRegistration, useRowsAboveCover } from "./useGridCover";

/**
 * The hero's opaque grid covers the fixed site grid. The site grid learns
 * how many of its 64 px rows still show above the cover, so it can rest and
 * clip the rest.
 */

const VIEWPORT = { width: 1440, height: 900 };

type Box = { top: number; bottom: number; left: number; right: number };

/** An element whose box is whatever `box` holds at measuring time. */
function boxed(element: HTMLElement, box: () => Box) {
  element.getBoundingClientRect = () => {
    const { top, bottom, left, right } = box();
    return {
      top,
      bottom,
      left,
      right,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

function Cover({ element }: { element: Element }) {
  useGridCoverRegistration(element, true);
  return null;
}

let frames: FrameRequestCallback[] = [];
const flushFrames = () =>
  act(() => {
    const pending = frames;
    frames = [];
    pending.forEach((callback) => callback(0));
  });

let svgBox: Box;
let rootBox: Box;
let gridBox: Box;
let root: HTMLElement;
let svg: HTMLElement;
// The fixed site grid being clipped; its box is what the cover must reach.
const grid = { current: document.createElement("div") };

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  // The setup's ResizeObserver mock loses its methods to mockReset.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: VIEWPORT.width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: VIEWPORT.height,
    configurable: true,
  });

  // The hero at the top of the page: it starts under the 64 px navigation,
  // its grid's <svg> is window-sized, and the grid's root clips it.
  root = document.createElement("div");
  svg = document.createElement("div");
  root.appendChild(svg);
  document.body.appendChild(root);
  svgBox = { top: 64, bottom: 964, left: 0, right: 1440 };
  rootBox = { top: 64, bottom: 1000, left: 0, right: 1440 };
  gridBox = { top: 0, bottom: 900, left: 0, right: 1440 };
  boxed(svg, () => svgBox);
  boxed(root, () => rootBox);
  boxed(grid.current, () => gridBox);
});

afterEach(() => {
  root.remove();
  vi.unstubAllGlobals();
  // Drop the own properties so jsdom's getters show through again.
  delete (document.documentElement as { clientWidth?: number }).clientWidth;
  delete (document.documentElement as { clientHeight?: number }).clientHeight;
});

const scrollBy = (pixels: number) => {
  for (const box of [svgBox, rootBox]) {
    box.top -= pixels;
    box.bottom -= pixels;
  }
  window.dispatchEvent(new Event("scroll"));
  flushFrames();
};

describe("useRowsAboveCover", () => {
  it("is null while nothing covers the grid", () => {
    const { result } = renderHook(() => useRowsAboveCover(true, 64, grid));

    expect(result.current).toBeNull();
  });

  it("counts the rows above a cover that reaches the viewport's bottom", () => {
    render(<Cover element={svg} />);
    const { result } = renderHook(() => useRowsAboveCover(true, 64, grid));

    // Only the band under the navigation shows: row 0, and row 1 on its edge.
    expect(result.current).toBe(1);
  });

  it("follows the cover as the page scrolls", () => {
    render(<Cover element={svg} />);
    const { result } = renderHook(() => useRowsAboveCover(true, 64, grid));

    scrollBy(64); // the hero reaches the top: nothing of the grid shows
    expect(result.current).toBe(0);

    scrollBy(1); // the hero's grid ends above the viewport's bottom edge
    expect(result.current).toBeNull();
  });

  it("measures the cover where its parent clips it", () => {
    // A hero shorter than the window: the <svg> overhangs it, but only the
    // part inside the grid's root paints.
    rootBox = { top: 64, bottom: 700, left: 0, right: 1440 };
    render(<Cover element={svg} />);
    const { result } = renderHook(() => useRowsAboveCover(true, 64, grid));

    expect(result.current).toBeNull();
  });

  it("measures against the grid, not the small viewport", () => {
    // A phone with its URL bar hidden: the fixed grid reaches 900 px, past
    // clientHeight (the small viewport, 844 px here), and the hero ends at
    // 880. Measured against clientHeight the hero "spanned" the screen and
    // the grid was clipped, leaving the bottom 20 px with no grid at all.
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 844,
      configurable: true,
    });
    svgBox = { top: 64, bottom: 880, left: 0, right: 1440 };
    rootBox = { top: 64, bottom: 880, left: 0, right: 1440 };
    render(<Cover element={svg} />);
    const { result } = renderHook(() => useRowsAboveCover(true, 64, grid));

    expect(result.current).toBeNull();
  });

  it("measures again when the grid's own box changes", () => {
    // A phone while it loads: the layout viewport is briefly a few px wider
    // than the screen, the fixed grid with it, and no resize event follows
    // when it shrinks back. Measured only then, the hero never "spanned"
    // the grid, and the whole site grid kept animating under it.
    const watched: { targets: Element[]; callback: () => void }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        private entry: { targets: Element[]; callback: () => void };
        constructor(callback: () => void) {
          this.entry = { targets: [], callback };
          watched.push(this.entry);
        }
        observe(target: Element) {
          this.entry.targets.push(target);
        }
        unobserve() {}
        disconnect() {
          this.entry.targets = [];
        }
      },
    );
    gridBox = { top: 0, bottom: 909, left: 0, right: 1444 };
    render(<Cover element={svg} />);
    const { result } = renderHook(() => useRowsAboveCover(true, 64, grid));
    expect(result.current).toBeNull();

    gridBox = { top: 0, bottom: 900, left: 0, right: 1440 };
    watched
      .filter(({ targets }) => targets.includes(grid.current))
      .forEach(({ callback }) => callback());
    flushFrames();

    expect(result.current).toBe(1);
  });

  it("is null when disabled", () => {
    render(<Cover element={svg} />);
    const { result } = renderHook(() => useRowsAboveCover(false, 64, grid));

    expect(result.current).toBeNull();
  });

  it("lets go when the cover unmounts", () => {
    const cover = render(<Cover element={svg} />);
    const { result } = renderHook(() => useRowsAboveCover(true, 64, grid));
    expect(result.current).toBe(1);

    cover.unmount();

    expect(result.current).toBeNull();
  });
});
