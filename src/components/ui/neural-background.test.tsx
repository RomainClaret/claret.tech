import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import React from "react";

/**
 * The hero's neural background spikes its nodes on a timer, which stops
 * while the page is covered (the splash, a modal) or the background is off
 * screen. The nodes kept their deadlines through the stop, so after one
 * longer than the longest interval they all spiked in the same tick.
 */

// Stable across renders, as the real context's state is, and a store, so a
// test can replace the patterns the way a regeneration does.
const background = vi.hoisted(() => {
  const patterns = (nodes: { gridX: number; gridY: number }[]) => ({
    backgroundData: {
      nodes: [],
      curves: [],
      lines: [],
      connections: [],
      neuralPatterns: [{ nodes }],
    },
  });
  const initial = patterns([
    { gridX: 2, gridY: 2 },
    { gridX: 5, gridY: 4 },
  ]);
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    initial,
    patterns,
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
  useAnimationState: () => ({ areAnimationsPlaying: true }),
}));
vi.mock("@/lib/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));
const qualityConfig = { animate: true, nodeScale: 1 };
vi.mock("@/contexts/quality-context", () => ({
  useQuality: () => ({ getConfig: () => qualityConfig }),
  NEURAL_BACKGROUND_PROFILE: {},
}));
vi.mock("./neural-signal", () => ({ NeuralSignal: () => null }));
// Spike intervals drawn in turn from a cycle, so each node of a set gets its
// own whatever the number of sets drawn (the nodes are made twice on mount,
// once more when the first size update lands).
const intervals = vi.hoisted(() => ({ cycle: [1000], drawn: 0 }));
vi.mock("@/lib/utils/neural-animations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/neural-animations")>()),
  getRandomInterval: () =>
    intervals.cycle[intervals.drawn++ % intervals.cycle.length],
}));
const drawFrom = (cycle: number[]) => {
  intervals.cycle = cycle;
  intervals.drawn = 0;
};

import { NeuralBackground } from "./neural-background";
import {
  acquireOverlay,
  resetMotionGateForTests,
} from "@/lib/utils/motion-gate";

/** Spiking nodes pulse. */
const spiking = (container: HTMLElement) =>
  container.querySelectorAll("circle.animate-pulse").length;

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const OriginalIntersectionObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  drawFrom([1000]);
  background.set(background.initial);
  vi.useFakeTimers();
  // The setup file's observer is a vi.fn that mockReset empties.
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
  vi.useRealTimers();
  globalThis.IntersectionObserver = OriginalIntersectionObserver;
  resetMotionGateForTests();
});

describe("NeuralBackground spikes", () => {
  it("does not spike every overdue node at once after a pause", () => {
    // Due at 3 s and 6 s, both come due under a 30 s modal. Their fresh
    // waits (1.5 s and 4 s) keep them apart once it closes.
    drawFrom([3000, 6000]);
    const { container } = render(<NeuralBackground />);
    advance(500);

    let close = () => {};
    act(() => {
      close = acquireOverlay(); // a modal opens
    });
    advance(30_000);
    drawFrom([1500, 4000]);
    act(() => close());

    advance(50);
    expect(spiking(container)).toBe(0);
    advance(1500);
    expect(spiking(container)).toBe(1);
  });

  it("sets no timer while it has no nodes", () => {
    act(() => background.set(background.patterns([])));
    render(<NeuralBackground />);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("spikes nodes it remade when they are due, not on the old timer", () => {
    // The scheduler kept a timer set for the old nodes (due at 10 s), and
    // the new ones, due at 1 s and 2.5 s, waited for it and fired together.
    drawFrom([10_000]);
    const { container } = render(<NeuralBackground />);
    advance(1000); // a timer is set for the old nodes, at 10 s

    drawFrom([1000, 2500]);
    act(() =>
      background.set(
        background.patterns([
          { gridX: 3, gridY: 1 },
          { gridX: 6, gridY: 5 },
        ]),
      ),
    );
    advance(1100);

    expect(spiking(container)).toBe(1);
  });
});
