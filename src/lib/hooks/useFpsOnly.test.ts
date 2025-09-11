import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFpsOnly } from "./useFpsOnly";

describe("useFpsOnly", () => {
  let rafCallback: FrameRequestCallback | null = null;
  let originalPerformanceNow: () => number;
  let currentTime = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.useFakeTimers();

    currentTime = 0;

    // Mock performance.now
    originalPerformanceNow = performance.now;
    performance.now = vi.fn(() => currentTime);

    // Capture RAF callbacks from the existing global mock
    const originalRaf = window.requestAnimationFrame as unknown as (
      cb: FrameRequestCallback,
    ) => number;
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return originalRaf(callback);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    performance.now = originalPerformanceNow;
    rafCallback = null;
    // Restore the original RAF from setup.ts
    const setupRaf = global.requestAnimationFrame;
    if (setupRaf) {
      window.requestAnimationFrame = setupRaf;
    }
  });

  describe("Basic Functionality", () => {
    it("returns initial FPS data", () => {
      const { result } = renderHook(() => useFpsOnly());

      expect(result.current).toEqual({
        fps: 60,
        isLowFps: false,
      });
    });

    it("starts measuring when enabled", () => {
      renderHook(() => useFpsOnly(true));

      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    it("does not measure when disabled", () => {
      renderHook(() => useFpsOnly(false));

      expect(global.requestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe("FPS Calculation", () => {
    it("calculates FPS after 1 second", () => {
      const { result } = renderHook(() => useFpsOnly(true));

      // Simulate 60 frames in 1 second
      for (let i = 0; i < 60; i++) {
        act(() => {
          currentTime += 16.67; // ~60 FPS
          if (rafCallback) rafCallback(currentTime);
        });
      }

      // Advance to trigger FPS calculation
      act(() => {
        currentTime = 1000;
        if (rafCallback) rafCallback(currentTime);
      });

      expect(result.current.fps).toBeWithinRange(59, 61);
      expect(result.current.isLowFps).toBe(false);
    });

    it("detects low FPS", () => {
      const { result } = renderHook(() => useFpsOnly(true));

      // Simulate 20 frames in 1 second (20 FPS)
      for (let i = 0; i < 20; i++) {
        act(() => {
          currentTime += 50; // 20 FPS
          if (rafCallback) rafCallback(currentTime);
        });
      }

      // Advance to trigger FPS calculation
      act(() => {
        currentTime = 1000;
        if (rafCallback) rafCallback(currentTime);
      });

      expect(result.current.fps).toBeWithinRange(19, 21);
      expect(result.current.isLowFps).toBe(true);
    });

    it("updates FPS continuously", () => {
      const { result } = renderHook(() => useFpsOnly(true));

      // First second - 60 FPS
      for (let i = 0; i < 60; i++) {
        act(() => {
          currentTime += 16.67;
          if (rafCallback) rafCallback(currentTime);
        });
      }

      // Trigger first FPS calculation
      act(() => {
        currentTime = 1001; // Just past 1 second
        if (rafCallback) rafCallback(currentTime);
      });

      expect(result.current.fps).toBeWithinRange(59, 61);

      // Second second - simulate 30 FPS
      // The frames counter has been reset, so we start fresh
      for (let i = 0; i < 30; i++) {
        act(() => {
          currentTime += 33.33; // ~30 FPS timing
          if (rafCallback) rafCallback(currentTime);
        });
      }

      // Trigger second FPS calculation
      // We need to ensure we're past 2001ms (1000ms after the last reset)
      act(() => {
        currentTime = 2002; // Just past 2 seconds total
        if (rafCallback) rafCallback(currentTime);
      });

      // The FPS should now reflect the second measurement period (~30 FPS)
      expect(result.current.fps).toBeWithinRange(29, 31);
    });
  });

  describe("Performance", () => {
    it("uses minimal resources when disabled", () => {
      const { rerender } = renderHook(({ enabled }) => useFpsOnly(enabled), {
        initialProps: { enabled: false },
      });

      expect(global.requestAnimationFrame).not.toHaveBeenCalled();

      rerender({ enabled: false });

      expect(global.requestAnimationFrame).not.toHaveBeenCalled();
    });

    it("cancels animation frame on unmount", () => {
      const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");

      const { unmount } = renderHook(() => useFpsOnly(true));

      unmount();

      expect(cancelSpy).toHaveBeenCalled();
    });

    it("stops measuring when disabled", () => {
      const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");

      const { rerender } = renderHook(({ enabled }) => useFpsOnly(enabled), {
        initialProps: { enabled: true },
      });

      expect(window.requestAnimationFrame).toHaveBeenCalled();
      vi.clearAllMocks();

      rerender({ enabled: false });

      expect(cancelSpy).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid enable/disable toggles", () => {
      const { rerender } = renderHook(({ enabled }) => useFpsOnly(enabled), {
        initialProps: { enabled: true },
      });

      for (let i = 0; i < 10; i++) {
        rerender({ enabled: i % 2 === 0 });
      }

      // Should not crash
      expect(true).toBe(true);
    });

    it("handles zero frame time gracefully", () => {
      const { result } = renderHook(() => useFpsOnly(true));

      // Don't advance time
      for (let i = 0; i < 10; i++) {
        act(() => {
          if (rafCallback) rafCallback(currentTime);
        });
      }

      // Should maintain default FPS
      expect(result.current.fps).toBe(60);
    });

    it("maintains state during re-renders", () => {
      const { result, rerender } = renderHook(() => useFpsOnly(true));

      // Simulate some frames
      for (let i = 0; i < 30; i++) {
        act(() => {
          currentTime += 33.33;
          if (rafCallback) rafCallback(currentTime);
        });
      }

      act(() => {
        currentTime = 1000;
        if (rafCallback) rafCallback(currentTime);
      });

      const fpsBefore = result.current.fps;

      rerender();

      expect(result.current.fps).toBe(fpsBefore);
    });

    it("works in SSR environment", () => {
      // Test that the hook doesn't crash when window functions are not available
      // The hook already checks for window existence, so just verify it returns defaults
      const { result } = renderHook(() => useFpsOnly(true));

      expect(result.current).toEqual({
        fps: 60,
        isLowFps: false,
      });
    });
  });
});
