import {
  useEffect,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

/**
 * The hero paints its own grid on an opaque background, right over the fixed
 * site grid, so while the hero spans the viewport only the band above it (the
 * 64 px under the navigation, at the top of the page) shows the site grid.
 * Animating the rest cost the most of anything at the top of the page:
 * hiding the covered site grid doubled frame throughput on a software GPU
 * (58 -> 110 fps, SwiftShader at 1440x900).
 *
 * The covering grid registers its <svg> here (useGridCoverRegistration), and
 * the site grid asks how many of its rows still show (useRowsAboveCover). The
 * <svg> is sized to the window while its parent, the grid's root, clips it to
 * the hero, so what it hides is where the two boxes overlap.
 */

let cover: Element | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getCover = () => cover;
const getServerCover = () => null;

/** Register `element` as the cover while `enabled`; null clears it. */
export function useGridCoverRegistration(
  element: Element | null,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled || !element) return;
    cover = element;
    listeners.forEach((listener) => listener());
    return () => {
      if (cover !== element) return;
      cover = null;
      listeners.forEach((listener) => listener());
    };
  }, [element, enabled]);
}

/**
 * How many rows of `cellSize` cells of the grid in `gridRef` still show
 * above the cover, or null while nothing covers it.
 *
 * The cover counts only while it spans the grid's width and reaches its
 * bottom edge. The grid's own box is the measure, not the viewport's: on a
 * phone the fixed grid grows to the large viewport when the URL bar hides,
 * past document.documentElement.clientHeight, and a cover that only reached
 * the smaller height would leave a strip at the bottom clipped yet uncovered.
 * The count rounds up to the next row line, so it can only overstate what
 * shows, and it changes only when a row line is crossed, which keeps
 * re-renders to a few per scroll through the hero.
 */
export function useRowsAboveCover(
  enabled: boolean,
  cellSize: number,
  gridRef: RefObject<Element | null>,
): number | null {
  const element = useSyncExternalStore(subscribe, getCover, getServerCover);
  const [rows, setRows] = useState<number | null>(null);
  // Off, or no cover: no count, from this render on.
  if ((!enabled || !element) && rows !== null) setRows(null);

  useEffect(() => {
    if (!enabled || !element) return;

    const clip = element.parentElement;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const own = element.getBoundingClientRect();
      const clipped = clip?.getBoundingClientRect() ?? own;
      const top = Math.max(own.top, clipped.top);
      const bottom = Math.min(own.bottom, clipped.bottom);
      const left = Math.max(own.left, clipped.left);
      const right = Math.min(own.right, clipped.right);
      const grid = gridRef.current?.getBoundingClientRect();
      if (!grid) return;
      const spans =
        left <= grid.left + 0.5 &&
        right >= grid.right - 0.5 &&
        top < grid.bottom &&
        bottom >= grid.bottom - 0.5;
      // Same value, no re-render: React skips a state set to what it holds.
      setRows(spans ? Math.ceil(Math.max(0, top - grid.top) / cellSize) : null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // The hero grid sizes itself after mount, and the hero can change height.
    // The grid's own box counts too: on a phone the layout viewport is a few
    // px wider for a moment while the page loads, the fixed grid with it, and
    // no resize event follows when it shrinks back. Measured only then, the
    // hero never spanned the grid and the whole site grid kept animating.
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    resizeObserver?.observe(element);
    if (clip) resizeObserver?.observe(clip);
    if (gridRef.current) resizeObserver?.observe(gridRef.current);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resizeObserver?.disconnect();
    };
  }, [enabled, element, cellSize, gridRef]);

  return rows;
}
