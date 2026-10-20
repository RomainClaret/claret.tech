import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * The grid's node pulses used to be two SVG <animate> elements per node. In
 * Blink those cost dozens of style recalculations per frame across the two
 * mounted grids, so they are CSS keyframes now (src/styles/motion.css), with
 * each node's phase carried by an inline animation-delay.
 */

const flags = vi.hoisted(() => ({ reducedMotion: false, playing: true }));

// Stable across renders, as the real context's state is: a fresh nodes array
// on every call would re-run the grid's [nodes] effects forever. A store, so
// a test can regenerate the nodes as a resize does.
const background = vi.hoisted(() => {
  const initial = {
    backgroundData: {
      nodes: [
        { x: 1, y: 1, animationDelay: 1.5 },
        { x: 3, y: 2, animationDelay: 0.25 },
      ],
      curves: [],
      lines: [],
      connections: [],
    },
  };
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    initial,
    get: () => value,
    set: (next: typeof initial) => {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
});
vi.mock("@/contexts/background-context", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useBackground: () =>
      useSyncExternalStore(background.subscribe, background.get),
  };
});
vi.mock("@/contexts/animation-state-context", () => ({
  useAnimationState: () => ({ areAnimationsPlaying: flags.playing }),
}));
const qualityConfig = { animate: true, updateFrequency: 10 };
vi.mock("@/contexts/quality-context", () => ({
  useQuality: () => ({ getConfig: () => qualityConfig, quality: "balanced" }),
  GRID_BACKGROUND_PROFILE: {},
}));
vi.mock("@/lib/hooks/useReducedMotion", () => ({
  useReducedMotion: () => flags.reducedMotion,
}));
// Spikes send signals; these tests are about timing, not signal drawing.
vi.mock("./neural-signal", () => ({ StraightSignal: () => null }));
// Every node due one second out, so the scheduler is deterministic.
vi.mock("@/lib/utils/neural-animations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/neural-animations")>()),
  getRandomInterval: () => 1000,
}));

// Rows of the site grid still showing above the hero's grid; null: no cover.
// A store, like the real hook's state: the grid is memoised, so a re-render
// from the test with the same props would not read a plain variable again.
const cover = vi.hoisted(() => {
  let rows: number | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => rows,
    set: (value: number | null) => {
      rows = value;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
});
vi.mock("@/lib/hooks/useGridCover", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useGridCoverRegistration: () => {},
    useRowsAboveCover: (enabled: boolean) => {
      const rows = useSyncExternalStore(cover.subscribe, cover.get);
      return enabled ? rows : null;
    },
  };
});

import { GridBackground } from "./grid-background";
import {
  acquireOverlay,
  resetMotionGateForTests,
} from "@/lib/utils/motion-gate";

// The setup file's IntersectionObserver is a vi.fn that mockReset empties
// before each test; give the grid a plain one and put the original back.
const OriginalIntersectionObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  flags.reducedMotion = false;
  flags.playing = true;
  cover.set(null);
  background.set(background.initial);
  // The spike scheduler re-arms itself every frame; under the setup file's
  // setTimeout-based rAF that is an endless timer chain. Pulses need no frames.
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  globalThis.IntersectionObserver = OriginalIntersectionObserver;
  vi.unstubAllGlobals();
  resetMotionGateForTests();
});

describe("GridBackground's place", () => {
  // Set by the caller: the site grid is fixed to the viewport, the hero's
  // fills the hero. The grid's own `absolute` lost to the site grid's
  // `fixed` only through tailwind-merge, which cn() no longer runs.
  it("takes its position from the caller alone", () => {
    const { container } = render(
      <GridBackground className="fixed inset-0 z-0 opacity-30" />,
    );

    const grid = container.firstElementChild;
    expect(grid).toHaveClass("fixed", "inset-0", "grid-background-container");
    expect(grid).not.toHaveClass("absolute");
  });
});

describe("GridBackground pulses", () => {
  it("animates its nodes with CSS, not SVG <animate>", () => {
    const { container } = render(<GridBackground />);

    expect(container.querySelectorAll("animate")).toHaveLength(0);
    const pulsing = container.querySelectorAll("circle.grid-pulse");
    expect(pulsing).toHaveLength(2);
    expect(
      Array.from(pulsing, (c) => (c as SVGElement).style.animationDelay),
    ).toEqual(["1.5s", "0.25s"]);
  });

  it("waits for the next spike on a timer instead of polling every frame", () => {
    // The scheduler used to check every animation frame, which kept the
    // browser producing a frame per vsync though spikes are seconds apart.
    vi.useFakeTimers();
    try {
      const raf = vi.fn(() => 0);
      vi.stubGlobal("requestAnimationFrame", raf);
      const { container } = render(<GridBackground />);
      expect(container.querySelectorAll("circle.grid-pulse")).toHaveLength(2);

      // Both nodes are due at 1 s and spike for 300 ms.
      act(() => {
        vi.advanceTimersByTime(1100);
      });
      expect(container.querySelectorAll("circle.grid-pulse")).toHaveLength(0);
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(2);

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(container.querySelectorAll("circle.grid-pulse")).toHaveLength(2);
      expect(raf).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("settles the nodes caught mid-spike when the page pauses", () => {
    // Pausing tears the scheduler down and with it the timeouts that end a
    // spike; nodes caught mid-spike stayed spiking (large, no pulse) for good.
    vi.useFakeTimers();
    try {
      const { container } = render(<GridBackground />);
      act(() => {
        vi.advanceTimersByTime(1100); // both nodes spike at 1 s, for 300 ms
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(2);

      let release = () => {};
      act(() => {
        release = acquireOverlay(); // a modal opens
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(0);
      expect(container.querySelectorAll("circle.grid-pulse")).toHaveLength(2);

      // And they spike again once the page runs again.
      act(() => release());
      act(() => {
        vi.advanceTimersByTime(1100);
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not spike every overdue node at once after a pause", () => {
    // Both nodes come due (at 1 s) under a 30 s modal. They get a fresh
    // wait instead of spiking together the moment it closes.
    vi.useFakeTimers();
    try {
      const { container } = render(<GridBackground />);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      let close = () => {};
      act(() => {
        close = acquireOverlay();
      });
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      act(() => close());

      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(0);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("holds the nodes still for reduced motion and when animations are off", () => {
    flags.reducedMotion = true;
    const reduced = render(<GridBackground />);
    expect(
      reduced.container.querySelectorAll("circle.grid-pulse"),
    ).toHaveLength(0);
    reduced.unmount();

    flags.reducedMotion = false;
    flags.playing = false;
    const stopped = render(<GridBackground />);
    expect(
      stopped.container.querySelectorAll("circle.grid-pulse"),
    ).toHaveLength(0);
  });
});

describe("GridBackground under a cover", () => {
  // The test nodes sit in rows 1 and 2. With one row showing above the
  // cover, row 1 sits on its edge and shows; row 2 is hidden.
  const nodeGroups = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("circle.fill-orange-500\\/60"), (c) =>
      c.parentElement?.getAttribute("data-anim"),
    );

  it("clips itself to the band still showing and rests the nodes below", () => {
    cover.set(1);
    const { container } = render(<GridBackground restUnderCover />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.clipPath).toBe("inset(0 0 calc(100% - 64px) 0)");
    expect(nodeGroups(container)).toEqual([null, "off"]);
  });

  it("draws everything while nothing covers it", () => {
    const { container } = render(<GridBackground restUnderCover />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.clipPath).toBe("");
    expect(nodeGroups(container)).toEqual([null, null]);
  });

  it("spikes only the nodes that show, and a hidden one once it shows", () => {
    vi.useFakeTimers();
    try {
      cover.set(1);
      const { container } = render(<GridBackground restUnderCover />);

      // Both nodes come due at 1 s; only the one in the band spikes.
      act(() => {
        vi.advanceTimersByTime(1100);
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(1);

      // The cover lifts: the parked node gets a fresh wait (1 s here)
      // instead of spiking the moment it shows.
      act(() => cover.set(null));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(0);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sets no timer while there is nothing to wait for", () => {
    // No nodes (on /pdf/<slug> there is no background at all), then every
    // node mid-spike: the scheduler used to poll every 250 ms through both.
    vi.useFakeTimers();
    try {
      background.set({
        ...background.initial,
        backgroundData: { ...background.initial.backgroundData, nodes: [] },
      });
      const empty = render(<GridBackground />);
      expect(vi.getTimerCount()).toBe(0);
      empty.unmount();

      background.set(background.initial);
      const { container } = render(<GridBackground />);
      act(() => {
        vi.advanceTimersByTime(1100); // both spike, for 300 ms
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(2);
      expect(vi.getTimerCount()).toBe(2); // their reset timers, and no poll
    } finally {
      vi.useRealTimers();
    }
  });

  it("sets no timer while every waiting node is parked", () => {
    // Parked nodes wait for the cover to move, which wakes the scheduler;
    // a timer meanwhile only scanned the nodes four times a second.
    vi.useFakeTimers();
    try {
      cover.set(0); // both nodes hidden
      const { container } = render(<GridBackground restUnderCover />);
      act(() => {
        vi.advanceTimersByTime(1100); // both come due and park
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);

      // The cover lifts: both get a fresh wait and spike after it.
      act(() => cover.set(null));
      act(() => {
        vi.advanceTimersByTime(1100);
      });
      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("spikes regenerated nodes even when every old one was parked", () => {
    // A resize regenerates the nodes. With the old ones all parked the
    // scheduler sets no timer, so it has to see the new ones at once.
    vi.useFakeTimers();
    try {
      cover.set(0);
      const { container } = render(<GridBackground restUnderCover />);
      act(() => {
        vi.advanceTimersByTime(1100); // both park
      });

      act(() =>
        background.set({
          ...background.initial,
          backgroundData: {
            ...background.initial.backgroundData,
            nodes: [{ x: 2, y: 0, animationDelay: 0 }], // row 0 shows
          },
        }),
      );
      act(() => {
        vi.advanceTimersByTime(1100);
      });

      expect(container.querySelectorAll("circle.grid-burst")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
