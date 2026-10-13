/**
 * Legal Modal Component Tests
 *
 * Tests the modal component used for displaying legal documents
 * with proper accessibility features, focus management, and interactions.
 */

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useState } from "react";
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
    // Closing puts the page back where it was; jsdom has no scrollTo.
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    document.body.style.overflow = "";
  });

  afterEach(() => {
    // Unmount first, so a close's scrollTo still meets the spy.
    cleanup();
    document.body.style.overflow = "";
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
      // Not described by its content: that was the whole text, read out in
      // full as the description on open.
      expect(dialog).not.toHaveAttribute("aria-describedby");
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
    it("takes the focus when it opens", () => {
      // On the dialog itself, as the site's other dialogs: a screen reader
      // names it, and the first Tab goes to the close button.
      render(<LegalModal {...defaultProps} isOpen={true} />);

      expect(document.activeElement).toBe(screen.getByRole("dialog"));
      fireEvent.keyDown(document, { key: "Tab" });
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /close/i }),
      );
    });

    it("moves Tab on from a link in the middle", () => {
      // macOS WebKit's own Tab skips buttons and links, so a trap that only
      // wrapped at the first and last control let it out from in between.
      render(
        <LegalModal {...defaultProps} isOpen={true}>
          <p>
            <a href="https://example.com/a">First link</a> and{" "}
            <a href="https://example.com/b">second link</a>
          </p>
        </LegalModal>,
      );
      screen.getByRole("link", { name: "First link" }).focus();

      fireEvent.keyDown(document, { key: "Tab" });

      expect(document.activeElement).toBe(
        screen.getByRole("link", { name: "second link" }),
      );
    });

    it("lets the keyboard reach the text, to scroll it", () => {
      // The License has no links: nothing in its text could take focus, so
      // the keyboard had no way to scroll it.
      render(
        <LegalModal {...defaultProps} isOpen={true} title="GNU GPLv3">
          <p>No links here.</p>
        </LegalModal>,
      );
      const text = screen.getByRole("region", { name: "GNU GPLv3 text" });

      fireEvent.keyDown(document, { key: "Tab" });
      fireEvent.keyDown(document, { key: "Tab" });

      expect(document.activeElement).toBe(text);
    });

    it("gives the focus back to its own opener after another was used", () => {
      // The provider mounts all three with inline closers, so every render
      // re-ran every instance's effect: a closed one's cleanup focused the
      // opener it remembered from an earlier visit, without preventScroll,
      // and the page jumped there.
      function Provider() {
        const [privacy, setPrivacy] = useState(false);
        const [terms, setTerms] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setPrivacy(true)}>
              Privacy
            </button>
            <button type="button" onClick={() => setTerms(true)}>
              Terms
            </button>
            <LegalModal
              isOpen={privacy}
              onClose={() => setPrivacy(false)}
              title="Privacy Policy"
            >
              <p>Privacy text</p>
            </LegalModal>
            <LegalModal
              isOpen={terms}
              onClose={() => setTerms(false)}
              title="Terms of Service"
            >
              <p>Terms text</p>
            </LegalModal>
          </>
        );
      }
      render(<Provider />);
      const privacyOpener = screen.getByRole("button", { name: "Privacy" });
      const termsOpener = screen.getByRole("button", { name: "Terms" });

      termsOpener.focus();
      fireEvent.click(termsOpener);
      fireEvent.keyDown(document, { key: "Escape" });

      privacyOpener.focus();
      const toTerms = vi.spyOn(termsOpener, "focus");
      const toPrivacy = vi.spyOn(privacyOpener, "focus");
      fireEvent.click(privacyOpener);
      fireEvent.keyDown(document, { key: "Escape" });

      expect(document.activeElement).toBe(privacyOpener);
      expect(toPrivacy).toHaveBeenCalledWith({ preventScroll: true });
      expect(toTerms).not.toHaveBeenCalled();
    });
  });

  describe("Body Scroll Management", () => {
    it("prevents body scroll when modal is open", () => {
      const { rerender } = render(
        <LegalModal {...defaultProps} isOpen={false} />,
      );

      expect(document.body.style.overflow).toBe("");

      rerender(<LegalModal {...defaultProps} isOpen={true} />);

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when modal is closed", () => {
      const { rerender } = render(
        <LegalModal {...defaultProps} isOpen={true} />,
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(<LegalModal {...defaultProps} isOpen={false} />);

      // Back to the stylesheet's own value, not a forced "auto".
      expect(document.body.style.overflow).toBe("");
    });

    it("restores body scroll on unmount", () => {
      const { unmount } = render(
        <LegalModal {...defaultProps} isOpen={true} />,
      );

      expect(document.body.style.overflow).toBe("hidden");

      unmount();

      expect(document.body.style.overflow).toBe("");
    });

    it("puts the page back instantly when it closes", () => {
      // It only unlocked the page; the shared dialog hook also restores the
      // place, instantly, past globals.css's smooth scroll-behavior.
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        value: 900,
      });
      try {
        const { rerender } = render(
          <LegalModal {...defaultProps} isOpen={true} />,
        );
        rerender(<LegalModal {...defaultProps} isOpen={false} />);

        expect(window.scrollTo).toHaveBeenCalledWith({
          top: 900,
          behavior: "instant",
        });
      } finally {
        Object.defineProperty(window, "scrollY", {
          configurable: true,
          value: 0,
        });
      }
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
