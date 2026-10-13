import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { DeviceProbe, WeakDeviceReason } from "@/lib/quality/probe";
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
  result: {
    weak: true,
    reason: "software-renderer",
    renderer: "SwiftShader",
  } as DeviceProbe,
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
import { AnimationStateProvider } from "./animation-state-context";
import { SafariProvider } from "./safari-context";
import { resetMotionGateForTests } from "@/lib/utils/motion-gate";
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
  it.each<[WeakDeviceReason, string | null]>([
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

  it.each<WeakDeviceReason>(["no-webgl", "save-data"])(
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

  it.each<WeakDeviceReason>(["software-renderer", "software-webgl"])(
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

/**
 * The tests above render QualityProvider alone, where animations count as
 * playing. In the layout AnimationStateProvider sits above it, and with
 * animations off (the terminal's "animations stop", auto-disable) the loop
 * holds the tier and restarts its window when they play again. The check
 * does not run through the loop, so a software session must still be pinned
 * on every page view, and the block must outlast that restart.
 */
describe("QualityProvider startup check, animations off", () => {
  const tree = () => (
    <SafariProvider initialSafari={false}>
      <AnimationStateProvider>
        <QualityProvider>
          <Quality />
        </QualityProvider>
      </AnimationStateProvider>
    </SafariProvider>
  );
  // The visitor's own choice, as "animations stop" saves it.
  const stopAnimations = () =>
    localStorage.setItem(
      "background-animations-state",
      JSON.stringify({
        value: false,
        browser: "other",
        isUserPreference: true,
        timestamp: 0,
      }),
    );

  beforeEach(() => resetMotionGateForTests());
  afterEach(() => resetMotionGateForTests());

  /**
   * A page view in the browser's order: the providers settle first
   * (animations off, so the loop holds), and the check's idle task runs
   * after that.
   */
  function loadWithAnimationsOff() {
    stopAnimations();
    idle.hold = true;
    const view = render(tree());
    act(() => idle.tasks.forEach((task) => task()));
    return view;
  }

  it.each<WeakDeviceReason>(["software-renderer", "software-webgl"])(
    "pins a %s machine on a page view with animations off",
    (reason) => {
      // Later in the session, at the tier above LOW this page view restored.
      probe.result = { weak: true, reason, renderer: null };
      sessionStorage.setItem("quality-probe-applied", "1");
      sessionStorage.setItem("quality-mode", "balanced");

      loadWithAnimationsOff();

      expect(screen.getByTestId("quality").textContent).toBe("low");
      const saved = JSON.parse(sessionStorage.getItem("quality-backoff")!);
      expect(saved.demotions.balanced.blockedUntil).toBe(Number.MAX_VALUE);
    },
  );

  /**
   * Load with animations off, send the terminal's "animations auto" while
   * the loop holds (auto is on already, so it must change nothing), then
   * play them and let `seconds` of samples arrive. Returns the tier at each
   * second of play.
   */
  function playAfterHold(seconds: number) {
    const view = loadWithAnimationsOff();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    act(() => {
      window.dispatchEvent(new Event("quality-auto"));
    });
    act(() => {
      window.dispatchEvent(new Event("animation-play"));
    });
    const tiers: string[] = [];
    for (let second = 0; second < seconds; second++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      view.rerender(tree());
      tiers.push(screen.getByTestId("quality").textContent ?? "");
    }
    return tiers;
  }

  it.each<WeakDeviceReason>(["software-renderer", "software-webgl"])(
    "keeps a %s machine at LOW once animations play again",
    (reason) => {
      // Two minutes of smooth LOW after the restart. Restarted without the
      // block, the loop raised the tier 14 s in; a soft block would have
      // ended at 60 s.
      probe.result = { weak: true, reason, renderer: null };
      vi.useFakeTimers();
      try {
        const tiers = playAfterHold(120);

        expect(new Set(tiers)).toEqual(new Set(["low"]));
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("still lets the loop raise a no-WebGL machine once animations play again", () => {
    // The same run with a soft reason: the harness does see a raise.
    probe.result = { weak: true, reason: "no-webgl", renderer: null };
    vi.useFakeTimers();
    try {
      const tiers = playAfterHold(120);

      expect(tiers[0]).toBe("low");
      expect(tiers[50]).toBe("low"); // blocked for the first step (60 s)
      expect(tiers[119]).not.toBe("low");
    } finally {
      vi.useRealTimers();
    }
  });
});
