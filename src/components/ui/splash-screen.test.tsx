import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { getSnapshot, resetMotionGateForTests } from "@/lib/utils/motion-gate";
import { detectSafari } from "@/lib/utils/safari-detection";
import { memoryStorage } from "@/test/memory-storage";

/**
 * The splash covers the page for about two seconds. Two costs went with it:
 * every decorative loop kept running underneath, and the progress bar was
 * React state updated on every animation frame, re-rendering the whole splash
 * some fifty times. The page is now suspended while the splash shows, and the
 * bar is written through refs.
 */

vi.mock("./display-lottie", () => ({
  DisplayLottie: () => <div data-testid="lottie" />,
}));
vi.mock("./theme-provider", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("@/contexts/projects-context", () => ({
  useProjects: () => ({ setAllProjects: () => {}, setIsLoading: () => {} }),
}));
vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: () => false,
}));
const background = vi.hoisted(() => ({ ensure: vi.fn() }));
vi.mock("@/contexts/background-context", () => ({
  useBackground: () => ({ ensureBackgroundData: background.ensure }),
}));

import { SplashScreen } from "./splash-screen";

// Frames are driven by hand: each step runs the pending callbacks at `now`.
let pending: FrameRequestCallback[] = [];
let now = 0;
function frames(count: number, stepMs = 16) {
  for (let i = 0; i < count; i++) {
    now += stepMs;
    const callbacks = pending;
    pending = [];
    act(() => callbacks.forEach((cb) => cb(now)));
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  pending = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pending.push(cb);
    return pending.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})), // never resolves: no Lottie, no repos
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetMotionGateForTests();
});

describe("SplashScreen", () => {
  it("leaves a visitor's own animation choice in place", () => {
    // It stored the browser default over it on every load, so animations a
    // visitor had switched off were on again after a reload.
    vi.stubGlobal("localStorage", memoryStorage());
    const choice = {
      value: false,
      browser: detectSafari().isSafari ? "safari" : "other",
      isUserPreference: true,
      timestamp: 1,
    };
    localStorage.setItem("background-animations-state", JSON.stringify(choice));

    render(<SplashScreen />);

    expect(
      JSON.parse(localStorage.getItem("background-animations-state") ?? "null"),
    ).toEqual(choice);
  });

  it("asks for a background for the site grid", () => {
    // The hero generates one on /, so this only does anything elsewhere
    // (the 404 and other routes): without it their site grid drew no nodes.
    render(<SplashScreen />);

    expect(background.ensure).toHaveBeenCalledWith(
      window.innerWidth,
      window.innerHeight,
      64,
    );
  });

  it("suspends the page while it shows, and releases it when it fades", () => {
    const onComplete = vi.fn();
    render(<SplashScreen onComplete={onComplete} />);
    act(() => {
      vi.advanceTimersByTime(20); // shown after 10 ms
    });
    expect(getSnapshot().suspended).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1300); // duration + buffer: the exit starts
    });
    expect(getSnapshot().suspended).toBe(false);

    act(() => {
      vi.advanceTimersByTime(600); // exit animation
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("fills the bar through the DOM, not through React state", () => {
    const { container } = render(<SplashScreen />);
    act(() => {
      vi.advanceTimersByTime(420); // shown, and the bar's start delay passed
    });
    const bar = container.querySelector(
      ".absolute.inset-y-0.left-0",
    ) as HTMLElement;
    const root = container.querySelector('[role="progressbar"]') as HTMLElement;
    const status = container.querySelector('[aria-live="polite"]');
    expect(bar.style.width).toBe("0%");

    frames(25); // 400 ms into an 800 ms fill
    expect(parseFloat(bar.style.width)).toBeCloseTo(48, 0);
    expect(Number(root.getAttribute("aria-valuenow"))).toBeGreaterThan(40);
    expect(status?.textContent).toContain("Initializing...");

    frames(30); // past the end
    expect(bar.style.width).toBe("100%");
    expect(root.getAttribute("aria-valuenow")).toBe("100");
    expect(status?.textContent).toContain("Ready!");
  });
});

describe("SplashScreen skip", () => {
  // On a slow connection the page can be on screen before the splash is
  // (app-wrapper.tsx). Playing it then covered a page the visitor was
  // already reading, and locked its scroll for two seconds.
  it("does its work but shows nothing over a page already on screen", () => {
    const onShow = vi.fn();
    const onComplete = vi.fn();
    render(<SplashScreen skip onShow={onShow} onComplete={onComplete} />);

    act(() => {
      vi.advanceTimersByTime(2500); // past the show, the duration and the exit
    });

    expect(onShow).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).not.toBe("hidden");
    // Still done: the background for the site grid and the projects fetch.
    expect(background.ensure).toHaveBeenCalled();
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls).toContain("/api/fetch-all-repos");
    // Not fetched: the animation nobody will see.
    expect(urls.some((url) => url.startsWith("/animations/"))).toBe(false);
  });

  it("stands down when told to skip before it shows", () => {
    const onShow = vi.fn();
    const onComplete = vi.fn();
    const { rerender } = render(
      <SplashScreen onShow={onShow} onComplete={onComplete} />,
    );

    rerender(<SplashScreen skip onShow={onShow} onComplete={onComplete} />);
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(onShow).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

describe("SplashScreen onShow", () => {
  it("says when its content is on screen, so the backdrop in the HTML can go", () => {
    const onShow = vi.fn();
    render(<SplashScreen onShow={onShow} />);
    expect(onShow).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(20); // shown after 10 ms
    });

    expect(onShow).toHaveBeenCalledTimes(1);
  });
});

describe("SplashScreen and the page's scroll", () => {
  it("locks it while it shows, and puts it back as it was", () => {
    // It wrote "auto" on its way out, which then stayed on the body.
    const onComplete = vi.fn();
    render(<SplashScreen onComplete={onComplete} />);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(document.body.style.overflow).toBe("hidden");

    act(() => {
      vi.advanceTimersByTime(2500); // past the duration and the exit
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe("");
  });
});
