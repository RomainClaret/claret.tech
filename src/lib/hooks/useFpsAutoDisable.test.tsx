import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFpsAutoDisable } from "./useFpsAutoDisable";
import {
  resetMotionGateForTests,
  setMotionTier,
} from "@/lib/utils/motion-gate";
import { memoryStorage } from "@/test/memory-storage";
import { QUALITY_TUNING } from "@/lib/quality/decide";

/**
 * Animations switch off, as a last resort, after `durationThreshold` slow
 * samples in a row at the battery tier. The count ran when the frame rate
 * changed, so a steady 12 fps was counted once and never again; it only
 * worked in the app because the provider passed a new callback on every
 * render.
 */

vi.mock("@/components/ui/toast", () => ({ showToast: () => {} }));

// Stable across renders, as a memoised caller's would be.
const options = { durationThreshold: 5 };

function setup(fps = 12) {
  const hook = renderHook(
    ({ sample, onAutoDisable }) =>
      useFpsAutoDisable({ fps, sample }, false, {
        ...options,
        onAutoDisable,
      }),
    {
      initialProps: {
        sample: 0,
        onAutoDisable: undefined as (() => void) | undefined,
      },
    },
  );
  let sample = 0;
  /** One more one-second sample at the same frame rate. */
  const nextSample = () => {
    vi.advanceTimersByTime(1000);
    sample++;
    hook.rerender({ sample, onAutoDisable: undefined });
  };
  return { hook, nextSample, current: () => sample };
}

/** Let a tier that just started settle, with no sample in between. */
const settle = () => vi.advanceTimersByTime(QUALITY_TUNING.settleMs);

beforeEach(() => {
  // Samples come once a second; the clock decides which ones count.
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetMotionGateForTests();
});

describe("useFpsAutoDisable", () => {
  it("switches animations off after five slow samples in a row", () => {
    act(() => setMotionTier("battery"));
    const { hook, nextSample } = setup(12);
    settle();

    for (let i = 0; i < 4; i++) nextSample();
    expect(hook.result.current.consecutiveLowFpsCount).toBe(4);
    expect(hook.result.current.isAutoDisabled).toBe(false);

    nextSample();
    expect(hook.result.current.isAutoDisabled).toBe(true);
  });

  it("counts each sample once, however often the caller re-renders", () => {
    act(() => setMotionTier("battery"));
    const { hook, nextSample, current } = setup(12);
    settle();
    nextSample();

    // Re-renders between samples, with a new callback each time, as the
    // provider's inline one is.
    for (let i = 0; i < 10; i++) {
      hook.rerender({ sample: current(), onAutoDisable: () => {} });
    }

    expect(hook.result.current.consecutiveLowFpsCount).toBe(1);
    expect(hook.result.current.isAutoDisabled).toBe(false);
  });

  it("starts counting when the tier drops, the frame rate unchanged", () => {
    const { hook, nextSample } = setup(12);
    for (let i = 0; i < 3; i++) nextSample(); // not the last resort yet
    expect(hook.result.current.consecutiveLowFpsCount).toBe(0);

    act(() => setMotionTier("battery"));
    settle();
    for (let i = 0; i < 5; i++) nextSample();

    expect(hook.result.current.isAutoDisabled).toBe(true);
  });

  it("ignores the samples taken while the drop to battery settles", () => {
    // The drop itself re-renders the page, and the second it lands in is
    // slow already; the quality loop skips those seconds (settleMs). Counted
    // here, five slow seconds right after the drop switched animations off
    // before the battery tier had a chance to help.
    const { hook, nextSample } = setup(12);
    nextSample();

    act(() => setMotionTier("battery"));
    for (let i = 0; i < 5; i++) nextSample();
    expect(hook.result.current.isAutoDisabled).toBe(false);

    // Still slow once settled: five counted samples, the last resort.
    for (let i = 0; i < 2; i++) nextSample();
    expect(hook.result.current.isAutoDisabled).toBe(true);
  });
});

describe("useFpsAutoDisable after force", () => {
  // Force, and the terminal's "animations play" after an auto-disable, are
  // a visitor asking for animations: they pause the protection for 30
  // minutes. Both used to clear the pause instead, so on a page still that
  // slow the animations switched off again five seconds later.
  const pause = 30 * 60 * 1000;

  it("keeps animations on for 30 minutes after force", () => {
    act(() => setMotionTier("battery"));
    const { hook, nextSample } = setup(12);
    settle();
    for (let i = 0; i < 5; i++) nextSample();
    expect(hook.result.current.isAutoDisabled).toBe(true);

    act(() => hook.result.current.forceEnableAnimations());
    for (let i = 0; i < 60; i++) nextSample();

    expect(hook.result.current.isAutoDisabled).toBe(false);
  });

  it("switches them off again once the pause is over", () => {
    act(() => setMotionTier("battery"));
    const { hook, nextSample } = setup(12);
    settle();
    act(() => hook.result.current.forceEnableAnimations());

    vi.advanceTimersByTime(pause);
    for (let i = 0; i < 5; i++) nextSample();

    expect(hook.result.current.isAutoDisabled).toBe(true);
  });

  it("ends the pause on the clock, with no sample to count", () => {
    // Samples are counted only at the battery tier with animations on: after
    // a force at another tier the pause outlived its 30 minutes, and the
    // monitor said "Auto-disable paused: 0m" for the rest of the visit.
    act(() => setMotionTier("balanced"));
    const { hook } = setup(60);
    act(() => hook.result.current.forceEnableAnimations());
    expect(hook.result.current.cooldownActive).toBe(true);

    act(() => {
      vi.advanceTimersByTime(pause);
    });

    expect(hook.result.current.cooldownActive).toBe(false);
    expect(
      JSON.parse(sessionStorage.getItem("fps-auto-disable-state") ?? "{}"),
    ).toMatchObject({ cooldownActive: false });
  });

  it("keeps the pause across a reload in the same session", () => {
    act(() => setMotionTier("battery"));
    const first = setup(12);
    settle();
    act(() => first.hook.result.current.forceEnableAnimations());
    first.hook.unmount();

    const { hook, nextSample } = setup(12);
    settle();
    for (let i = 0; i < 10; i++) nextSample();

    expect(hook.result.current.isAutoDisabled).toBe(false);
  });
});

describe("useFpsAutoDisable on a page generated at build time", () => {
  const Probe = () => {
    const { isAutoDisabled } = useFpsAutoDisable({ fps: 60, sample: 0 });
    return <p>{isAutoDisabled ? "disabled" : "enabled"}</p>;
  };
  const stored = JSON.stringify({
    isAutoDisabled: true,
    lastAutoDisableTime: Date.now(),
    consecutiveLowFpsCount: 5,
    cooldownActive: false,
  });

  it("renders enabled on the server, without reading storage", async () => {
    const { renderToString } = await import("react-dom/server");
    sessionStorage.setItem("fps-auto-disable-state", stored);
    const read = vi.spyOn(sessionStorage, "getItem");

    expect(renderToString(<Probe />)).toContain("enabled");
    expect(read).not.toHaveBeenCalled();
  });

  it("restores this session's disable once mounted", () => {
    sessionStorage.setItem("fps-auto-disable-state", stored);

    const { hook } = setup(60);

    expect(hook.result.current.isAutoDisabled).toBe(true);
  });
});
