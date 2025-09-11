import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";
import type { LucideIconProps, MockStorage } from "@/test/mock-types";

// Mock js-cookie
const mockCookies = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock("js-cookie", () => ({
  default: mockCookies,
}));

// Mock theme-cookie module
vi.mock("@/lib/theme-cookie", () => ({
  getTheme: vi.fn(() => "light"),
  setTheme: vi.fn(),
  getSystemTheme: vi.fn(() => "light"),
  getResolvedTheme: vi.fn((theme: string) => theme),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Sun: (props: LucideIconProps) => <div data-testid="sun-icon" {...props} />,
  Moon: (props: LucideIconProps) => <div data-testid="moon-icon" {...props} />,
}));

// Mock dev-logger to properly call console.warn in tests
vi.mock("@/lib/utils/dev-logger", () => ({
  logWarning: vi.fn((message: string, context?: string) => {
    console.warn(`[${context || "Warning"}]:`, message);
  }),
}));

// Test component to use theme context
const TestThemeConsumer = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <button data-testid="set-light" onClick={() => setTheme("light")}>
        Set Light
      </button>
      <button data-testid="set-dark" onClick={() => setTheme("dark")}>
        Set Dark
      </button>
    </div>
  );
};

describe("Theme Management System", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    Object.defineProperty(global, "localStorage", {
      value: localStorageMock,
      writable: true,
    });

    // Mock document.documentElement
    const mockDocumentElement = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
      },
    };

    Object.defineProperty(document, "documentElement", {
      value: mockDocumentElement,
      writable: true,
    });

    // Mock window.matchMedia for system theme detection
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === "(prefers-color-scheme: dark)" ? false : true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ThemeProvider", () => {
    it("provides default theme context", () => {
      render(
        <ThemeProvider initialTheme="light">
          <TestThemeConsumer />
        </ThemeProvider>,
      );

      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    });

    it("provides initial dark theme", () => {
      render(
        <ThemeProvider initialTheme="dark">
          <TestThemeConsumer />
        </ThemeProvider>,
      );

      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });

    it("applies theme class to document element on mount", () => {
      render(
        <ThemeProvider initialTheme="dark">
          <TestThemeConsumer />
        </ThemeProvider>,
      );

      expect(document.documentElement.classList.remove).toHaveBeenCalledWith(
        "light",
        "dark",
      );
      expect(document.documentElement.classList.add).toHaveBeenCalledWith(
        "dark",
      );
    });

    it("updates theme state and DOM when theme changes", () => {
      render(
        <ThemeProvider initialTheme="light">
          <TestThemeConsumer />
        </ThemeProvider>,
      );

      const setDarkButton = screen.getByTestId("set-dark");
      fireEvent.click(setDarkButton);

      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      expect(document.documentElement.classList.add).toHaveBeenCalledWith(
        "dark",
      );
    });

    it("saves theme to localStorage when theme changes", () => {
      render(
        <ThemeProvider initialTheme="light">
          <TestThemeConsumer />
        </ThemeProvider>,
      );

      const setDarkButton = screen.getByTestId("set-dark");
      fireEvent.click(setDarkButton);

      expect(localStorage.setItem).toHaveBeenCalledWith("theme", "dark");
    });

    it("handles localStorage errors gracefully", () => {
      (localStorage.setItem as MockStorage).mockImplementation(() => {
        throw new Error("Storage quota exceeded");
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(
        <ThemeProvider initialTheme="light">
          <TestThemeConsumer />
        </ThemeProvider>,
      );

      const setDarkButton = screen.getByTestId("set-dark");
      fireEvent.click(setDarkButton);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[theme-provider-save]:",
        "Failed to save theme to localStorage",
      );

      consoleSpy.mockRestore();
    });

    it("syncs with localStorage on mount", async () => {
      (localStorage.getItem as MockStorage).mockReturnValue("dark");

      await act(async () => {
        render(
          <ThemeProvider initialTheme="light">
            <TestThemeConsumer />
          </ThemeProvider>,
        );
      });

      expect(localStorage.getItem).toHaveBeenCalledWith("theme");
    });

    it("ignores invalid localStorage theme values", async () => {
      (localStorage.getItem as MockStorage).mockReturnValue("invalid-theme");

      await act(async () => {
        render(
          <ThemeProvider initialTheme="light">
            <TestThemeConsumer />
          </ThemeProvider>,
        );
      });

      // Should keep initial theme when localStorage has invalid value
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    });

    it("handles localStorage read errors gracefully", async () => {
      // Temporarily change NODE_ENV to development so console warnings are logged
      vi.stubEnv("NODE_ENV", "development");

      (localStorage.getItem as MockStorage).mockImplementation(() => {
        throw new Error("Storage not available");
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await act(async () => {
        render(
          <ThemeProvider initialTheme="light">
            <TestThemeConsumer />
          </ThemeProvider>,
        );
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[theme-provider-read]:",
        "Failed to read theme from localStorage",
      );

      // Restore NODE_ENV
      vi.unstubAllEnvs();

      consoleSpy.mockRestore();
    });
  });

  describe("ThemeToggle Component", () => {
    const renderThemeToggle = (initialTheme: "light" | "dark" = "light") => {
      return render(
        <ThemeProvider initialTheme={initialTheme}>
          <ThemeToggle />
        </ThemeProvider>,
      );
    };

    it("renders theme toggle button", () => {
      renderThemeToggle();

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute(
        "aria-label",
        "Toggle theme (current: light)",
      );
    });

    it("shows sun icon for light theme", () => {
      renderThemeToggle("light");

      expect(screen.getByTestId("sun-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("moon-icon")).not.toBeInTheDocument();
    });

    it("shows moon icon for dark theme", () => {
      renderThemeToggle("dark");

      expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("sun-icon")).not.toBeInTheDocument();
    });

    it("toggles from light to dark theme", () => {
      renderThemeToggle("light");

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("sun-icon")).not.toBeInTheDocument();
    });

    it("toggles from dark to light theme", () => {
      renderThemeToggle("dark");

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(screen.getByTestId("sun-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("moon-icon")).not.toBeInTheDocument();
    });

    it("updates aria-label when theme changes", () => {
      renderThemeToggle("light");

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(button).toHaveAttribute(
        "aria-label",
        "Toggle theme (current: dark)",
      );
    });

    it("has proper button styling", () => {
      renderThemeToggle();

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "relative",
        "inline-flex",
        "items-center",
        "justify-center",
      );
    });

    it("has focus styling for accessibility", () => {
      renderThemeToggle();

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "focus-visible:outline-none",
        "focus-visible:ring-2",
      );
    });
  });

  describe("Theme Integration", () => {
    it("integrates ThemeProvider with ThemeToggle", () => {
      render(
        <ThemeProvider initialTheme="light">
          <ThemeToggle />
          <TestThemeConsumer />
        </ThemeProvider>,
      );

      // Initial state
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(screen.getByTestId("sun-icon")).toBeInTheDocument();

      // Toggle theme using the theme toggle button specifically
      const toggleButton = screen.getByLabelText(
        "Toggle theme (current: light)",
      );
      fireEvent.click(toggleButton);

      // Verify both components updated
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
    });

    it("maintains theme state across multiple toggles", () => {
      render(
        <ThemeProvider initialTheme="light">
          <ThemeToggle />
        </ThemeProvider>,
      );

      const button = screen.getByRole("button");

      // Toggle to dark
      fireEvent.click(button);
      expect(screen.getByTestId("moon-icon")).toBeInTheDocument();

      // Toggle back to light
      fireEvent.click(button);
      expect(screen.getByTestId("sun-icon")).toBeInTheDocument();

      // Toggle to dark again
      fireEvent.click(button);
      expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
    });
  });

  describe("useTheme Hook", () => {
    it("provides default theme context when used outside ThemeProvider", () => {
      render(<TestThemeConsumer />);

      // Should render with default theme context values
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      // SetTheme functions should exist but be no-ops
      expect(screen.getByTestId("set-light")).toBeInTheDocument();
      expect(screen.getByTestId("set-dark")).toBeInTheDocument();
    });

    it("provides theme context when used inside ThemeProvider", () => {
      render(
        <ThemeProvider initialTheme="dark">
          <TestThemeConsumer />
        </ThemeProvider>,
      );

      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });

    it("provides working setTheme function", () => {
      render(
        <ThemeProvider initialTheme="light">
          <TestThemeConsumer />
        </ThemeProvider>,
      );

      const setDarkButton = screen.getByTestId("set-dark");
      fireEvent.click(setDarkButton);

      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });
  });

  describe("SSR Compatibility", () => {
    it("handles localStorage unavailability gracefully", () => {
      // Test that theme provider works when localStorage is not available
      const originalLocalStorage = global.localStorage;
      delete (global as { localStorage?: Storage }).localStorage;

      render(
        <ThemeProvider initialTheme="dark">
          <TestThemeConsumer />
        </ThemeProvider>,
      );

      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");

      // Restore localStorage
      global.localStorage = originalLocalStorage;
    });
  });
});
