import { describe, it, expect, vi, afterEach } from "vitest";
import { whenIdle } from "./when-idle";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("whenIdle", () => {
  it("waits for an idle callback where the browser has one", () => {
    let idle: IdleRequestCallback | undefined;
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((cb: IdleRequestCallback) => {
        idle = cb;
        return 7;
      }),
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    const task = vi.fn();

    whenIdle(task, { timeout: 500 });
    expect(task).not.toHaveBeenCalled();
    expect(window.requestIdleCallback).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 500 },
    );

    idle?.({ didTimeout: false, timeRemaining: () => 10 });
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("falls back to the next macrotask where it does not (Safari)", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const task = vi.fn();

    whenIdle(task);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("can be cancelled before it runs", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const task = vi.fn();

    const cancel = whenIdle(task);
    cancel();
    cancel(); // twice is harmless
    vi.advanceTimersByTime(10);

    expect(task).not.toHaveBeenCalled();
  });
});
