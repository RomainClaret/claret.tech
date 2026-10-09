import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";

/**
 * A machine that clearly cannot keep up (no graphics card) starts at LOW from
 * the startup check, instead of stuttering through the seconds the frame-rate
 * loop needs to notice. Kept apart from quality-context.test.tsx because the
 * check is skipped in test mode, which that file relies on.
 */

vi.mock("@/components/providers/test-mode-provider", () => ({
  useTestMode: () => ({ isTestMode: false }),
}));

const probe = vi.hoisted(() => ({
  result: { weak: true, reason: "software-renderer", renderer: "SwiftShader" },
  calls: 0,
}));
vi.mock("@/lib/quality/probe", () => ({
  probeDeviceOnce: () => {
    probe.calls++;
    return probe.result;
  },
}));

// A machine that renders LOW at full speed: the loop sees all the headroom
// it would want for an upgrade, in a new sample every second.
vi.mock("@/lib/hooks/useFpsOnly", () => ({
  useFpsOnly: () => ({
    fps: 120,
    isLowFps: false,
    refreshRate: 120,
    sample: Math.floor(Date.now() / 1000),
  }),
}));

// Run idle work at once, so the check lands inside the render, unless a test
// holds it to act first.
const idle = vi.hoisted(() => ({ hold: false, tasks: [] as (() => void)[] }));
vi.mock("@/lib/utils/when-idle", () => ({
  whenIdle: (task: () => void) => {
    if (idle.hold) idle.tasks.push(task);
    else task();
    return () => {};
  },
}));

import { QualityProvider, useQuality } from "./quality-context";
import { memoryStorage } from "@/test/memory-storage";
import { QualityMode } from "@/lib/quality/mode";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36";
const SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const originalUserAgent = navigator.userAgent;

function setUserAgent(value: string) {
  Object.defineProperty(navigator, "userAgent", {
    value,
    configurable: true,
  });
}

const Quality = () => <div data-testid="quality">{useQuality().quality}</div>;

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  probe.calls = 0;
  idle.hold = false;
  idle.tasks = [];
  probe.result = {
    weak: true,
    reason: "software-renderer",
    renderer: "SwiftShader",
  };
  setUserAgent(CHROME);
});

afterEach(() => {
  setUserAgent(originalUserAgent);
  vi.unstubAllGlobals();
});

describe("QualityProvider startup check", () => {
  it("starts a machine without a graphics card at LOW", () => {
    render(
      <QualityProvider>
        <Quality />
      </QualityProvider>,
    );

    expect(screen.getByTestId("quality").textContent).toBe("low");
  });

  /**
   * Render, then let `seconds` of samples arrive, re-rendering each second
   * as the real sampler does (the loop only takes a sample it has not seen).
   * Returns the tier at each second.
   */
  function runFor(seconds: number) {
    const tiers: string[] = [];
    const view = render(
      <QualityProvider>
        <Quality />
      </QualityProvider>,
    );
    for (let second = 0; second < seconds; second++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      view.rerender(
        <QualityProvider>
          <Quality />
        </QualityProvider>,
      );
      tiers.push(screen.getByTestId("quality").textContent ?? "");
    }
    return tiers;
  }

  // software-webgl is the browser's own report of software rendering, not of
  // WebGL alone: Chromium fails failIfMajorPerformanceCaveat only when WebGL
  // runs on SwiftShader or WARP, and then composites and rasterizes in
  // software too. Headless Chromium, where scripts/perf/measure.mjs runs S7
  // and S8, gets this reason; started soft, the loop may raise it at 60 s.
  it.each([
    ["software-renderer", "SwiftShader"],
    ["software-webgl", null],
  ])(
    "keeps a %s machine at LOW however smoothly LOW runs",
    (reason, renderer) => {
      // Smooth at LOW is not headroom for BALANCED on such a machine; without
      // the block the loop upgraded straight back after about ten seconds.
      // Two minutes: past the first backoff step, which a finite block ends.
      probe.result = { weak: true, reason, renderer };
      vi.useFakeTimers();
      try {
        const tiers = runFor(120);

        expect(new Set(tiers)).toEqual(new Set(["low"]));
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each(["no-webgl", "save-data"])(
    "lets the loop raise a %s machine once LOW has run smoothly past the first backoff",
    (reason) => {
      // Neither says anything about speed: WebGL is often off by policy or
      // in a hardened browser, and Save-Data is about bandwidth.
      probe.result = { weak: true, reason, renderer: null };
      vi.useFakeTimers();
      try {
        const tiers = runFor(90);

        expect(tiers[0]).toBe("low");
        expect(tiers[50]).toBe("low"); // blocked for the first step (60 s)
        expect(tiers[89]).not.toBe("low");
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("keeps the tier the loop raised a no-WebGL machine to across a reload", () => {
    // Later in the session: the check ran on the first page view, and the
    // loop has since raised the tier, which this page view restores.
    probe.result = { weak: true, reason: "no-webgl", renderer: null };
    sessionStorage.setItem("quality-probe-applied", "1");
    sessionStorage.setItem("quality-mode", "balanced");

    render(
      <QualityProvider>
        <Quality />
      </QualityProvider>,
    );

    expect(screen.getByTestId("quality").textContent).toBe("balanced");
  });

  it.each(["software-renderer", "software-webgl"])(
    "pins a %s machine on every page view",
    (reason) => {
      // Past the once-a-session flag that stops the soft reasons: a tier
      // above LOW that this page view restored is lowered again.
      probe.result = { weak: true, reason, renderer: null };
      sessionStorage.setItem("quality-probe-applied", "1");
      sessionStorage.setItem("quality-mode", "balanced");

      render(
        <QualityProvider>
          <Quality />
        </QualityProvider>,
      );

      expect(screen.getByTestId("quality").textContent).toBe("low");
    },
  );

  it("leaves a tier picked by hand before the check runs", () => {
    idle.hold = true;
    let pick: (tier: QualityMode) => void = () => {};
    const Picker = () => {
      pick = useQuality().setQuality;
      return null;
    };
    render(
      <QualityProvider>
        <Quality />
        <Picker />
      </QualityProvider>,
    );

    act(() => pick(QualityMode.MAXIMUM));
    act(() => idle.tasks.forEach((task) => task()));

    expect(screen.getByTestId("quality").textContent).toBe("maximum");
    expect(localStorage.getItem("quality-mode")).toBe("maximum");
  });

  it("keeps the recovery a battery saver session is owed", () => {
    // Restored at battery saver, owed a recovery to LOW: the check, which
    // runs before the loop has any state, saved one labelled LOW, and the
    // loop's first tick re-based it and cleared what was owed.
    sessionStorage.setItem("quality-mode", "battery");
    sessionStorage.setItem(
      "quality-backoff",
      JSON.stringify({ demotions: {}, recoverTo: "low" }),
    );
    vi.useFakeTimers();
    try {
      runFor(2); // the check, then the loop's first ticks

      const saved = JSON.parse(sessionStorage.getItem("quality-backoff")!);
      expect(saved.recoverTo).toBe("low");
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves a capable machine at BALANCED", () => {
    probe.result = { weak: false, reason: null, renderer: "Apple M3" };

    render(
      <QualityProvider>
        <Quality />
      </QualityProvider>,
    );

    expect(screen.getByTestId("quality").textContent).toBe("balanced");
  });

  it("never overrides a tier the visitor chose", () => {
    localStorage.setItem("quality-auto", "false");
    localStorage.setItem("quality-mode", "maximum");

    render(
      <QualityProvider>
        <Quality />
      </QualityProvider>,
    );

    expect(screen.getByTestId("quality").textContent).toBe("maximum");
    expect(probe.calls).toBe(0);
  });

  it("skips the check on Safari, which starts at LOW anyway", () => {
    setUserAgent(SAFARI);

    render(
      <QualityProvider>
        <Quality />
      </QualityProvider>,
    );

    expect(screen.getByTestId("quality").textContent).toBe("low");
    expect(probe.calls).toBe(0);
  });
});
