import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReducedMotion } from "./useReducedMotion";
import type {
  MockMatchMedia,
  MockMediaQueryList,
  MockMediaQueryListEvent,
} from "@/test/mock-types";

describe("useReducedMotion", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let mockMatchMedia: MockMatchMedia;
  let listeners: Record<string, ((e: MockMediaQueryListEvent) => void)[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    originalMatchMedia = window.matchMedia;
    listeners = {};

    mockMatchMedia = vi.fn(
      (query: string): MockMediaQueryList => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(
          (event: string, handler: (e: MockMediaQueryListEvent) => void) => {
            if (!listeners[event]) {
              listeners[event] = [];
            }
            listeners[event].push(handler);
          },
        ),
        removeEventListener: vi.fn(
          (event: string, handler: (e: MockMediaQueryListEvent) => void) => {
            if (listeners[event]) {
              listeners[event] = listeners[event].filter((h) => h !== handler);
            }
          },
        ),
        dispatchEvent: vi.fn(),
        onchange: null,
        addListener: vi.fn(), // Deprecated but sometimes still used
        removeListener: vi.fn(), // Deprecated but sometimes still used
      }),
    );

    window.matchMedia = mockMatchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("returns false when prefers-reduced-motion is not set", () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const { result } = renderHook(() => useReducedMotion());

      expect(result.current).toBe(false);
    });

    it("returns true when prefers-reduced-motion is set", () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const { result } = renderHook(() => useReducedMotion());

      expect(result.current).toBe(true);
    });

    it("calls matchMedia with correct query", () => {
      renderHook(() => useReducedMotion());

      expect(mockMatchMedia).toHaveBeenCalledWith(
        "(prefers-reduced-motion: reduce)",
      );
    });
  });

  describe("Change Detection", () => {
    it("updates when preference changes", () => {
      const addEventListenerMock = vi.fn();
      let changeHandler: ((e: MockMediaQueryListEvent) => void) | null = null;

      mockMatchMedia.mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(
          (event: string, handler: (e: MockMediaQueryListEvent) => void) => {
            if (event === "change") {
              changeHandler = handler;
            }
            addEventListenerMock(event, handler);
          },
        ),
        removeEventListener: vi.fn(),
      });

      const { result, rerender } = renderHook(() => useReducedMotion());

      expect(result.current).toBe(false);

      // Simulate preference change
      act(() => {
        if (changeHandler) {
          changeHandler({ matches: true });
        }
      });

      rerender();

      expect(result.current).toBe(true);
    });

    it("adds change event listener on mount", () => {
      const addEventListenerMock = vi.fn();

      mockMatchMedia.mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: addEventListenerMock,
        removeEventListener: vi.fn(),
      });

      renderHook(() => useReducedMotion());

      expect(addEventListenerMock).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });

    it("removes change event listener on unmount", () => {
      const removeEventListenerMock = vi.fn();
      const addEventListenerMock = vi.fn();

      mockMatchMedia.mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { unmount } = renderHook(() => useReducedMotion());

      unmount();

      expect(removeEventListenerMock).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });
  });

  describe("Browser Compatibility", () => {
    it("handles server-side rendering", () => {
      // The hook checks for window in useEffect, so SSR should work
      const { result } = renderHook(() => useReducedMotion());

      // Should return false initially
      expect(result.current).toBe(false);
    });

    it("handles old browser API", () => {
      const addListenerMock = vi.fn();
      const removeListenerMock = vi.fn();

      mockMatchMedia.mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: undefined, // Old browser doesn't have this
        removeEventListener: undefined,
        addListener: addListenerMock, // Has deprecated API
        removeListener: removeListenerMock,
      });

      const { unmount } = renderHook(() => useReducedMotion());

      expect(addListenerMock).toHaveBeenCalled();

      unmount();

      expect(removeListenerMock).toHaveBeenCalled();
    });
  });

  describe("Performance", () => {
    it("does not cause unnecessary re-renders", () => {
      // Use fake timers to control timing precisely
      vi.useFakeTimers();

      const renderSpy = vi.fn();

      const { rerender } = renderHook(() => {
        renderSpy();
        return useReducedMotion();
      });

      // Wait for any useEffect to complete to avoid timing issues
      act(() => {
        // Force any pending effects to flush
        vi.runAllTimers();
      });

      // Get initial render count after effects complete
      const initialRenders = renderSpy.mock.calls.length;

      // Ensure rerender is also wrapped in act for consistent timing
      act(() => {
        rerender();
      });

      // Should only have one additional render from rerender()
      // In isolation: 1 initial + 1 rerender = 2
      // In batch mode with contamination: may be 2 initial + 1 rerender = 3
      // Allow for batch mode variance
      const finalRenderCount = renderSpy.mock.calls.length;
      const additionalRenders = finalRenderCount - initialRenders;
      expect(additionalRenders).toBe(1);

      // Clean up timers
      vi.useRealTimers();
    });

    it("only creates one matchMedia query", () => {
      renderHook(() => useReducedMotion());

      expect(mockMatchMedia).toHaveBeenCalledTimes(1);
    });
  });

  describe("Multiple Instances", () => {
    it("responds to the same media query across instances", () => {
      // Each hook instance has its own state, but they all respond to the same media query
      const changeHandlers: ((e: MockMediaQueryListEvent) => void)[] = [];

      mockMatchMedia.mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(
          (event: string, handler: (e: MockMediaQueryListEvent) => void) => {
            if (event === "change") {
              changeHandlers.push(handler);
            }
          },
        ),
        removeEventListener: vi.fn(),
      });

      const { result: result1 } = renderHook(() => useReducedMotion());
      const { result: result2 } = renderHook(() => useReducedMotion());

      // Both should have the same initial value
      expect(result1.current).toBe(false);
      expect(result2.current).toBe(false);

      // Change preference - each instance has its own handler
      act(() => {
        changeHandlers.forEach((handler) => {
          handler({ matches: true });
        });
      });

      // Both should update to the same value
      expect(result1.current).toBe(true);
      expect(result2.current).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid preference changes", () => {
      let changeHandler: ((e: MockMediaQueryListEvent) => void) | null = null;

      mockMatchMedia.mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(
          (event: string, handler: (e: MockMediaQueryListEvent) => void) => {
            if (event === "change") {
              changeHandler = handler;
            }
          },
        ),
        removeEventListener: vi.fn(),
      });

      const { result } = renderHook(() => useReducedMotion());

      // Rapid changes
      act(() => {
        if (changeHandler) {
          changeHandler({ matches: true });
          changeHandler({ matches: false });
          changeHandler({ matches: true });
          changeHandler({ matches: false });
          changeHandler({ matches: true });
        }
      });

      expect(result.current).toBe(true);
    });

    it("handles events with boolean matches values", () => {
      let changeHandler: ((e: MockMediaQueryListEvent) => void) | null = null;

      mockMatchMedia.mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(
          (event: string, handler: (e: MockMediaQueryListEvent) => void) => {
            if (event === "change") {
              changeHandler = handler;
            }
          },
        ),
        removeEventListener: vi.fn(),
      });

      const { result } = renderHook(() => useReducedMotion());

      // Initial state
      expect(result.current).toBe(false);

      // Send valid event with true
      act(() => {
        if (changeHandler) {
          changeHandler({ matches: true });
        }
      });

      expect(result.current).toBe(true);

      // Send valid event with false
      act(() => {
        if (changeHandler) {
          changeHandler({ matches: false });
        }
      });

      expect(result.current).toBe(false);

      // Send another true event
      act(() => {
        if (changeHandler) {
          changeHandler({ matches: true });
        }
      });

      expect(result.current).toBe(true);
    });
  });
});
