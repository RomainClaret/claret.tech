import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * web-vitals 5 registers each on* callback for the page's lifetime and
 * returns nothing to remove it with. The monitor kept the return values as
 * its cleanups, so the list was always empty, and each time monitoring
 * turned on it added five more observers and callbacks that never went.
 */

vi.mock("web-vitals", () => ({
  onLCP: vi.fn(),
  onINP: vi.fn(),
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onTTFB: vi.fn(),
}));

// A fresh copy of the hook's module, and of the mock it imports, per test:
// the subscription is per page, which is the module here.
async function load() {
  vi.resetModules();
  const vitals = await import("web-vitals");
  const { usePerformanceMonitor } = await import("./usePerformanceMonitor");
  return { vitals, usePerformanceMonitor };
}

const VITALS_ONLY = { fps: false, webVitals: true };

describe("usePerformanceMonitor's Web Vitals", () => {
  it("subscribes once per page, however often monitoring turns on", async () => {
    const { vitals, usePerformanceMonitor } = await load();
    const { rerender } = renderHook(
      ({ on }) => usePerformanceMonitor(on, VITALS_ONLY),
      { initialProps: { on: true } },
    );

    rerender({ on: false });
    rerender({ on: true });
    rerender({ on: false });
    rerender({ on: true });

    for (const subscribe of [
      vitals.onLCP,
      vitals.onINP,
      vitals.onCLS,
      vitals.onFCP,
      vitals.onTTFB,
    ]) {
      expect(subscribe).toHaveBeenCalledTimes(1);
    }
  });

  it("gives a monitor opened later the values reported before it", async () => {
    const { vitals, usePerformanceMonitor } = await load();
    let report: (metric: { name: string; value: number }) => void = () => {};
    vi.mocked(vitals.onLCP).mockImplementation((callback) => {
      report = callback as typeof report;
    });

    const first = renderHook(() => usePerformanceMonitor(true, VITALS_ONLY));
    act(() => report({ name: "LCP", value: 1234 }));
    expect(first.result.current.lcp).toBe(1234);
    first.unmount();

    // web-vitals reports the LCP once, so a second subscription would wait
    // for an LCP that never comes again.
    const second = renderHook(() => usePerformanceMonitor(true, VITALS_ONLY));
    expect(second.result.current.lcp).toBe(1234);
  });

  it("stops reporting to a monitor once it is off", async () => {
    const { vitals, usePerformanceMonitor } = await load();
    let report: (metric: { name: string; value: number }) => void = () => {};
    vi.mocked(vitals.onCLS).mockImplementation((callback) => {
      report = callback as typeof report;
    });
    const { result, rerender } = renderHook(
      ({ on }) => usePerformanceMonitor(on, VITALS_ONLY),
      { initialProps: { on: true } },
    );
    act(() => report({ name: "CLS", value: 0.01 }));

    rerender({ on: false });
    act(() => report({ name: "CLS", value: 0.5 }));

    expect(result.current.cls).toBe(0.01);
  });
});
