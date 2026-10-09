import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";

/**
 * Switching the auto loop off and back on at the same tier used to keep the
 * sample window from before: a few slow seconds from minutes ago, one
 * verdict short of a drop, and the first new sample, good or not, dropped
 * the tier.
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
const toasts = vi.hoisted(() => ({ shown: [] as string[] }));
vi.mock("@/components/ui/toast", () => ({
  showToast: (message: string) => {
    toasts.shown.push(message);
  },
}));
// A new sample every second, at whatever rate the test sets.
const sampler = vi.hoisted(() => ({ fps: 60 }));
vi.mock("@/lib/hooks/useFpsOnly", () => ({
  useFpsOnly: () => ({
    fps: sampler.fps,
    isLowFps: sampler.fps < 30,
    refreshRate: 60,
    sample: Math.floor(Date.now() / 1000),
  }),
}));

import { QualityProvider, useQuality } from "./quality-context";
import { memoryStorage } from "@/test/memory-storage";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36";
const originalUserAgent = navigator.userAgent;

let quality: ReturnType<typeof useQuality> | undefined;
const Probe = () => {
  quality = useQuality();
  return <p data-testid="tier">{quality.quality}</p>;
};
const tree = () => (
  <QualityProvider>
    <Probe />
  </QualityProvider>
);

/** `seconds` of samples, re-rendering each second as the real hook does. */
function run(view: ReturnType<typeof render>, seconds: number) {
  const tiers: string[] = [];
  for (let s = 0; s < seconds; s++) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    view.rerender(tree());
    tiers.push(screen.getByTestId("tier").textContent ?? "");
  }
  return tiers;
}

beforeEach(() => {
  vi.useFakeTimers();
  toasts.shown = [];
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  sessionStorage.setItem("quality-mode", "maximum"); // auto's tier
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

describe("QualityProvider auto loop", () => {
  it("does not decide on samples from before it was switched off", () => {
    sampler.fps = 35; // under 40: MAXIMUM is too much for this machine
    const view = render(tree());
    run(view, 9); // one verdict short of dropping (it drops at 10 s)
    expect(screen.getByTestId("tier").textContent).toBe("maximum");

    act(() => quality!.setIsAuto(false));
    run(view, 60); // a minute later the page runs well
    sampler.fps = 60;
    act(() => quality!.setIsAuto(true));

    expect(run(view, 6)).toEqual(Array(6).fill("maximum"));
  });

  it("keeps a tier's backoff across a reload", () => {
    // Demoted from MAXIMUM a moment ago, then reloaded: BALANCED comes back
    // from the session, and so must the block on MAXIMUM, or the loop
    // upgrades about 16 s later and stutters again, on every reload.
    sessionStorage.setItem("quality-mode", "balanced");
    sessionStorage.setItem(
      "quality-backoff",
      JSON.stringify({
        demotions: {
          maximum: { count: 1, blockedUntil: Date.now() + 60_000 },
        },
        recoverTo: null,
      }),
    );
    sampler.fps = 60;
    const view = render(tree());

    expect(run(view, 30)).toEqual(Array(30).fill("balanced"));
  });

  it("saves the backoff when the loop demotes", () => {
    sampler.fps = 35;
    const view = render(tree());
    run(view, 10); // MAXIMUM drops at 10 s

    const saved = JSON.parse(sessionStorage.getItem("quality-backoff")!);
    expect(saved.demotions.maximum.count).toBe(1);
  });

  it("forgets a saved debt once the visitor has picked a tier by hand", () => {
    // Auto had dropped BALANCED to battery saver (owing a recovery to
    // BALANCED), then the visitor picked MAXIMUM by hand, then reloaded.
    localStorage.setItem("quality-auto", "false");
    localStorage.setItem("quality-mode", "maximum");
    sessionStorage.setItem(
      "quality-backoff",
      JSON.stringify({ demotions: {}, recoverTo: "balanced" }),
    );
    const view = render(tree());

    sampler.fps = 35; // MAXIMUM is too much here
    act(() => quality!.setIsAuto(true));
    const tiers = run(view, 15);

    expect(tiers.at(-1)).toBe("balanced"); // a drop, not a recovery
    expect(toasts.shown.filter((t) => /recovered/i.test(t))).toEqual([]);
    expect(
      JSON.parse(sessionStorage.getItem("quality-backoff")!).recoverTo,
    ).toBeNull();
  });

  it("keeps the 5 minute toast cap across a reload", () => {
    // A drop toast a minute ago, then a reload: the cap used to start over,
    // so another drop toast could follow straight away.
    sessionStorage.setItem("quality-mode", "balanced");
    sessionStorage.setItem(
      "quality-backoff",
      JSON.stringify({
        demotions: {},
        recoverTo: null,
        lastToastAt: Date.now() - 60_000,
      }),
    );
    sampler.fps = 8;
    const view = render(tree());

    expect(run(view, 10).at(-1)).toBe("battery"); // the drop still happens
    expect(toasts.shown).toEqual([]); // but no second toast within 5 min
  });

  it("still drops when the slow samples are new", () => {
    sampler.fps = 35;
    const view = render(tree());

    expect(run(view, 10).at(-1)).toBe("balanced");
  });
});
