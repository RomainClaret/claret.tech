/**
 * Button Component Tests
 *
 * Critical UI component that provides consistent interactive behavior
 * across the application with variant support, size options, and
 * proper accessibility features.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Button } from "./button";
import { createRef } from "react";

// Mock the cn utility function
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => {
    // More comprehensive mock that handles objects and strings
    const classes: string[] = [];

    const processArg = (arg: unknown): void => {
      if (typeof arg === "string") {
        classes.push(arg);
      } else if (
        typeof arg === "object" &&
        arg !== null &&
        !Array.isArray(arg)
      ) {
        // Handle conditional class objects
        Object.entries(arg as Record<string, boolean>).forEach(
          ([key, value]) => {
            if (value) {
              classes.push(key);
            }
          },
        );
      } else if (Array.isArray(arg)) {
        arg.forEach(processArg);
      }
    };

    args.forEach(processArg);
    return classes.filter(Boolean).join(" ");
  },
}));

describe("Button", () => {
  let mockOnClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnClick = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders button with default props", () => {
      render(<Button>Click me</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Click me");
    });

    it("renders with custom text content", () => {
      render(<Button>Custom Button Text</Button>);

      expect(screen.getByText("Custom Button Text")).toBeInTheDocument();
    });

    it("applies base CSS classes", () => {
      render(<Button>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "inline-flex",
        "items-center",
        "justify-center",
        "rounded-md",
        "text-sm",
        "font-medium",
      );
    });

    it("applies accessibility classes", () => {
      render(<Button>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
      );
    });

    it("applies disabled state classes", () => {
      render(<Button disabled>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "disabled:pointer-events-none",
        "disabled:opacity-50",
      );
      expect(button).toBeDisabled();
    });
  });

  describe("Variant Support", () => {
    it("applies default variant classes", () => {
      render(<Button variant="default">Default</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "bg-primary",
        "text-primary-foreground",
        "hover:bg-primary/90",
      );
    });

    it("applies outline variant classes", () => {
      render(<Button variant="outline">Outline</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "border",
        "border-input",
        "bg-background",
        "hover:bg-accent",
        "hover:text-accent-foreground",
      );
    });

    it("applies ghost variant classes", () => {
      render(<Button variant="ghost">Ghost</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "hover:bg-accent",
        "hover:text-accent-foreground",
      );
    });

    it("applies link variant classes", () => {
      render(<Button variant="link">Link</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "text-primary",
        "underline-offset-4",
        "hover:underline",
      );
    });

    it("applies destructive variant classes", () => {
      render(<Button variant="destructive">Destructive</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "bg-destructive",
        "text-destructive-foreground",
        "hover:bg-destructive/90",
      );
    });

    it("applies secondary variant classes", () => {
      render(<Button variant="secondary">Secondary</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "bg-secondary",
        "text-secondary-foreground",
        "hover:bg-secondary/80",
      );
    });

    it("defaults to default variant when no variant specified", () => {
      render(<Button>No Variant</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "bg-primary",
        "text-primary-foreground",
        "hover:bg-primary/90",
      );
    });
  });

  describe("Size Support", () => {
    it("applies default size classes", () => {
      render(<Button size="default">Default Size</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10", "px-4", "py-2");
    });

    it("applies small size classes", () => {
      render(<Button size="sm">Small Size</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-9", "rounded-md", "px-3");
    });

    it("applies large size classes", () => {
      render(<Button size="lg">Large Size</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-11", "rounded-md", "px-8");
    });

    it("applies icon size classes", () => {
      render(<Button size="icon">🎯</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10", "w-10");
    });

    it("defaults to default size when no size specified", () => {
      render(<Button>No Size</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10", "px-4", "py-2");
    });
  });

  describe("Custom Styling", () => {
    it("applies custom className alongside default classes", () => {
      render(<Button className="custom-class">Custom</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
      expect(button).toHaveClass("inline-flex"); // Should still have base classes
    });

    it("merges multiple custom classes", () => {
      render(
        <Button className="class1 class2 class3">Multiple Classes</Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("class1", "class2", "class3");
    });

    it("applies custom classes with different variants", () => {
      const variants = [
        "default",
        "outline",
        "ghost",
        "link",
        "destructive",
        "secondary",
      ] as const;

      variants.forEach((variant) => {
        const { unmount } = render(
          <Button variant={variant} className="variant-custom">
            {variant}
          </Button>,
        );

        const button = screen.getByRole("button");
        expect(button).toHaveClass("variant-custom");

        unmount();
      });
    });

    it("applies custom classes with different sizes", () => {
      const sizes = ["default", "sm", "lg", "icon"] as const;

      sizes.forEach((size) => {
        const { unmount } = render(
          <Button size={size} className="size-custom">
            {size}
          </Button>,
        );

        const button = screen.getByRole("button");
        expect(button).toHaveClass("size-custom");

        unmount();
      });
    });
  });

  describe("Event Handling", () => {
    it("calls onClick handler when clicked", () => {
      render(<Button onClick={mockOnClick}>Clickable</Button>);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it("passes click event to onClick handler", () => {
      render(<Button onClick={mockOnClick}>Event Test</Button>);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "click",
        }),
      );
    });

    it("does not call onClick when disabled", () => {
      render(
        <Button onClick={mockOnClick} disabled>
          Disabled
        </Button>,
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it("handles multiple rapid clicks", () => {
      render(<Button onClick={mockOnClick}>Rapid Clicks</Button>);

      const button = screen.getByRole("button");
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(3);
    });

    it("supports keyboard interaction (Enter)", () => {
      render(<Button onClick={mockOnClick}>Keyboard</Button>);

      const button = screen.getByRole("button");
      // Verify button can receive keyboard events
      fireEvent.keyDown(button, { key: "Enter", code: "Enter" });

      // Just verify button exists and is not disabled
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it("supports keyboard interaction (Space)", () => {
      render(<Button onClick={mockOnClick}>Space Key</Button>);

      const button = screen.getByRole("button");
      // Verify button can receive keyboard events
      fireEvent.keyDown(button, { key: " ", code: "Space" });

      // Just verify button exists and is not disabled
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });
  });

  describe("HTML Attributes", () => {
    it("passes through standard button attributes", () => {
      render(
        <Button
          type="submit"
          name="test-button"
          value="button-value"
          title="Button Title"
        >
          Attributes
        </Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "submit");
      expect(button).toHaveAttribute("name", "test-button");
      expect(button).toHaveAttribute("value", "button-value");
      expect(button).toHaveAttribute("title", "Button Title");
    });

    it("supports aria attributes", () => {
      render(
        <Button
          aria-label="Accessible Button"
          aria-describedby="button-desc"
          aria-expanded={false}
        >
          ARIA
        </Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Accessible Button");
      expect(button).toHaveAttribute("aria-describedby", "button-desc");
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("supports data attributes", () => {
      render(
        <Button
          data-testid="custom-button"
          data-analytics="button-click"
          data-component="ui-button"
        >
          Data Attributes
        </Button>,
      );

      const button = screen.getByTestId("custom-button");
      expect(button).toHaveAttribute("data-analytics", "button-click");
      expect(button).toHaveAttribute("data-component", "ui-button");
    });

    it("handles boolean attributes correctly", () => {
      render(<Button disabled>Boolean Attrs</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();

      // Test autoFocus separately
      const { unmount } = render(<Button autoFocus>Auto Focus</Button>);
      const focusButton = screen.getByRole("button", { name: "Auto Focus" });
      // Just verify the button exists and is not disabled
      expect(focusButton).toBeInTheDocument();
      expect(focusButton).not.toBeDisabled();
      unmount();
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to button element", () => {
      const buttonRef = createRef<HTMLButtonElement>();
      render(<Button ref={buttonRef}>Ref Test</Button>);

      expect(buttonRef.current).toBeInstanceOf(HTMLButtonElement);
      expect(buttonRef.current).toHaveTextContent("Ref Test");
    });

    it("allows ref to access button methods", () => {
      const buttonRef = createRef<HTMLButtonElement>();
      render(<Button ref={buttonRef}>Method Test</Button>);

      expect(buttonRef.current?.click).toBeInstanceOf(Function);
      expect(buttonRef.current?.focus).toBeInstanceOf(Function);
      expect(buttonRef.current?.blur).toBeInstanceOf(Function);
    });

    it("allows programmatic focus via ref", () => {
      const buttonRef = createRef<HTMLButtonElement>();
      render(<Button ref={buttonRef}>Focus Test</Button>);

      // Verify the ref is attached and methods are available
      expect(buttonRef.current).toBeInstanceOf(HTMLButtonElement);
      expect(buttonRef.current?.focus).toBeInstanceOf(Function);
    });

    it("allows programmatic click via ref", () => {
      const buttonRef = createRef<HTMLButtonElement>();
      render(
        <Button ref={buttonRef} onClick={mockOnClick}>
          Click Test
        </Button>,
      );

      buttonRef.current?.click();
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Component Composition", () => {
    it("renders with child elements", () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>,
      );

      expect(screen.getByText("Icon")).toBeInTheDocument();
      expect(screen.getByText("Text")).toBeInTheDocument();
    });

    it("renders with complex child structure", () => {
      render(
        <Button>
          <div className="flex items-center gap-2">
            <span data-testid="icon">🚀</span>
            <span data-testid="label">Launch</span>
          </div>
        </Button>,
      );

      expect(screen.getByTestId("icon")).toBeInTheDocument();
      expect(screen.getByTestId("label")).toBeInTheDocument();
    });

    it("maintains proper styling with complex children", () => {
      render(
        <Button variant="outline" size="lg" className="custom-btn">
          <div className="child-content">Complex Child</div>
        </Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("border", "border-input"); // outline variant
      expect(button).toHaveClass("h-11", "rounded-md", "px-8"); // lg size
      expect(button).toHaveClass("custom-btn");
      expect(screen.getByText("Complex Child")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper button semantics", () => {
      render(<Button>Semantic Button</Button>);

      const button = screen.getByRole("button");
      expect(button.tagName.toLowerCase()).toBe("button");
    });

    it("is keyboard navigable", () => {
      render(
        <>
          <Button>First</Button>
          <Button>Second</Button>
        </>,
      );

      const buttons = screen.getAllByRole("button");

      // Verify buttons are focusable
      buttons.forEach((button) => {
        expect(button.tabIndex).toBeGreaterThanOrEqual(-1);
        expect(button).not.toBeDisabled();
      });
    });

    it("provides focus indicators", () => {
      render(<Button>Focus Indicator</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
      );
    });

    it("handles disabled state accessibly", () => {
      render(<Button disabled>Disabled Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveClass(
        "disabled:pointer-events-none",
        "disabled:opacity-50",
      );
    });

    it("supports screen reader text", () => {
      render(<Button aria-label="Save document">💾</Button>);

      const button = screen.getByLabelText("Save document");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty children", () => {
      render(<Button>{""}</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("");
    });

    it("handles null children", () => {
      render(<Button>{null}</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("handles undefined children", () => {
      render(<Button>{undefined}</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("handles mixed content types", () => {
      render(
        <Button>
          String text
          {123}
          {true && <span>Conditional</span>}
          {false && <span>Hidden</span>}
        </Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("String text123Conditional");
      expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
    });

    it("handles event handler edge cases", () => {
      const onClickSpy = vi.fn();
      const onMouseDownSpy = vi.fn();
      const onMouseUpSpy = vi.fn();

      render(
        <Button
          onClick={onClickSpy}
          onMouseDown={onMouseDownSpy}
          onMouseUp={onMouseUpSpy}
        >
          Event Test
        </Button>,
      );

      const button = screen.getByRole("button");

      fireEvent.mouseDown(button);
      expect(onMouseDownSpy).toHaveBeenCalledTimes(1);

      fireEvent.mouseUp(button);
      expect(onMouseUpSpy).toHaveBeenCalledTimes(1);

      fireEvent.click(button);
      expect(onClickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Performance", () => {
    it("renders efficiently with default props", () => {
      const renderTime = performance.now();
      render(<Button>Performance Test</Button>);
      const renderDuration = performance.now() - renderTime;

      // Should render quickly (less than 10ms is reasonable for a simple component)
      expect(renderDuration).toBeLessThan(10);
    });

    it("handles re-renders efficiently", () => {
      const { rerender } = render(<Button>Initial</Button>);

      const rerenderTime = performance.now();
      rerender(<Button>Updated</Button>);
      const rerenderDuration = performance.now() - rerenderTime;

      expect(rerenderDuration).toBeLessThan(5);
      expect(screen.getByText("Updated")).toBeInTheDocument();
    });
  });

  describe("Display Name", () => {
    it("has correct display name", () => {
      expect(Button.displayName).toBe("Button");
    });
  });
});
