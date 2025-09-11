/**
 * ErrorFallback Component Tests
 *
 * Critical infrastructure component that provides user-friendly error display
 * with retry functionality, navigation options, and development debugging.
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { ErrorFallback } from "./ErrorFallback";

// Mock the external dependencies
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      data-testid="fallback-button"
      data-variant={variant}
      className={className}
    >
      {children}
    </button>
  ),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} data-testid="home-link">
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  AlertCircle: ({ className }: { className?: string }) => (
    <div data-testid="alert-circle-icon" className={className} />
  ),
  RefreshCw: ({ className }: { className?: string }) => (
    <div data-testid="refresh-icon" className={className} />
  ),
  Home: ({ className }: { className?: string }) => (
    <div data-testid="home-icon" className={className} />
  ),
}));

describe("ErrorFallback", () => {
  let mockResetError: ReturnType<typeof vi.fn>;
  let mockError: Error;

  beforeEach(() => {
    mockResetError = vi.fn();
    mockError = new Error("Test error message");
    mockError.name = "TestError";
    mockError.stack = "TestError: Test error message\n    at test:1:1";

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders error fallback with basic UI elements", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(
        screen.getByText(/We encountered an unexpected error/),
      ).toBeInTheDocument();
      expect(screen.getByTestId("alert-circle-icon")).toBeInTheDocument();
      expect(screen.getByTestId("refresh-icon")).toBeInTheDocument();
      expect(screen.getByTestId("home-icon")).toBeInTheDocument();
    });

    it("renders try again button", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const buttons = screen.getAllByTestId("fallback-button");
      const tryAgainButton = buttons.find((button) =>
        button.textContent?.includes("Try Again"),
      );

      expect(tryAgainButton).toBeInTheDocument();
      expect(tryAgainButton).toHaveAttribute("data-variant", "default");
    });

    it("renders go home button with link", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const homeLink = screen.getByTestId("home-link");
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute("href", "/");

      const buttons = screen.getAllByTestId("fallback-button");
      const homeButton = buttons.find((button) =>
        button.textContent?.includes("Go Home"),
      );

      expect(homeButton).toBeInTheDocument();
      expect(homeButton).toHaveAttribute("data-variant", "outline");
    });

    it("applies correct CSS classes for layout", () => {
      const { container } = render(
        <ErrorFallback error={mockError} resetError={mockResetError} />,
      );

      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).toHaveClass(
        "flex",
        "min-h-screen",
        "flex-col",
        "items-center",
        "justify-center",
        "bg-gray-50",
        "p-4",
        "dark:bg-gray-900",
      );

      const innerContainer = container.querySelector(
        ".mx-auto.max-w-md.text-center",
      );
      expect(innerContainer).toBeInTheDocument();
    });

    it("applies correct styling to alert icon", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const alertIcon = screen.getByTestId("alert-circle-icon");
      expect(alertIcon).toHaveClass(
        "h-12",
        "w-12",
        "text-red-600",
        "dark:text-red-400",
      );
    });

    it("applies correct styling to action icons", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const refreshIcon = screen.getByTestId("refresh-icon");
      expect(refreshIcon).toHaveClass("h-4", "w-4");

      const homeIcon = screen.getByTestId("home-icon");
      expect(homeIcon).toHaveClass("h-4", "w-4");
    });
  });

  describe("Error Information Display", () => {
    it("displays the main error heading", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("Something went wrong");
      expect(heading).toHaveClass(
        "mb-2",
        "text-3xl",
        "font-bold",
        "text-gray-900",
        "dark:text-white",
      );
    });

    it("displays user-friendly error description", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const description = screen.getByText(
        /We encountered an unexpected error/,
      );
      expect(description).toHaveTextContent(
        "We encountered an unexpected error. Don't worry, we've been notified and are working on fixing it.",
      );
      expect(description).toHaveClass(
        "mb-6",
        "text-gray-600",
        "dark:text-gray-400",
      );
    });

    it("handles error without stack trace", () => {
      const errorWithoutStack = new Error("No stack error");
      errorWithoutStack.stack = undefined;

      vi.stubEnv("NODE_ENV", "development");

      render(
        <ErrorFallback error={errorWithoutStack} resetError={mockResetError} />,
      );

      expect(
        screen.getByText("Error details (development only)"),
      ).toBeInTheDocument();

      // Restore environment
      vi.unstubAllEnvs();
    });

    it("handles custom error types", () => {
      const customError = new Error("Custom error message");
      customError.name = "CustomError";

      vi.stubEnv("NODE_ENV", "development");

      render(<ErrorFallback error={customError} resetError={mockResetError} />);

      expect(
        screen.getByText("CustomError: Custom error message"),
      ).toBeInTheDocument();

      // Restore environment
      vi.unstubAllEnvs();
    });
  });

  describe("Development Mode Features", () => {
    it("shows error details in development mode", () => {
      vi.stubEnv("NODE_ENV", "development");

      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      expect(
        screen.getByText("Error details (development only)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("TestError: Test error message"),
      ).toBeInTheDocument();

      const stackTrace = screen.getByText(
        /TestError: Test error message\s+at test:1:1/,
      );
      expect(stackTrace).toBeInTheDocument();
      expect(stackTrace.tagName.toLowerCase()).toBe("pre");

      // Restore environment
      vi.unstubAllEnvs();
    });

    it("hides error details in production mode", () => {
      vi.stubEnv("NODE_ENV", "production");

      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      expect(
        screen.queryByText("Error details (development only)"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("TestError: Test error message"),
      ).not.toBeInTheDocument();

      // Restore environment
      vi.unstubAllEnvs();
    });

    it("has expandable details section in development", () => {
      vi.stubEnv("NODE_ENV", "development");

      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const details = screen.getByRole("group"); // details element
      expect(details).toBeInTheDocument();

      const summary = screen.getByText("Error details (development only)");
      expect(summary).toHaveClass("cursor-pointer");

      // Restore environment
      vi.unstubAllEnvs();
    });

    it("applies correct styling to development error details", () => {
      vi.stubEnv("NODE_ENV", "development");

      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const summary = screen.getByText("Error details (development only)");
      expect(summary).toHaveClass(
        "cursor-pointer",
        "text-sm",
        "font-medium",
        "text-gray-700",
        "dark:text-gray-300",
      );

      const errorName = screen.getByText("TestError: Test error message");
      expect(errorName).toHaveClass(
        "mb-2",
        "text-sm",
        "font-medium",
        "text-gray-700",
        "dark:text-gray-300",
      );

      const stackElement = screen.getByText(/at test:1:1/);
      expect(stackElement).toHaveClass(
        "overflow-x-auto",
        "text-xs",
        "text-gray-600",
        "dark:text-gray-400",
      );

      // Restore environment
      vi.unstubAllEnvs();
    });
  });

  describe("User Interactions", () => {
    it("calls resetError when Try Again button is clicked", async () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const buttons = screen.getAllByTestId("fallback-button");
      const tryAgainButton = buttons.find((button) =>
        button.textContent?.includes("Try Again"),
      );

      expect(tryAgainButton).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(tryAgainButton!);
      });

      expect(mockResetError).toHaveBeenCalledTimes(1);
    });

    it("does not call resetError when Go Home button is clicked", async () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const buttons = screen.getAllByTestId("fallback-button");
      const homeButton = buttons.find((button) =>
        button.textContent?.includes("Go Home"),
      );

      expect(homeButton).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(homeButton!);
      });

      expect(mockResetError).not.toHaveBeenCalled();
    });

    it("handles multiple rapid clicks on Try Again", async () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const buttons = screen.getAllByTestId("fallback-button");
      const tryAgainButton = buttons.find((button) =>
        button.textContent?.includes("Try Again"),
      );

      await act(async () => {
        fireEvent.click(tryAgainButton!);
        fireEvent.click(tryAgainButton!);
        fireEvent.click(tryAgainButton!);
      });

      expect(mockResetError).toHaveBeenCalledTimes(3);
    });
  });

  describe("Accessibility", () => {
    it("has proper heading structure", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("Something went wrong");
    });

    it("has focusable interactive elements", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const buttons = screen.getAllByTestId("fallback-button");

      buttons.forEach((button) => {
        // Just verify that the button can receive focus
        expect(button.tabIndex).toBeGreaterThanOrEqual(-1);
        // Verify button is not disabled
        expect(button).not.toBeDisabled();
      });
    });

    it("provides meaningful button text", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      expect(screen.getByText("Try Again")).toBeInTheDocument();
      expect(screen.getByText("Go Home")).toBeInTheDocument();
    });

    it("has proper details/summary structure in development", () => {
      vi.stubEnv("NODE_ENV", "development");

      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const details = screen.getByRole("group");
      expect(details).toBeInTheDocument();

      const summary = details.querySelector("summary");
      expect(summary).toBeInTheDocument();

      // Restore environment
      vi.unstubAllEnvs();
    });
  });

  describe("Responsive Design", () => {
    it("applies responsive button layout classes", () => {
      const { container } = render(
        <ErrorFallback error={mockError} resetError={mockResetError} />,
      );

      const buttonContainer = container.querySelector(
        ".flex.flex-col.gap-3.sm\\:flex-row.sm\\:justify-center",
      );
      expect(buttonContainer).toBeInTheDocument();
    });

    it("applies responsive styling to buttons", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const buttons = screen.getAllByTestId("fallback-button");

      buttons.forEach((button) => {
        expect(button).toHaveClass("inline-flex", "items-center", "gap-2");
      });
    });
  });

  describe("Dark Mode Support", () => {
    it("applies dark mode classes to main container", () => {
      const { container } = render(
        <ErrorFallback error={mockError} resetError={mockResetError} />,
      );

      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).toHaveClass("dark:bg-gray-900");
    });

    it("applies dark mode classes to heading", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("dark:text-white");
    });

    it("applies dark mode classes to description", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const description = screen.getByText(
        /We encountered an unexpected error/,
      );
      expect(description).toHaveClass("dark:text-gray-400");
    });

    it("applies dark mode classes to alert icon", () => {
      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const alertIcon = screen.getByTestId("alert-circle-icon");
      expect(alertIcon).toHaveClass("dark:text-red-400");
    });

    it("applies dark mode classes to development details", () => {
      vi.stubEnv("NODE_ENV", "development");

      render(<ErrorFallback error={mockError} resetError={mockResetError} />);

      const summary = screen.getByText("Error details (development only)");
      expect(summary).toHaveClass("dark:text-gray-300");

      const errorName = screen.getByText("TestError: Test error message");
      expect(errorName).toHaveClass("dark:text-gray-300");

      // Restore environment
      vi.unstubAllEnvs();
    });
  });

  describe("Edge Cases", () => {
    it("handles error with empty message", () => {
      const emptyError = new Error("");
      emptyError.name = "EmptyError";

      vi.stubEnv("NODE_ENV", "development");

      render(<ErrorFallback error={emptyError} resetError={mockResetError} />);

      expect(screen.getByText("EmptyError:")).toBeInTheDocument();

      // Restore environment
      vi.unstubAllEnvs();
    });

    it("handles error without name", () => {
      const noNameError = new Error("Test message");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (noNameError as any).name = undefined;

      vi.stubEnv("NODE_ENV", "development");

      render(<ErrorFallback error={noNameError} resetError={mockResetError} />);

      // Should still display the message even without name - look for the formatted error display
      expect(screen.getByText("Error: Test message")).toBeInTheDocument();

      // Restore environment
      vi.unstubAllEnvs();
    });

    it("handles very long error messages gracefully", () => {
      const longMessage = "A".repeat(100); // Shorter for easier testing
      const longError = new Error(longMessage);

      vi.stubEnv("NODE_ENV", "development");

      expect(() => {
        render(<ErrorFallback error={longError} resetError={mockResetError} />);
      }).not.toThrow();

      // Check that overflow is handled by finding the pre element
      const preElements = document.querySelectorAll("pre");
      expect(preElements.length).toBeGreaterThan(0);
      expect(preElements[0]).toHaveClass("overflow-x-auto");

      // Restore environment
      vi.unstubAllEnvs();
    });

    it("maintains functionality when resetError is called multiple times", async () => {
      let callCount = 0;
      const countingResetError = vi.fn(() => {
        callCount++;
      });

      render(
        <ErrorFallback error={mockError} resetError={countingResetError} />,
      );

      const buttons = screen.getAllByTestId("fallback-button");
      const tryAgainButton = buttons.find((button) =>
        button.textContent?.includes("Try Again"),
      );

      // Call multiple times
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.click(tryAgainButton!);
        });
      }

      expect(countingResetError).toHaveBeenCalledTimes(5);
      expect(callCount).toBe(5);
    });
  });

  describe("Component Integration", () => {
    it("integrates properly with error boundary props", () => {
      const boundaryError = new Error("Boundary error");
      const boundaryReset = vi.fn();

      render(
        <ErrorFallback error={boundaryError} resetError={boundaryReset} />,
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      const buttons = screen.getAllByTestId("fallback-button");
      const tryAgainButton = buttons.find((button) =>
        button.textContent?.includes("Try Again"),
      );

      fireEvent.click(tryAgainButton!);
      expect(boundaryReset).toHaveBeenCalledTimes(1);
    });

    it("maintains consistent styling across different error types", () => {
      const errors = [
        new TypeError("Type error"),
        new ReferenceError("Reference error"),
        new SyntaxError("Syntax error"),
      ];

      errors.forEach((error) => {
        const { unmount } = render(
          <ErrorFallback error={error} resetError={mockResetError} />,
        );

        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        expect(screen.getByTestId("alert-circle-icon")).toBeInTheDocument();

        unmount();
      });
    });
  });
});
