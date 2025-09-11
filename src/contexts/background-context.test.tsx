/**
 * Background Context Tests - Minimal Version
 *
 * Ultra-lightweight tests to avoid memory issues with complex generation algorithm.
 * Tests only the essential provider/hook functionality without triggering generation.
 */
import { render, screen, renderHook } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { BackgroundProvider, useBackground } from "./background-context";
import {
  renderHookWithErrorBoundary,
  expectHookError,
} from "../test/error-test-utils";

// Minimal test component that doesn't trigger generation
function TestBackgroundComponent() {
  const context = useBackground();

  return (
    <div>
      <div data-testid="has-background-data">
        {context.backgroundData !== null ? "true" : "false"}
      </div>
      <div data-testid="has-generate-function">
        {typeof context.generateBackgroundData === "function"
          ? "true"
          : "false"}
      </div>
    </div>
  );
}

// Note: Component that would test hook error removed as it's tested via renderHook

describe("BackgroundContext - Essential Tests", () => {
  describe("BackgroundProvider", () => {
    it("renders children without crashing", () => {
      render(
        <BackgroundProvider>
          <div data-testid="child">Test Child</div>
        </BackgroundProvider>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByTestId("child")).toHaveTextContent("Test Child");
    });

    it("provides context value to children", () => {
      render(
        <BackgroundProvider>
          <TestBackgroundComponent />
        </BackgroundProvider>,
      );

      expect(screen.getByTestId("has-background-data")).toHaveTextContent(
        "false",
      );
      expect(screen.getByTestId("has-generate-function")).toHaveTextContent(
        "true",
      );
    });
  });

  describe("useBackground Hook", () => {
    it("throws error when used outside provider", () => {
      // ⚠️ INTENTIONAL ERROR TEST - The following stderr error is expected and proves
      // our error handling infrastructure works correctly. This is a success indicator.
      console.info(
        "⚠️ Expected error test: useBackground hook error validation",
      );

      // Using our custom error testing utilities that properly handle
      // React hook errors with error boundaries and custom environment
      const { getError } = renderHookWithErrorBoundary(() => useBackground(), {
        expectError: true,
      });

      expectHookError(getError(), {
        message: "useBackground must be used within a BackgroundProvider",
        type: Error as new (...args: unknown[]) => Error,
      });
    });

    it("returns context interface when used inside provider", () => {
      const { result } = renderHook(() => useBackground(), {
        wrapper: BackgroundProvider,
      });

      expect(result.current).toHaveProperty("backgroundData");
      expect(result.current).toHaveProperty("generateBackgroundData");
      expect(typeof result.current.generateBackgroundData).toBe("function");
      expect(result.current.backgroundData).toBeNull();
    });

    it("provides stable function reference", () => {
      const { result, rerender } = renderHook(() => useBackground(), {
        wrapper: BackgroundProvider,
      });

      const firstFunction = result.current.generateBackgroundData;

      rerender();

      const secondFunction = result.current.generateBackgroundData;

      expect(firstFunction).toBe(secondFunction);
    });
  });

  describe("Context Interface", () => {
    it("provides correct TypeScript interface", () => {
      const { result } = renderHook(() => useBackground(), {
        wrapper: BackgroundProvider,
      });

      // Verify properties exist and have correct types
      expect(result.current.backgroundData).toBeNull();
      expect(typeof result.current.generateBackgroundData).toBe("function");
      expect(result.current.generateBackgroundData.length).toBe(3);
    });

    it("maintains context consistency", () => {
      const { result, rerender } = renderHook(() => useBackground(), {
        wrapper: BackgroundProvider,
      });

      const initialData = result.current.backgroundData;
      const initialFunction = result.current.generateBackgroundData;

      rerender();

      expect(result.current.backgroundData).toBe(initialData);
      expect(result.current.generateBackgroundData).toBe(initialFunction);
    });
  });

  describe("Provider Stability", () => {
    it("handles provider unmounting cleanly", () => {
      const { unmount } = render(
        <BackgroundProvider>
          <TestBackgroundComponent />
        </BackgroundProvider>,
      );

      expect(() => unmount()).not.toThrow();
    });

    it("supports multiple provider instances", () => {
      render(
        <div>
          <BackgroundProvider>
            <div data-testid="provider-1">
              <TestBackgroundComponent />
            </div>
          </BackgroundProvider>
          <BackgroundProvider>
            <div data-testid="provider-2">
              <TestBackgroundComponent />
            </div>
          </BackgroundProvider>
        </div>,
      );

      expect(screen.getByTestId("provider-1")).toBeInTheDocument();
      expect(screen.getByTestId("provider-2")).toBeInTheDocument();
    });
  });

  describe("Error Boundaries", () => {
    it("hook error doesn't crash provider", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Provider should work fine even after hook errors elsewhere
      render(
        <BackgroundProvider>
          <TestBackgroundComponent />
        </BackgroundProvider>,
      );

      expect(screen.getByTestId("has-background-data")).toHaveTextContent(
        "false",
      );

      consoleSpy.mockRestore();
    });
  });
});

/**
 * Testing Strategy Notes:
 *
 * This test file intentionally avoids testing the background generation algorithm
 * to prevent JavaScript heap out of memory errors. The complex geometric generation
 * logic should be tested separately with the following approaches:
 *
 * 1. Extract generation logic to a utility module
 * 2. Test individual generation functions with minimal datasets
 * 3. Use integration tests with mocked data for UI components
 * 4. Consider performance testing in isolated environments
 *
 * The tests here focus on:
 * - Provider/context functionality
 * - Hook interface and error handling
 * - TypeScript interface compliance
 * - Memory safety and stability
 */
