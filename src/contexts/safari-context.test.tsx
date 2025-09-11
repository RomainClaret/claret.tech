/**
 * Safari Context Tests
 *
 * Browser-specific Safari detection context that manages Safari detection,
 * animation preferences, and DOM manipulation for optimal performance.
 */
import { render, screen, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { SafariProvider, useSafariContext } from "./safari-context";

// Mock the safari-detection module
vi.mock("@/lib/utils/safari-detection", () => ({
  detectSafari: vi.fn(),
}));

// Import the mocked function
import { detectSafari } from "@/lib/utils/safari-detection";
const mockDetectSafari = vi.mocked(detectSafari);

// Test component to access context
function TestSafariComponent() {
  const context = useSafariContext();
  return (
    <div>
      <div data-testid="is-safari">{context.isSafari.toString()}</div>
      <div data-testid="should-reduce-animations">
        {context.shouldReduceAnimations.toString()}
      </div>
      <div data-testid="is-hydrated">{context.isHydrated.toString()}</div>
    </div>
  );
}

// Mock document.body for DOM manipulation testing
const mockBodySetAttribute = vi.fn();
const mockClassListAdd = vi.fn();
const mockClassListRemove = vi.fn();

// Store original body methods for restoration
const originalSetAttribute = document.body.setAttribute;
const originalClassListAdd = document.body.classList.add;
const originalClassListRemove = document.body.classList.remove;

describe("SafariContext", () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock only the document.body methods we need
    document.body.setAttribute = mockBodySetAttribute;
    document.body.classList.add = mockClassListAdd;
    document.body.classList.remove = mockClassListRemove;

    // Default mock implementation
    mockDetectSafari.mockReturnValue({
      isSafari: false,
      source: "userAgent",
      timestamp: Date.now(),
    });
  });

  afterEach(() => {
    // Restore original body methods
    document.body.setAttribute = originalSetAttribute;
    document.body.classList.add = originalClassListAdd;
    document.body.classList.remove = originalClassListRemove;
  });

  describe("SafariProvider", () => {
    it("renders children without crashing", () => {
      render(
        <SafariProvider>
          <div data-testid="child">Test Child</div>
        </SafariProvider>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByTestId("child")).toHaveTextContent("Test Child");
    });

    it("uses initial Safari prop from server", () => {
      render(
        <SafariProvider initialSafari={true}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      expect(screen.getByTestId("is-safari")).toHaveTextContent("true");
      expect(screen.getByTestId("should-reduce-animations")).toHaveTextContent(
        "true",
      );
    });

    it("falls back to client detection when no initial prop", () => {
      mockDetectSafari.mockReturnValue({
        isSafari: true,
        source: "userAgent",
        timestamp: Date.now(),
      });

      render(
        <SafariProvider>
          <TestSafariComponent />
        </SafariProvider>,
      );

      expect(mockDetectSafari).toHaveBeenCalled();
      expect(screen.getByTestId("is-safari")).toHaveTextContent("true");
    });

    it("marks as hydrated after mount", async () => {
      render(
        <SafariProvider>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Wait for useEffect to run and set hydrated state
      await waitFor(() => {
        expect(screen.getByTestId("is-hydrated")).toHaveTextContent("true");
      });
    });
  });

  describe("useSafariContext", () => {
    it("returns context values correctly", async () => {
      render(
        <SafariProvider initialSafari={true}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      expect(screen.getByTestId("is-safari")).toHaveTextContent("true");
      expect(screen.getByTestId("should-reduce-animations")).toHaveTextContent(
        "true",
      );

      // Wait for hydration
      await waitFor(() => {
        expect(screen.getByTestId("is-hydrated")).toHaveTextContent("true");
      });
    });

    it("works correctly with non-Safari detection", () => {
      mockDetectSafari.mockReturnValue({
        isSafari: false,
        source: "userAgent",
        timestamp: Date.now(),
      });

      render(
        <SafariProvider>
          <TestSafariComponent />
        </SafariProvider>,
      );

      expect(screen.getByTestId("is-safari")).toHaveTextContent("false");
      expect(screen.getByTestId("should-reduce-animations")).toHaveTextContent(
        "false",
      );
    });
  });

  describe("Safari Detection Logic", () => {
    it("detects Safari correctly from initial prop", async () => {
      render(
        <SafariProvider initialSafari={true}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      expect(screen.getByTestId("is-safari")).toHaveTextContent("true");

      // Wait for useEffect - detectSafari may be called to check for updates
      await waitFor(() => {
        expect(screen.getByTestId("is-hydrated")).toHaveTextContent("true");
      });
    });

    it("sets shouldReduceAnimations for Safari", () => {
      render(
        <SafariProvider initialSafari={true}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      expect(screen.getByTestId("should-reduce-animations")).toHaveTextContent(
        "true",
      );
    });

    it("does not reduce animations for non-Safari browsers", () => {
      render(
        <SafariProvider initialSafari={false}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      expect(screen.getByTestId("should-reduce-animations")).toHaveTextContent(
        "false",
      );
    });

    it("updates from localStorage detection if available", async () => {
      // Initially set as non-Safari
      render(
        <SafariProvider initialSafari={false}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      expect(screen.getByTestId("is-safari")).toHaveTextContent("false");

      // Mock localStorage detection returning Safari
      mockDetectSafari.mockReturnValue({
        isSafari: true,
        source: "localStorage",
        timestamp: Date.now(),
      });

      // Wait for useEffect to update
      await waitFor(() => {
        expect(mockDetectSafari).toHaveBeenCalled();
      });
    });

    it("handles non-Safari browsers correctly", () => {
      mockDetectSafari.mockReturnValue({
        isSafari: false,
        source: "userAgent",
        timestamp: Date.now(),
      });

      render(
        <SafariProvider>
          <TestSafariComponent />
        </SafariProvider>,
      );

      expect(screen.getByTestId("is-safari")).toHaveTextContent("false");
      expect(screen.getByTestId("should-reduce-animations")).toHaveTextContent(
        "false",
      );
    });

    it("maintains hydration state correctly", async () => {
      render(
        <SafariProvider>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Wait for hydration to complete
      await waitFor(() => {
        expect(screen.getByTestId("is-hydrated")).toHaveTextContent("true");
      });
    });

    it("prevents hydration mismatches by using initial prop", async () => {
      // Server provides initial Safari state
      render(
        <SafariProvider initialSafari={true}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Should use initial prop for consistent rendering
      expect(screen.getByTestId("is-safari")).toHaveTextContent("true");

      // Wait for hydration
      await waitFor(() => {
        expect(screen.getByTestId("is-hydrated")).toHaveTextContent("true");
      });
    });

    it("handles edge case with undefined initial prop", () => {
      render(
        <SafariProvider initialSafari={undefined}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Should fall back to client detection
      expect(mockDetectSafari).toHaveBeenCalled();
    });
  });

  describe("DOM Manipulation", () => {
    it("sets data-safari attribute on body after hydration", async () => {
      render(
        <SafariProvider initialSafari={true}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Wait for useEffect to run
      await waitFor(() => {
        expect(mockBodySetAttribute).toHaveBeenCalledWith(
          "data-safari",
          "true",
        );
      });
    });

    it("adds enable-animations class for non-Safari browsers", async () => {
      render(
        <SafariProvider initialSafari={false}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Wait for useEffect to run
      await waitFor(() => {
        expect(mockClassListAdd).toHaveBeenCalledWith("enable-animations");
        expect(mockClassListRemove).not.toHaveBeenCalledWith(
          "enable-animations",
        );
      });
    });

    it("removes enable-animations class for Safari browsers", async () => {
      render(
        <SafariProvider initialSafari={true}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Wait for useEffect to run
      await waitFor(() => {
        expect(mockClassListRemove).toHaveBeenCalledWith("enable-animations");
        expect(mockClassListAdd).not.toHaveBeenCalledWith("enable-animations");
      });
    });

    it("handles different initial Safari prop values", async () => {
      // Test with Safari enabled via prop
      const { unmount } = render(
        <SafariProvider initialSafari={true}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Should show Safari state
      expect(screen.getByTestId("is-safari")).toHaveTextContent("true");
      expect(screen.getByTestId("should-reduce-animations")).toHaveTextContent(
        "true",
      );

      // Wait for DOM manipulation
      await waitFor(() => {
        expect(mockBodySetAttribute).toHaveBeenCalledWith(
          "data-safari",
          "true",
        );
        expect(mockClassListRemove).toHaveBeenCalledWith("enable-animations");
      });

      // Clean up
      unmount();
      vi.clearAllMocks();

      // Test with Safari disabled via prop
      render(
        <SafariProvider initialSafari={false}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Should show non-Safari state
      expect(screen.getByTestId("is-safari")).toHaveTextContent("false");
      expect(screen.getByTestId("should-reduce-animations")).toHaveTextContent(
        "false",
      );

      // Wait for DOM manipulation
      await waitFor(() => {
        expect(mockBodySetAttribute).toHaveBeenCalledWith(
          "data-safari",
          "false",
        );
        expect(mockClassListAdd).toHaveBeenCalledWith("enable-animations");
      });
    });

    it("handles context state correctly during hydration", async () => {
      // Test that context maintains correct state during hydration process
      render(
        <SafariProvider initialSafari={true}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Component should render with correct Safari state
      expect(screen.getByTestId("is-safari")).toHaveTextContent("true");
      expect(screen.getByTestId("should-reduce-animations")).toHaveTextContent(
        "true",
      );

      // Wait for hydration and DOM manipulation
      await waitFor(() => {
        expect(screen.getByTestId("is-hydrated")).toHaveTextContent("true");
        expect(mockBodySetAttribute).toHaveBeenCalledWith(
          "data-safari",
          "true",
        );
        expect(mockClassListRemove).toHaveBeenCalledWith("enable-animations");
      });
    });
  });

  describe("Integration Tests", () => {
    beforeEach(() => {
      // Reset mocks for integration tests
      vi.clearAllMocks();

      // Ensure DOM methods work normally for integration tests
      mockBodySetAttribute.mockImplementation(() => {});
      mockClassListAdd.mockImplementation(() => {});
      mockClassListRemove.mockImplementation(() => {});
    });

    it("handles complex safari detection scenarios", async () => {
      // Start with client detection
      mockDetectSafari.mockReturnValue({
        isSafari: false,
        source: "userAgent",
        timestamp: Date.now(),
      });

      render(
        <SafariProvider>
          <TestSafariComponent />
        </SafariProvider>,
      );

      expect(screen.getByTestId("is-safari")).toHaveTextContent("false");

      // Wait for hydration
      await waitFor(() => {
        expect(screen.getByTestId("is-hydrated")).toHaveTextContent("true");
      });

      // Verify DOM manipulation
      expect(mockBodySetAttribute).toHaveBeenCalledWith("data-safari", "false");
      expect(mockClassListAdd).toHaveBeenCalledWith("enable-animations");
    });

    it("maintains consistency between context and DOM state", async () => {
      render(
        <SafariProvider initialSafari={true}>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Context shows Safari
      expect(screen.getByTestId("is-safari")).toHaveTextContent("true");
      expect(screen.getByTestId("should-reduce-animations")).toHaveTextContent(
        "true",
      );

      // DOM should match
      await waitFor(() => {
        expect(mockBodySetAttribute).toHaveBeenCalledWith(
          "data-safari",
          "true",
        );
        expect(mockClassListRemove).toHaveBeenCalledWith("enable-animations");
      });
    });

    it("handles rapid detection changes without conflicts", async () => {
      let detectionResult = {
        isSafari: false,
        source: "userAgent" as const,
        timestamp: Date.now(),
      };
      mockDetectSafari.mockImplementation(() => detectionResult);

      render(
        <SafariProvider>
          <TestSafariComponent />
        </SafariProvider>,
      );

      // Wait for initial setup
      await waitFor(() => {
        expect(screen.getByTestId("is-hydrated")).toHaveTextContent("true");
      });

      // Change detection rapidly
      act(() => {
        detectionResult = {
          isSafari: true,
          source: "userAgent",
          timestamp: Date.now(),
        };
      });

      // Should handle changes without errors
      await waitFor(() => {
        expect(mockDetectSafari).toHaveBeenCalled();
      });
    });
  });
});
