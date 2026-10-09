import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import React from "react";

/**
 * The hero's brain canvas redraws up to 60 times a second. It stopped for an
 * off-screen hero but kept drawing under the splash and the modals, which
 * cover the page: the hero's main loop, running for nobody.
 */

vi.mock("@/lib/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));
vi.mock("@/contexts/animation-state-context", () => ({
  useAnimationState: () => ({ areAnimationsPlaying: true }),
}));
const qualityConfig = { animate: true, updateFrequency: 60 };
// The tier sets the canvas's backing resolution (LOW draws at half).
const tier = vi.hoisted(() => ({ quality: "balanced" }));
vi.mock("@/contexts/quality-context", () => ({
  useQuality: () => ({
    getConfig: () => qualityConfig,
    quality: tier.quality,
  }),
  NEURAL_CANVAS_PROFILE: {},
  QualityMode: { LOW: "low" },
}));

import { BrainNetworkVisualization } from "./brain-network-visualization";
import {
  acquireOverlay,
  resetMotionGateForTests,
} from "@/lib/utils/motion-gate";

/** Frames drawn: every frame starts by clearing the canvas. */
let draws = 0;

/** jsdom has no 2D canvas: a context that accepts anything, counting frames. */
function fakeContext(): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = {};
  const anything: ProxyHandler<object> = {
    get: (_, prop) =>
      prop in state
        ? state[prop]
        : () => {
            if (prop === "clearRect") draws++;
            return new Proxy({}, anything);
          },
    set: (_, prop, value) => {
      state[prop] = value;
      return true;
    },
  };
  return new Proxy({}, anything) as CanvasRenderingContext2D;
}

const OriginalIntersectionObserver = globalThis.IntersectionObserver;
const originalCreateElement = document.createElement;

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  draws = 0;
  tier.quality = "balanced";
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
      "performance",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  // The setup file's observer is a vi.fn that mockReset empties.
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  document.createElement = ((
    tagName: string,
    options?: ElementCreationOptions,
  ) => {
    const element = originalCreateElement.call(document, tagName, options);
    if (tagName === "canvas") {
      (element as HTMLCanvasElement).getContext = (() =>
        fakeContext()) as unknown as HTMLCanvasElement["getContext"];
    }
    return element;
  }) as typeof document.createElement;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.IntersectionObserver = OriginalIntersectionObserver;
  document.createElement = originalCreateElement;
  resetMotionGateForTests();
});

describe("BrainNetworkVisualization", () => {
  it("stops drawing under the splash or a modal, and resumes after", () => {
    render(<BrainNetworkVisualization width={300} height={300} />);
    advance(1000);
    expect(draws).toBeGreaterThan(10);

    let release = () => {};
    act(() => {
      release = acquireOverlay();
    });
    draws = 0;
    advance(1000);
    expect(draws).toBe(0);

    act(() => release());
    advance(1000);
    expect(draws).toBeGreaterThan(10);
  });
  it("redraws a still frame if the canvas is resized under an overlay", () => {
    // A resize clears the bitmap, and the loop is stopped under an overlay:
    // the brain stayed blank behind it until it closed.
    const view = render(<BrainNetworkVisualization width={300} height={300} />);
    advance(500);
    act(() => {
      acquireOverlay();
    });
    draws = 0;

    tier.quality = "low"; // half the backing resolution
    view.rerender(<BrainNetworkVisualization width={300} height={300} />);

    expect(draws).toBeGreaterThan(0);
  });
});
