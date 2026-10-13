import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { PerformanceReportGenerator } from "./PerformanceReportGenerator";

// What a run reads from the monitor. The real hook runs an animation-frame
// loop, which src/test/setup.ts drives with setTimeout(0), so fake timers
// would never run out.
const performanceData = vi.hoisted(() => ({
  fps: 60,
  averageFps: 60,
  minFps: 60,
  maxFps: 60,
  memoryUsed: null,
  memoryLimit: null,
  cpuUsage: null,
  gpuUsage: null,
  lcp: null,
  fcp: null,
  cls: null,
  inp: null,
  ttfb: null,
  connectionType: null,
  effectiveBandwidth: null,
  rtt: null,
  saveData: false,
  browserInfo: "Chrome",
  cpuCores: 8,
  deviceMemory: null,
}));
vi.mock("@/lib/hooks/usePerformanceMonitor", () => ({
  usePerformanceMonitor: () => performanceData,
}));

/** An answer that is not ok, as fetch gives it over HTTP/2: no statusText. */
const failed = (status: number, body: unknown) =>
  ({
    ok: false,
    status,
    statusText: "",
    json: async () => {
      if (typeof body === "string") throw new SyntaxError("Unexpected token");
      return body;
    },
  }) as unknown as Response;

/**
 * A run waits on timers only (300 ms, then intervals of 200, 150 and 100 ms)
 * before it posts what it gathered to /api/performance-report.
 */
describe("PerformanceReportGenerator", () => {
  beforeEach(() => {
    // Timers only: faking `performance` too rebuilds it without its methods.
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    // src/test/setup.ts spreads `performance` into a plain object, which
    // drops its methods, and the resource phase reads this one.
    Object.defineProperty(performance, "getEntriesByType", {
      value: () => [],
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function generate(response: Response) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    const { result } = renderHook(() => PerformanceReportGenerator({}));
    await act(async () => {
      const run = result.current.generateReport();
      await vi.runAllTimersAsync();
      await run;
    });
    return result;
  }

  it("says why the API refused, though the answer has no status text", async () => {
    // statusText is empty over HTTP/2, which production serves: a failed
    // report read "Failed to generate report: " and nothing more.
    const result = await generate(
      failed(429, {
        error: "Too many requests, please try again later",
        retryAfter: 42,
      }),
    );

    expect(result.current.error).toContain(
      "Too many requests, please try again later",
    );
    expect(result.current.error).toContain("42 s");
  });

  it("marks the phase that failed", async () => {
    // The catch read the phase from its render's closure: phase 0, which had
    // completed, while the request had failed in phase 4.
    const result = await generate(
      failed(500, { error: "Failed to generate performance report" }),
    );

    expect(result.current.phases[0].status).toBe("completed");
    expect(result.current.phases[4].status).toBe("error");
  });

  it("names the status when the answer is not the API's", async () => {
    // A platform's own error page, not JSON.
    const result = await generate(failed(502, "<html>Bad gateway</html>"));

    expect(result.current.error).toContain("HTTP 502");
  });
});
