import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";

/**
 * The quality loop ticks once a second and the frame sampler publishes once
 * a second, on clocks of their own. The tick used to read the latest reading
 * whether or not it was new, so one stale reading (after a pause, while the
 * sampler restarts) could be counted as several samples, and three of them
 * under 28 fps are enough for the fast path.
 */

vi.mock("@/components/providers/test-mode-provider", () => ({
  useTestMode: () => ({ isTestMode: false }),
}));
vi.mock("@/lib/quality/probe", () => ({
  probeDeviceOnce: () => ({ weak: false, reason: null, renderer: "Apple M3" }),
}));
vi.mock("@/lib/utils/when-idle", () => ({
  whenIdle: (task: () => void) => {
    task();
    return () => {};
  },
}));
// Slow frames; `fresh` decides whether each second brings a new sample.
const sampler = vi.hoisted(() => ({ fresh: false }));
vi.mock("@/lib/hooks/useFpsOnly", () => ({
  useFpsOnly: () => ({
    fps: 10,
    isLowFps: true,
    refreshRate: 60,
    sample: sampler.fresh ? Math.floor(Date.now() / 1000) : 1,
  }),
}));

import { QualityProvider, useQuality } from "./quality-context";
import { memoryStorage } from "@/test/memory-storage";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36";
const originalUserAgent = navigator.userAgent;

const Quality = () => <div data-testid="quality">{useQuality().quality}</div>;

/** Mount, then let `seconds` of ticks pass, re-rendering every second. */
function run(seconds: number) {
  const view = render(
    <QualityProvider>
      <Quality />
    </QualityProvider>,
  );
  for (let s = 0; s < seconds; s++) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // The real hook re-renders its users on each sample.
    view.rerender(
      <QualityProvider>
        <Quality />
      </QualityProvider>,
    );
  }
  return screen.getByTestId("quality").textContent;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  Object.defineProperty(navigator, "userAgent", {
    value: CHROME,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "userAgent", {
    value: originalUserAgent,
    configurable: true,
  });
});

describe("QualityProvider sample feed", () => {
  it("counts one stale reading once, however many ticks see it", () => {
    sampler.fresh = false;

    expect(run(12)).toBe("balanced");
  });

  it("still acts on slow frames that keep arriving as new samples", () => {
    sampler.fresh = true;

    expect(run(12)).toBe("battery");
  });
});
