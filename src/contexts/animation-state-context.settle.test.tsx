import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";

/**
 * Auto-disable switches animations off after five slow samples in a row at
 * the battery tier (useFpsAutoDisable). The first seconds after a change
 * describe the change, not the page, and are not counted (settleMs, as the
 * quality loop does). These run the real providers and the real frame
 * sampler (useFpsOnly), with frames driven by hand on a fake clock.
 */

vi.mock("@/components/ui/toast", () => ({ showToast: () => {} }));
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

import {
  AnimationStateProvider,
  useAnimationState,
} from "./animation-state-context";
import { QualityProvider, useQuality } from "./quality-context";
import { SafariProvider } from "./safari-context";
import { useFpsOnly } from "@/lib/hooks/useFpsOnly";
import {
  acquireOverlay,
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

/** Milliseconds since the test started, the clock performance.now reads. */
let clock = () => 0;

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
  clock = () => Date.now() - start;
  vi.spyOn(performance, "now").mockImplementation(() => clock());
}

/**
 * `seconds` of frames at `fps`. Rates that divide a second into whole
 * milliseconds only, so the sampler's one-second windows end on a frame.
 */
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

/** The main thread busy for `ms`: time passes, no frame runs. */
function stall(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** The tab hidden or shown, as the browser tells the motion gate. */
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

let animations: ReturnType<typeof useAnimationState> | undefined;
const Probe = () => {
  animations = useAnimationState();
  const { quality } = useQuality();
  return (
    <>
      <p data-testid="playing">{String(animations.areAnimationsPlaying)}</p>
      <p data-testid="tier">{quality}</p>
    </>
  );
};
const playing = () => screen.getByTestId("playing").textContent;
const lowCount = () => animations!.consecutiveLowFpsCount;

/** The site's providers, the automatic quality loop included. */
const site = () => (
  <SafariProvider initialSafari={false}>
    <AnimationStateProvider>
      <QualityProvider>
        <Probe />
      </QualityProvider>
    </AnimationStateProvider>
  </SafariProvider>
);

/** Stands in for the automatic loop: keeps the shared sampler running. */
const KeepSampling = () => {
  useFpsOnly(true);
  return null;
};

/** Auto-disable alone; the tier is set by hand. */
const animationsOnly = ({ shared = false } = {}) => (
  <SafariProvider initialSafari={false}>
    <AnimationStateProvider>
      {shared && <KeepSampling />}
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
  startFakeClock();
});

afterEach(() => {
  vi.useRealTimers();
  window.requestAnimationFrame = originalRaf;
  window.cancelAnimationFrame = originalCaf;
  vi.unstubAllGlobals();
  resetMotionGateForTests();
  delete (document as { visibilityState?: string }).visibilityState;
  Object.defineProperty(navigator, "userAgent", {
    value: originalUserAgent,
    configurable: true,
  });
});

describe("Auto-disable after the drop to battery saver", () => {
  it("skips a fresh sampler's first readings, then counts five slow ones", () => {
    // "animations battery" in the terminal: a tier picked by hand, so the
    // automatic loop stops sampling and auto-disable starts the sampler
    // afresh with the drop. The drop's re-render holds the first frame back.
    render(site());
    runFrames(2, 50);
    expect(frames.size).toBe(1); // the automatic loop's sampler

    const drop = clock();
    act(() => {
      window.dispatchEvent(
        new CustomEvent("quality-change", { detail: { quality: "battery" } }),
      );
    });
    expect(screen.getByTestId("tier").textContent).toBe("battery");
    stall(1500);

    // Samples at +1.6 s (one frame: 1 fps) and +2.6 s are inside the
    // settle; +3.6 s to +6.6 s are four slow ones counted.
    runFrames((drop + 7500 - clock()) / 1000, 10);
    expect(playing()).toBe("true");
    expect(lowCount()).toBe(4);

    runFrames(0.1, 10); // the fifth, at +7.6 s
    expect(playing()).toBe("false");
    expect(animations!.isAutoDisabled).toBe(true);
  });

  it("does not count the reading handed over at the drop", () => {
    // The automatic loop drops the tier on its own samples. The sampler is
    // already running for it, so auto-disable, subscribing with the drop,
    // is handed the latest reading at once: a slow one, from the tier the
    // loop just left.
    render(site());
    let drop = -1;
    while (drop < 0 && clock() < 20_000) {
      runFrames(0.1, 10);
      if (screen.getByTestId("tier").textContent === "battery") {
        drop = clock();
      }
    }
    expect(drop).toBeGreaterThan(0);
    expect(lowCount()).toBe(0);

    // +1 s and +2 s settle; +3 s to +6 s are four slow samples.
    runFrames((drop + 6900 - clock()) / 1000, 10);
    expect(playing()).toBe("true");
    expect(lowCount()).toBe(4);

    runFrames(0.1, 10); // the fifth, at +7 s
    expect(playing()).toBe("false");
  });
});

describe("Auto-disable when the tier leaves battery saver and comes back", () => {
  it("starts over, with a fresh sampler", () => {
    render(animationsOnly());
    act(() => setMotionTier("battery"));
    runFrames(6.5, 10); // four slow samples counted, +3 s to +6 s
    expect(lowCount()).toBe(4);

    act(() => setMotionTier("low"));
    expect(frames.size).toBe(0); // nothing samples above battery saver
    stall(500);
    const back = clock();
    act(() => setMotionTier("battery"));

    // Four from before would make the first counted sample the fifth.
    runFrames((back + 6900 - clock()) / 1000, 10);
    expect(playing()).toBe("true");
    expect(lowCount()).toBe(4);

    runFrames(0.1, 10);
    expect(playing()).toBe("false");
  });

  it("starts over when no new sample came while it was away", () => {
    // The sampler kept running for the automatic loop, and the tier came
    // back within the same second: the reading handed over is the one
    // already counted.
    render(animationsOnly({ shared: true }));
    runFrames(2.5, 10);
    const enter = clock();
    act(() => setMotionTier("battery"));
    // Samples at 3 s, 4 s and 5 s settle (within 3 s of 2.5 s); 6 s to
    // 9 s are four slow ones.
    runFrames((9100 - enter) / 1000, 10);
    expect(lowCount()).toBe(4);

    act(() => setMotionTier("low"));
    runFrames(0.2, 10);
    const back = clock(); // 9.3 s
    act(() => setMotionTier("battery"));

    // 10 s, 11 s and 12 s settle; 13 s to 16 s are four slow ones.
    runFrames((16_900 - back) / 1000, 10);
    expect(playing()).toBe("true");
    expect(lowCount()).toBe(4);

    runFrames(0.1, 10); // 17 s
    expect(playing()).toBe("false");
  });
});

describe("Auto-disable when the page shows again", () => {
  it("does not join slow samples from before the tab was hidden to one after", () => {
    // Four slow seconds, then the visitor leaves for a minute. The first
    // second back (the tab's own catching up) is slow too. Five in a row
    // they are not: the quality loop restarts its window when the page
    // shows again, for the same reason.
    render(animationsOnly());
    act(() => setMotionTier("battery"));
    runFrames(6.5, 10);
    expect(lowCount()).toBe(4);

    act(() => setVisibility("hidden"));
    expect(frames.size).toBe(0); // the sampler pauses with the page
    stall(60_000);
    act(() => setVisibility("visible"));

    runFrames(1, 10); // the first second back
    expect(playing()).toBe("true");

    runFrames(10, 50);
    expect(playing()).toBe("true");
  });

  it("skips the first seconds after a modal closes, as after the drop", () => {
    // The tier dropped, then a modal (the splash on a reload, a PDF) covered
    // the page while the settle ran out. Closing it restarts everything that
    // held still behind it.
    render(animationsOnly());
    act(() => setMotionTier("battery"));
    runFrames(0.5, 10);
    const release = acquireOverlay();
    stall(10_000);
    const shown = clock();
    act(() => release());

    // +1 s and +2 s settle; +3 s to +6 s are four slow samples.
    runFrames((shown + 6900 - clock()) / 1000, 10);
    expect(playing()).toBe("true");
    expect(lowCount()).toBe(4);

    runFrames(0.1, 10); // the fifth, at +7 s
    expect(playing()).toBe("false");
  });
});
