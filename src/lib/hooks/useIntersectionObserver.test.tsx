import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, waitFor } from "@testing-library/react";
import { useIntersectionObserver } from "./useIntersectionObserver";
import React from "react";

// Mock types for IntersectionObserver
interface MockIntersectionObserver {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

type MockIntersectionObserverConstructor = ReturnType<typeof vi.fn> & {
  new (
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ): MockIntersectionObserver;
};

describe("useIntersectionObserver", () => {
  let mockIntersectionObserver: MockIntersectionObserverConstructor;
  let observeCallback: IntersectionObserverCallback | null = null;
  let observerInstance: MockIntersectionObserver;

  beforeEach(() => {
    vi.clearAllMocks();

    observerInstance = {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };

    mockIntersectionObserver = vi.fn(
      (
        callback: IntersectionObserverCallback,
        _options?: IntersectionObserverInit,
      ) => {
        observeCallback = callback;
        return observerInstance;
      },
    );

    global.IntersectionObserver =
      mockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Test component that properly uses the hook
  const TestComponent = ({
    options,
    onIntersectionChange,
  }: {
    options?: Parameters<typeof useIntersectionObserver>[0];
    onIntersectionChange?: (isIntersecting: boolean) => void;
  }) => {
    const [ref, isIntersecting] = useIntersectionObserver(options);

    React.useEffect(() => {
      onIntersectionChange?.(isIntersecting);
    }, [isIntersecting, onIntersectionChange]);

    return (
      <div ref={ref} data-testid="observed">
        {isIntersecting ? "Visible" : "Hidden"}
      </div>
    );
  };

  describe("Basic Functionality", () => {
    it("returns a ref and isIntersecting state", () => {
      const { getByTestId } = render(<TestComponent />);
      const element = getByTestId("observed");

      expect(element.textContent).toBe("Hidden");
      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    it("creates IntersectionObserver with default options", () => {
      render(<TestComponent />);

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        {
          threshold: 0.1,
          root: null,
          rootMargin: "0px",
        },
      );
    });

    it("creates IntersectionObserver with custom options", () => {
      const options = {
        threshold: 0.5,
        rootMargin: "10px",
      };

      render(<TestComponent options={options} />);

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          threshold: 0.5,
          rootMargin: "10px",
        }),
      );
    });

    it("observes the element when component mounts", () => {
      const { getByTestId } = render(<TestComponent />);
      const element = getByTestId("observed");

      expect(observerInstance.observe).toHaveBeenCalledWith(element);
    });
  });

  describe("Intersection Detection", () => {
    it("updates isIntersecting when element enters viewport", async () => {
      const { getByTestId } = render(<TestComponent />);
      const element = getByTestId("observed");

      expect(element.textContent).toBe("Hidden");

      // Simulate intersection
      act(() => {
        if (observeCallback) {
          observeCallback(
            [
              {
                isIntersecting: true,
                target: element,
                intersectionRatio: 1,
                boundingClientRect: {} as DOMRectReadOnly,
                intersectionRect: {} as DOMRectReadOnly,
                rootBounds: {} as DOMRectReadOnly,
                time: 0,
              } as IntersectionObserverEntry,
            ],
            observerInstance as unknown as IntersectionObserver,
          );
        }
      });

      await waitFor(() => {
        expect(getByTestId("observed").textContent).toBe("Visible");
      });
    });

    it("updates isIntersecting when element leaves viewport", async () => {
      const { getByTestId } = render(<TestComponent />);
      const element = getByTestId("observed");

      // First enter viewport
      act(() => {
        if (observeCallback) {
          observeCallback(
            [
              {
                isIntersecting: true,
                target: element,
                boundingClientRect: {} as DOMRectReadOnly,
                intersectionRatio: 1,
                intersectionRect: {} as DOMRectReadOnly,
                rootBounds: {} as DOMRectReadOnly,
                time: 0,
              } as IntersectionObserverEntry,
            ],
            observerInstance as unknown as IntersectionObserver,
          );
        }
      });

      await waitFor(() => {
        expect(getByTestId("observed").textContent).toBe("Visible");
      });

      // Then leave viewport
      act(() => {
        if (observeCallback) {
          observeCallback(
            [
              {
                isIntersecting: false,
                target: element,
                boundingClientRect: {} as DOMRectReadOnly,
                intersectionRatio: 0,
                intersectionRect: {} as DOMRectReadOnly,
                rootBounds: {} as DOMRectReadOnly,
                time: 0,
              } as IntersectionObserverEntry,
            ],
            observerInstance as unknown as IntersectionObserver,
          );
        }
      });

      await waitFor(() => {
        expect(getByTestId("observed").textContent).toBe("Hidden");
      });
    });

    it("handles multiple entries correctly", () => {
      const { getByTestId } = render(<TestComponent />);
      const element = getByTestId("observed");

      if (observeCallback) {
        observeCallback(
          [
            {
              isIntersecting: false,
              target: element,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRatio: 0,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: {} as DOMRectReadOnly,
              time: 0,
            } as IntersectionObserverEntry,
            {
              isIntersecting: true,
              target: element,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRatio: 1,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: {} as DOMRectReadOnly,
              time: 0,
            } as IntersectionObserverEntry,
          ],
          observerInstance as unknown as IntersectionObserver,
        );
      }

      // Should use the first entry
      expect(getByTestId("observed").textContent).toBe("Hidden");
    });
  });

  describe("Threshold Options", () => {
    it("respects single threshold value", () => {
      render(<TestComponent options={{ threshold: 0.5 }} />);

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ threshold: 0.5 }),
      );
    });

    it("respects multiple threshold values", () => {
      render(
        <TestComponent options={{ threshold: [0, 0.25, 0.5, 0.75, 1] }} />,
      );

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ threshold: [0, 0.25, 0.5, 0.75, 1] }),
      );
    });
  });

  describe("Root and RootMargin Options", () => {
    it("uses custom root element", () => {
      const rootElement = document.createElement("div");

      render(<TestComponent options={{ root: rootElement }} />);

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ root: rootElement }),
      );
    });

    it("uses custom root margin", () => {
      render(<TestComponent options={{ rootMargin: "20px 10px" }} />);

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ rootMargin: "20px 10px" }),
      );
    });
  });

  describe("Cleanup", () => {
    it("disconnects observer on unmount", () => {
      const { unmount } = render(<TestComponent />);

      unmount();

      expect(observerInstance.disconnect).toHaveBeenCalled();
    });

    it("creates new observer when options change", () => {
      const { rerender } = render(<TestComponent options={{ threshold: 0 }} />);

      expect(mockIntersectionObserver).toHaveBeenCalledTimes(1);

      rerender(<TestComponent options={{ threshold: 0.5 }} />);

      // Should create new observer with new options
      expect(mockIntersectionObserver).toHaveBeenCalledTimes(2);
      expect(observerInstance.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("Browser Compatibility", () => {
    it("handles missing IntersectionObserver gracefully", () => {
      global.IntersectionObserver =
        undefined as unknown as typeof IntersectionObserver;

      const { getByTestId } = render(<TestComponent />);

      expect(getByTestId("observed").textContent).toBe("Hidden");
      expect(() => render(<TestComponent />)).not.toThrow();
    });

    it("handles IntersectionObserver constructor error", () => {
      mockIntersectionObserver.mockImplementation(() => {
        throw new Error("IntersectionObserver not supported");
      });

      const { getByTestId } = render(<TestComponent />);

      expect(getByTestId("observed").textContent).toBe("Hidden");
    });
  });

  describe("Performance", () => {
    it("only creates one observer per component instance", () => {
      const { rerender } = render(<TestComponent />);

      expect(mockIntersectionObserver).toHaveBeenCalledTimes(1);

      // Force re-render without changing options
      rerender(<TestComponent />);

      // Should not create new observer
      expect(mockIntersectionObserver).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("handles observer callback errors gracefully", () => {
      render(<TestComponent />);

      // Send malformed data
      expect(() => {
        if (observeCallback) {
          observeCallback(
            null as unknown as IntersectionObserverEntry[],
            observerInstance as unknown as IntersectionObserver,
          );
        }
      }).not.toThrow();
    });

    it("maintains state consistency through rapid updates", () => {
      const { getByTestId } = render(<TestComponent />);
      const element = getByTestId("observed");

      // Multiple rapid updates
      if (observeCallback) {
        for (let i = 0; i < 10; i++) {
          observeCallback(
            [
              {
                isIntersecting: i % 2 === 0,
                target: element,
                boundingClientRect: {} as DOMRectReadOnly,
                intersectionRatio: i % 2 === 0 ? 1 : 0,
                intersectionRect: {} as DOMRectReadOnly,
                rootBounds: {} as DOMRectReadOnly,
                time: 0,
              } as IntersectionObserverEntry,
            ],
            observerInstance as unknown as IntersectionObserver,
          );
        }
      }

      // Final state should be consistent
      expect(getByTestId("observed").textContent).toBe("Hidden");
    });

    it("works with multiple hook instances", () => {
      const MultipleObservers = () => {
        const [ref1, isIntersecting1] = useIntersectionObserver();
        const [ref2, isIntersecting2] = useIntersectionObserver();

        return (
          <>
            <div ref={ref1} data-testid="element1">
              {isIntersecting1 ? "Visible1" : "Hidden1"}
            </div>
            <div ref={ref2} data-testid="element2">
              {isIntersecting2 ? "Visible2" : "Hidden2"}
            </div>
          </>
        );
      };

      const { getByTestId } = render(<MultipleObservers />);

      expect(getByTestId("element1").textContent).toBe("Hidden1");
      expect(getByTestId("element2").textContent).toBe("Hidden2");
      expect(mockIntersectionObserver).toHaveBeenCalledTimes(2);
    });
  });
});
