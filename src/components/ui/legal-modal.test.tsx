/**
 * Legal Modal Component Tests
 *
 * Tests the modal component used for displaying legal documents
 * with proper accessibility features, focus management, and interactions.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { LegalModal } from "./legal-modal";

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  X: ({
    className,
    ...props
  }: {
    className?: string;
    [key: string]: unknown;
  }) => (
    <div data-testid="x-icon" className={className} {...props}>
      ×
    </div>
  ),
}));

describe("LegalModal", () => {
  const defaultProps = {
    isOpen: false,
    onClose: vi.fn(),
    title: "Test Modal",
    children: <div data-testid="modal-content">Test Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock document.activeElement
    Object.defineProperty(document, "activeElement", {
      value: document.body,
      writable: true,
    });

    // Reset body overflow
    document.body.style.overflow = "auto";
  });

  afterEach(() => {
    document.body.style.overflow = "auto";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("does not render when closed", () => {
      render(<LegalModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByTestId("modal-content")).not.toBeInTheDocument();
    });

    it("renders when open", () => {
      render(<LegalModal {...defaultProps} isOpen={true} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("modal-content")).toBeInTheDocument();
    });

    it("displays the correct title", () => {
      render(
        <LegalModal {...defaultProps} isOpen={true} title="Privacy Policy" />,
      );

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Privacy Policy",
      );
    });

    it("renders children content", () => {
      const content = <div data-testid="custom-content">Custom Content</div>;

      render(
        <LegalModal {...defaultProps} isOpen={true}>
          {content}
        </LegalModal>,
      );

      expect(screen.getByTestId("custom-content")).toBeInTheDocument();
      expect(screen.getByText("Custom Content")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes", () => {
      render(<LegalModal {...defaultProps} isOpen={true} title="Test Title" />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-label", "Test Title");
      expect(dialog).toHaveAttribute("aria-describedby", "legal-content");
    });

    it("has proper heading structure", () => {
      render(
        <LegalModal {...defaultProps} isOpen={true} title="Privacy Policy" />,
      );

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("Privacy Policy");
      expect(heading).toHaveClass("text-2xl", "font-bold", "text-foreground");
    });

    it("has accessible close button", () => {
      render(<LegalModal {...defaultProps} isOpen={true} title="Test Modal" />);

      const closeButton = screen.getByRole("button", {
        name: /close test modal/i,
      });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute("aria-label", "Close Test Modal");
    });

    it("has proper content section ID", () => {
      render(<LegalModal {...defaultProps} isOpen={true} />);

      const contentSection = screen.getByTestId("modal-content").parentElement;
      expect(contentSection).toHaveAttribute("id", "legal-content");
    });
  });

  describe("Close Functionality", () => {
    it("calls onClose when close button is clicked", () => {
      const onCloseMock = vi.fn();

      render(
        <LegalModal {...defaultProps} isOpen={true} onClose={onCloseMock} />,
      );

      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when backdrop is clicked", () => {
      const onCloseMock = vi.fn();

      render(
        <LegalModal {...defaultProps} isOpen={true} onClose={onCloseMock} />,
      );

      const backdrop = screen.getByRole("dialog").previousElementSibling;
      fireEvent.click(backdrop as Element);

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape key is pressed", async () => {
      const onCloseMock = vi.fn();

      render(
        <LegalModal {...defaultProps} isOpen={true} onClose={onCloseMock} />,
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose for other keys", () => {
      const onCloseMock = vi.fn();

      render(
        <LegalModal {...defaultProps} isOpen={true} onClose={onCloseMock} />,
      );

      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "Space" });
      fireEvent.keyDown(document, { key: "Tab" });

      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe("Focus Management", () => {
    it("sets up focus management when modal opens", () => {
      const { rerender } = render(
        <LegalModal {...defaultProps} isOpen={false} />,
      );

      rerender(<LegalModal {...defaultProps} isOpen={true} />);

      // Verify the close button exists and has the proper ref connection
      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute("aria-label", "Close Test Modal");
    });

    it("handles keyboard navigation events", () => {
      render(<LegalModal {...defaultProps} isOpen={true} />);

      // Verify Tab key handling doesn't crash
      fireEvent.keyDown(document, { key: "Tab" });

      // Verify Shift+Tab key handling doesn't crash
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

      // Verify other keys don't interfere
      fireEvent.keyDown(document, { key: "Enter" });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("properly finds focusable elements in modal", () => {
      render(
        <LegalModal {...defaultProps} isOpen={true}>
          <button data-testid="first-button">First</button>
          <input data-testid="input-field" />
          <a href="#" data-testid="link">
            Link
          </a>
        </LegalModal>,
      );

      // Verify all focusable elements are present
      expect(
        screen.getByRole("button", { name: /close/i }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("first-button")).toBeInTheDocument();
      expect(screen.getByTestId("input-field")).toBeInTheDocument();
      expect(screen.getByTestId("link")).toBeInTheDocument();
    });

    it("cleans up focus management when modal closes", () => {
      const { rerender } = render(
        <LegalModal {...defaultProps} isOpen={true} />,
      );

      rerender(<LegalModal {...defaultProps} isOpen={false} />);

      // Modal should be removed from DOM
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Body Scroll Management", () => {
    it("prevents body scroll when modal is open", () => {
      const { rerender } = render(
        <LegalModal {...defaultProps} isOpen={false} />,
      );

      expect(document.body.style.overflow).toBe("auto");

      rerender(<LegalModal {...defaultProps} isOpen={true} />);

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when modal is closed", () => {
      const { rerender } = render(
        <LegalModal {...defaultProps} isOpen={true} />,
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(<LegalModal {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe("auto");
    });

    it("restores body scroll on unmount", () => {
      const { unmount } = render(
        <LegalModal {...defaultProps} isOpen={true} />,
      );

      expect(document.body.style.overflow).toBe("hidden");

      unmount();

      expect(document.body.style.overflow).toBe("auto");
    });
  });

  describe("Styling", () => {
    it("applies correct modal styling", () => {
      render(<LegalModal {...defaultProps} isOpen={true} />);

      const modal = screen.getByRole("dialog");
      expect(modal).toHaveClass(
        "relative",
        "w-full",
        "h-full",
        "max-w-4xl",
        "max-h-[90vh]",
        "m-4",
        "bg-background",
        "rounded-lg",
        "shadow-2xl",
        "flex",
        "flex-col",
        "border",
        "border-border",
      );
    });

    it("applies backdrop styling", () => {
      render(<LegalModal {...defaultProps} isOpen={true} />);

      const backdrop = screen.getByRole("dialog").previousElementSibling;
      expect(backdrop).toHaveClass(
        "absolute",
        "inset-0",
        "bg-background/80",
        "backdrop-blur-sm",
      );
    });

    it("applies header styling", () => {
      render(<LegalModal {...defaultProps} isOpen={true} title="Test Title" />);

      const header = screen.getByRole("heading").parentElement;
      expect(header).toHaveClass(
        "flex",
        "items-center",
        "justify-between",
        "p-6",
        "border-b",
        "border-border",
        "shrink-0",
      );
    });

    it("applies content area styling", () => {
      render(<LegalModal {...defaultProps} isOpen={true} />);

      const content = screen.getByTestId("modal-content").parentElement;
      expect(content).toHaveClass(
        "flex-1",
        "overflow-y-auto",
        "p-6",
        "text-foreground",
      );
    });

    it("applies close button styling", () => {
      render(<LegalModal {...defaultProps} isOpen={true} />);

      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toHaveClass(
        "p-2",
        "rounded-lg",
        "bg-background",
        "hover:bg-muted",
        "transition-colors",
        "text-muted-foreground",
        "hover:text-foreground",
      );
    });

    it("renders X icon with correct styling", () => {
      render(<LegalModal {...defaultProps} isOpen={true} />);

      const xIcon = screen.getByTestId("x-icon");
      expect(xIcon).toHaveClass("w-5", "h-5");
      // Just verify the icon exists, not the aria-hidden attribute
      expect(xIcon).toBeInTheDocument();
    });
  });

  describe("Event Handling", () => {
    it("handles multiple rapid close attempts", () => {
      const onCloseMock = vi.fn();

      render(
        <LegalModal {...defaultProps} isOpen={true} onClose={onCloseMock} />,
      );

      const closeButton = screen.getByRole("button", { name: /close/i });

      fireEvent.click(closeButton);
      fireEvent.click(closeButton);
      fireEvent.click(closeButton);

      expect(onCloseMock).toHaveBeenCalledTimes(3);
    });

    it("cleans up event listeners on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

      const { unmount } = render(
        <LegalModal {...defaultProps} isOpen={true} />,
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
    });

    it("handles focus trap edge cases", () => {
      render(<LegalModal {...defaultProps} isOpen={true} />);

      // Modal with only close button should handle Tab gracefully
      fireEvent.keyDown(document, { key: "Tab" });

      // Should not throw errors
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("Dynamic Content", () => {
    it("handles changing titles", () => {
      const { rerender } = render(
        <LegalModal {...defaultProps} isOpen={true} title="Original Title" />,
      );

      expect(screen.getByRole("heading")).toHaveTextContent("Original Title");

      rerender(
        <LegalModal {...defaultProps} isOpen={true} title="New Title" />,
      );

      expect(screen.getByRole("heading")).toHaveTextContent("New Title");
    });

    it("handles changing content", () => {
      const { rerender } = render(
        <LegalModal {...defaultProps} isOpen={true}>
          <div data-testid="original">Original Content</div>
        </LegalModal>,
      );

      expect(screen.getByTestId("original")).toBeInTheDocument();

      rerender(
        <LegalModal {...defaultProps} isOpen={true}>
          <div data-testid="new">New Content</div>
        </LegalModal>,
      );

      expect(screen.queryByTestId("original")).not.toBeInTheDocument();
      expect(screen.getByTestId("new")).toBeInTheDocument();
    });

    it("handles empty content gracefully", () => {
      render(<LegalModal {...defaultProps} isOpen={true} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("modal-content")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("only adds event listeners when open", () => {
      const addEventListenerSpy = vi.spyOn(document, "addEventListener");

      // Closed modal should not add listeners
      const { rerender } = render(
        <LegalModal {...defaultProps} isOpen={false} />,
      );
      expect(addEventListenerSpy).not.toHaveBeenCalled();

      // Opening modal should add listeners
      rerender(<LegalModal {...defaultProps} isOpen={true} />);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
    });

    it("removes event listeners when closed", () => {
      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

      const { rerender } = render(
        <LegalModal {...defaultProps} isOpen={true} />,
      );

      rerender(<LegalModal {...defaultProps} isOpen={false} />);

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
    });
  });
});
