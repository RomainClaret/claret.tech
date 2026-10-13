import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";

/**
 * The frame sampler (useFpsOnly) is a requestAnimationFrame loop: a callback
 * on every display refresh, 120 a second on a 120Hz panel, and each one a
 * rendering update of the page. QualityProvider reads it for its automatic
 * loop and nothing else, and that loop measures the page while it animates,
 * so neither a tier the visitor chose nor animations switched off may keep
 * it running. These run the real sampler and watch for its frame requests.
 */

const testMode = vi.hoisted(() => ({ on: false }));
vi.mock("@/components/providers/test-mode-provider", () => ({
  useTestMode: () => ({ isTestMode: testMode.on }),
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
vi.mock("@/components/ui/toast", () => ({ showToast: () => {} }));

import { QualityProvider, QualityMode, useQuality } from "./quality-context";
import { AnimationStateProvider } from "./animation-state-context";
import { SafariProvider } from "./safari-context";
import { resetMotionGateForTests } from "@/lib/utils/motion-gate";
import { memoryStorage } from "@/test/memory-storage";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36";
const SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
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

/** `seconds` of frames at `fps`, on the fake clock the loop ticks on. */
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

let quality: ReturnType<typeof useQuality> | undefined;
const Probe = () => {
  quality = useQuality();
  return <p data-testid="tier">{quality.quality}</p>;
};

/** A tier the visitor picked by hand, as a later visit restores it. */
function chooseTier(tier: QualityMode) {
  localStorage.setItem("quality-auto", "false");
  localStorage.setItem("quality-mode", tier);
}

beforeEach(() => {
  testMode.on = false;
  quality = undefined;
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

describe("QualityProvider frame sampling", () => {
  it("does not sample while a tier the visitor chose runs", () => {
    chooseTier(QualityMode.LOW);

    render(
      <QualityProvider>
        <Probe />
      </QualityProvider>,
    );

    expect(screen.getByTestId("tier").textContent).toBe("low");
    expect(sampling()).toBe(false);
  });

  it("samples while the automatic loop runs", () => {
    render(
      <QualityProvider>
        <Probe />
      </QualityProvider>,
    );

    expect(sampling()).toBe(true);
  });

  it("starts sampling when the visitor switches to automatic", () => {
    chooseTier(QualityMode.LOW);
    render(
      <QualityProvider>
        <Probe />
      </QualityProvider>,
    );
    expect(sampling()).toBe(false);

    act(() => quality!.setIsAuto(true));

    expect(sampling()).toBe(true);
  });

  it("starts sampling when the terminal switches to automatic", () => {
    chooseTier(QualityMode.BALANCED);
    render(
      <QualityProvider>
        <Probe />
      </QualityProvider>,
    );
    expect(sampling()).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("quality-auto"));
    });

    expect(sampling()).toBe(true);
  });

  it("stops sampling when the visitor picks a tier by hand", () => {
    render(
      <QualityProvider>
        <Probe />
      </QualityProvider>,
    );
    expect(sampling()).toBe(true);

    act(() => quality!.setQuality(QualityMode.MAXIMUM));

    expect(sampling()).toBe(false);
  });

  it("does not sample in an end-to-end run, where the tier is fixed", () => {
    testMode.on = true;

    render(
      <QualityProvider>
        <Probe />
      </QualityProvider>,
    );

    expect(sampling()).toBe(false);
  });

  it("lowers the tier on slow frames sampled after the switch to automatic", () => {
    // The sampler starts with the switch; its first readings must reach the
    // loop as they would have from a sampler that never stopped.
    startFakeClock();
    chooseTier(QualityMode.BALANCED);
    render(
      <QualityProvider>
        <Probe />
      </QualityProvider>,
    );

    act(() => quality!.setIsAuto(true));
    runFrames(10, 10);

    expect(screen.getByTestId("tier").textContent).toBe("battery");
  });
});

describe("The page's frame sampling, both providers", () => {
  const tree = () => (
    <SafariProvider initialSafari={false}>
      <AnimationStateProvider>
        <QualityProvider>
          <Probe />
        </QualityProvider>
      </AnimationStateProvider>
    </SafariProvider>
  );
  const animations = (playing: boolean) =>
    localStorage.setItem(
      "background-animations-state",
      JSON.stringify({
        value: playing,
        browser: "other",
        isUserPreference: true,
        timestamp: 0,
      }),
    );

  it("runs no frame loop for a tier of the visitor's own, animations off", () => {
    // The reported case: nothing reads the frame rate, yet the sampler ran a
    // callback on every display refresh for the whole visit.
    chooseTier(QualityMode.LOW);
    animations(false);

    render(tree());

    expect(sampling()).toBe(false);
  });

  it("runs no frame loop for a tier of the visitor's own above battery saver", () => {
    chooseTier(QualityMode.BALANCED);
    animations(true);

    render(tree());

    expect(sampling()).toBe(false);
  });

  it("samples for the automatic loop while animations play", () => {
    animations(true);

    render(tree());

    expect(sampling()).toBe(true);
  });

  it("does not sample for the automatic loop while animations are off", () => {
    // The page hardly moves then, so its frame rate measures the sampler
    // itself: a rendering update on every display refresh, for nothing.
    animations(false);

    render(tree());

    expect(sampling()).toBe(false);
  });

  it("starts sampling when the visitor switches animations on", () => {
    animations(false);
    render(tree());
    expect(sampling()).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("animation-play"));
    });

    expect(sampling()).toBe(true);
  });

  it("holds a Safari visitor's tier while animations are off", () => {
    // Safari's default. Measured on the still page, the loop raised LOW to
    // BALANCED within 20 s in WebKit, and kept climbing.
    Object.defineProperty(navigator, "userAgent", {
      value: SAFARI,
      configurable: true,
    });
    startFakeClock();
    render(tree());
    expect(screen.getByTestId("tier").textContent).toBe("low");

    runFrames(30, 60);

    expect(screen.getByTestId("tier").textContent).toBe("low");
  });

  it("acts on slow frames again once animations are switched on", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: SAFARI,
      configurable: true,
    });
    startFakeClock();
    render(tree());

    act(() => {
      window.dispatchEvent(new Event("animation-play"));
    });
    runFrames(10, 10);

    expect(screen.getByTestId("tier").textContent).toBe("battery");
  });

  it("samples at a battery saver tier the visitor chose, animations on", () => {
    // Auto-disable is the last resort there, and it needs the frame rate.
    chooseTier(QualityMode.BATTERY_SAVER);
    animations(true);

    render(tree());

    expect(sampling()).toBe(true);
  });
});
