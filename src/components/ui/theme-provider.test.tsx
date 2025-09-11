/**
 * Theme Provider Tests
 *
 * Critical infrastructure component that handles theme switching,
 * persistence across sessions, and DOM class management.
 */

import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import { ThemeProvider, useTheme } from "./theme-provider";

// Use vi.hoisted for proper mock hoisting
const { mockSetTheme } = vi.hoisted(() => {
  return {
    mockSetTheme: vi.fn(),
  };
});

// Mock the theme-cookie module with hoisted mock
vi.mock("@/lib/theme-cookie", () => ({
  setTheme: mockSetTheme,
  Theme: "light" as const,
}));

// Mock dev-logger to properly call console.warn in tests
vi.mock("@/lib/utils/dev-logger", () => ({
  logWarning: vi.fn((message: string, context?: string) => {
    console.warn(`[${context || "Warning"}]:`, message);
  }),
}));

// Test component to access theme context
function TestComponent() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <button data-testid="set-light" onClick={() => setTheme("light")}>
        Light
      </button>
      <button data-testid="set-dark" onClick={() => setTheme("dark")}>
        Dark
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  let mockSetCookieTheme: ReturnType<typeof vi.fn>;
  let mockLocalStorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };
  let mockDocumentElement: {
    classList: {
      add: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    // Reset modules to ensure clean state
    vi.resetModules();

    // Setup mocks
    mockSetCookieTheme = vi.fn();
    mockSetTheme.mockImplementation(mockSetCookieTheme);

    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    // Mock document.documentElement.classList
    mockDocumentElement = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };

    // Only define documentElement if it's not already defined or is configurable
    const descriptor = Object.getOwnPropertyDescriptor(
      document,
      "documentElement",
    );
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(document, "documentElement", {
        value: mockDocumentElement,
        writable: true,
        configurable: true,
      });
    } else {
      // If it exists and isn't configurable, just mock the classList
      Object.defineProperty(document.documentElement, "classList", {
        value: {
          add: vi.fn(),
          remove: vi.fn(),
        },
        writable: true,
        configurable: true,
      });
      mockDocumentElement = document.documentElement as unknown as typeof mockDocumentElement;
    }

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up React components first
    cleanup();

    // Clear all mocks and timers
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();

    // Reset mock implementations
    mockSetTheme.mockReset();

    // Clear document body
    document.body.innerHTML = "";
  });

  afterAll(() => {
    // Final cleanup
    cleanup();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe("Provider Initialization", () => {
    it("initializes with provided theme", () => {
      render(
        <ThemeProvider initialTheme="dark">
          <TestComponent />
        </ThemeProvider>,
      );

      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });

    it("applies initial theme to document element", () => {
      render(
        <ThemeProvider initialTheme="light">
          <div>test</div>
        </ThemeProvider>,
      );

      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith(
        "light",
        "dark",
      );
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith("light");
    });

    it("syncs with localStorage on mount if different from initial", async () => {
      mockLocalStorage.getItem.mockReturnValue("dark");

      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      });

      expect(mockSetCookieTheme).toHaveBeenCalledWith("dark");
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith("dark");
    });

    it("ignores localStorage if same as initial theme", async () => {
      mockLocalStorage.getItem.mockReturnValue("light");

      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      // Should not call setTheme again since themes match
      expect(mockSetCookieTheme).not.toHaveBeenCalled();
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    });

    it("ignores invalid localStorage values", async () => {
      mockLocalStorage.getItem.mockReturnValue("invalid-theme");

      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(mockSetCookieTheme).not.toHaveBeenCalled();
    });
  });

  describe("Theme Switching", () => {
    it("switches theme from light to dark", async () => {
      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      const darkButton = screen.getByTestId("set-dark");

      await act(async () => {
        darkButton.click();
      });

      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      expect(mockSetCookieTheme).toHaveBeenCalledWith("dark");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("theme", "dark");
    });

    it("switches theme from dark to light", async () => {
      render(
        <ThemeProvider initialTheme="dark">
          <TestComponent />
        </ThemeProvider>,
      );

      const lightButton = screen.getByTestId("set-light");

      await act(async () => {
        lightButton.click();
      });

      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(mockSetCookieTheme).toHaveBeenCalledWith("light");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("theme", "light");
    });

    it("applies DOM classes when switching themes", async () => {
      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      const darkButton = screen.getByTestId("set-dark");

      await act(async () => {
        darkButton.click();
      });

      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith(
        "light",
        "dark",
      );
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith("dark");
    });
  });

  describe("Persistence", () => {
    it("saves theme to cookie when switching", async () => {
      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      const darkButton = screen.getByTestId("set-dark");

      await act(async () => {
        darkButton.click();
      });

      expect(mockSetCookieTheme).toHaveBeenCalledWith("dark");
    });

    it("saves theme to localStorage when switching", async () => {
      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      const darkButton = screen.getByTestId("set-dark");

      await act(async () => {
        darkButton.click();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("theme", "dark");
    });

    it("handles localStorage save errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error("Storage quota exceeded");
      });

      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      const darkButton = screen.getByTestId("set-dark");

      await act(async () => {
        darkButton.click();
      });

      // Should still work despite localStorage error
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      expect(mockSetCookieTheme).toHaveBeenCalledWith("dark");
      expect(consoleSpy).toHaveBeenCalledWith(
        "[theme-provider-save]:",
        "Failed to save theme to localStorage",
      );

      consoleSpy.mockRestore();
    });

    it("handles localStorage read errors gracefully in test environment", () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error("Storage not available");
      });

      // Should not log error in test environment
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("useTheme Hook", () => {
    it("provides theme value and setter", () => {
      render(
        <ThemeProvider initialTheme="dark">
          <TestComponent />
        </ThemeProvider>,
      );

      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      expect(screen.getByTestId("set-light")).toBeInTheDocument();
      expect(screen.getByTestId("set-dark")).toBeInTheDocument();
    });

    it("provides default values when used outside provider", () => {
      render(<TestComponent />);

      // Should use default context values (light theme, no-op setter)
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(screen.getByTestId("set-light")).toBeInTheDocument();
      expect(screen.getByTestId("set-dark")).toBeInTheDocument();

      // Clicking buttons should not cause errors (no-op)
      const darkButton = screen.getByTestId("set-dark");
      expect(() => darkButton.click()).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("handles multiple rapid theme switches", async () => {
      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      const lightButton = screen.getByTestId("set-light");
      const darkButton = screen.getByTestId("set-dark");

      // Rapid switches
      await act(async () => {
        darkButton.click();
        lightButton.click();
        darkButton.click();
      });

      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      // Just verify it was called with dark at some point
      expect(mockSetCookieTheme).toHaveBeenCalledWith("dark");
    });

    it("handles null/undefined localStorage values", async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    });

    it("preserves theme state across re-renders", async () => {
      const { rerender } = render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      const darkButton = screen.getByTestId("set-dark");

      await act(async () => {
        darkButton.click();
      });

      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");

      rerender(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      // Should maintain dark theme even after re-render with light initial
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });
  });

  describe("Integration", () => {
    it("integrates properly with real DOM operations", async () => {
      // Use actual document element for this test
      const realDocumentElement = document.documentElement;
      const addSpy = vi.spyOn(realDocumentElement.classList, "add");
      const removeSpy = vi.spyOn(realDocumentElement.classList, "remove");

      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      const darkButton = screen.getByTestId("set-dark");

      await act(async () => {
        darkButton.click();
      });

      expect(removeSpy).toHaveBeenCalledWith("light", "dark");
      expect(addSpy).toHaveBeenCalledWith("dark");

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });
});
