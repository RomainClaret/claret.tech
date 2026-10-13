import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";

/**
 * AnimationStateProvider reads the frame rate for auto-disable only, and
 * auto-disable counts only at the battery tier, with animations on
 * (useFpsAutoDisable). The frame sampler (useFpsOnly) is a callback on every
 * display refresh, so it must run there and nowhere else. These run the real
 * sampler and watch for its frame requests.
 */

vi.mock("@/components/ui/toast", () => ({ showToast: () => {} }));

import {
  AnimationStateProvider,
  useAnimationState,
} from "./animation-state-context";
import { SafariProvider } from "./safari-context";
import {
  resetMotionGateForTests,
  setMotionTier,
} from "@/lib/utils/motion-gate";
import { memoryStorage } from "@/test/memory-storage";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36";
const originalUserAgent = navigator.userAgent;
const originalRaf = window.requestAnimationFrame;
const originalCaf = window.cancelAnimationFrame;

/** Frame callbacks requested and not yet run or cancelled. */
const frames = new Map<number, FrameRequestCallback>();
let lastHandle = 0;
const sampling = () => frames.size > 0;

/**
 * Fake timers and Date, with performance.now on the same clock. Only those:
 * Vitest fakes requestAnimationFrame and performance too by default, and the
 * frames here are driven by hand.
 */
function startFakeClock() {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  const start = Date.now();
  vi.spyOn(performance, "now").mockImplementation(() => Date.now() - start);
}

/** `seconds` of frames at `fps`, on the fake clock. */
function runFrames(seconds: number, fps: number) {
  for (let i = 0; i < Math.round(seconds * fps); i++) {
    act(() => {
      vi.advanceTimersByTime(1000 / fps);
      const due = [...frames.values()];
      frames.clear();
      due.forEach((callback) => callback(performance.now()));
    });
  }
}

let animations: ReturnType<typeof useAnimationState> | undefined;
const Probe = () => {
  animations = useAnimationState();
  return <p data-testid="playing">{String(animations.areAnimationsPlaying)}</p>;
};
const tree = () => (
  <SafariProvider initialSafari={false}>
    <AnimationStateProvider>
      <Probe />
    </AnimationStateProvider>
  </SafariProvider>
);

beforeEach(() => {
  animations = undefined;
  frames.clear();
  window.requestAnimationFrame = (callback) => {
    frames.set(++lastHandle, callback);
    return lastHandle;
  };
  window.cancelAnimationFrame = (handle) => {
    frames.delete(handle);
  };
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  Object.defineProperty(navigator, "userAgent", {
    value: CHROME,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  window.requestAnimationFrame = originalRaf;
  window.cancelAnimationFrame = originalCaf;
  vi.unstubAllGlobals();
  resetMotionGateForTests();
  Object.defineProperty(navigator, "userAgent", {
    value: originalUserAgent,
    configurable: true,
  });
});

describe("AnimationStateProvider frame sampling", () => {
  it("does not sample above the battery tier", () => {
    render(tree());

    expect(screen.getByTestId("playing").textContent).toBe("true");
    expect(sampling()).toBe(false);
  });

  it("samples once the tier drops to battery saver", () => {
    render(tree());
    expect(sampling()).toBe(false);

    act(() => setMotionTier("battery"));

    expect(sampling()).toBe(true);
  });

  it("stops sampling when the tier rises again", () => {
    act(() => setMotionTier("battery"));
    render(tree());
    expect(sampling()).toBe(true);

    act(() => setMotionTier("low"));

    expect(sampling()).toBe(false);
  });

  it("does not sample at battery saver while the visitor has animations off", () => {
    localStorage.setItem(
      "background-animations-state",
      JSON.stringify({
        value: false,
        browser: "other",
        isUserPreference: true,
        timestamp: 0,
      }),
    );
    act(() => setMotionTier("battery"));

    render(tree());

    expect(screen.getByTestId("playing").textContent).toBe("false");
    expect(sampling()).toBe(false);
  });

  it("stops sampling when the visitor switches animations off", () => {
    act(() => setMotionTier("battery"));
    render(tree());
    expect(sampling()).toBe(true);

    act(() => animations!.stopAnimations());

    expect(sampling()).toBe(false);
  });

  it("still switches animations off after five slow seconds at a settled battery tier", () => {
    // The sampler starts with the drop to battery. The drop's own seconds
    // are skipped (settleMs, 3 s), then five slow samples in a row are the
    // last resort, as before the sampler waited for the tier.
    startFakeClock();
    render(tree());

    act(() => setMotionTier("battery"));
    runFrames(5.5, 10); // settled, and three slow samples counted
    expect(screen.getByTestId("playing").textContent).toBe("true");

    runFrames(4, 10); // five counted by now
    expect(screen.getByTestId("playing").textContent).toBe("false");
    expect(animations!.isAutoDisabled).toBe(true);
  });

  it("stops sampling once auto-disable has switched animations off, and samples again after force", () => {
    // Nothing reads the frame rate while animations are auto-disabled: the
    // counting has stopped. The machines that get here are the slowest, and
    // each kept paying a rendering update on every refresh for the rest of
    // the session.
    startFakeClock();
    render(tree());
    act(() => setMotionTier("battery"));
    runFrames(10, 10);
    expect(animations!.isAutoDisabled).toBe(true);

    expect(sampling()).toBe(false);

    act(() => animations!.forceEnableAnimations());

    expect(screen.getByTestId("playing").textContent).toBe("true");
    expect(sampling()).toBe(true);
  });
});
