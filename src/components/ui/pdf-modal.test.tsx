import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PDFModal } from "./pdf-modal";

// Mock PDFViewer component: a control of its toolbar, and a link of the
// document as pdf.js renders it, in a section with tabindex 1000.
vi.mock("./pdf-viewer", () => ({
  PDFViewer: vi.fn(({ url, title, downloadFileName, inModal }) => (
    <div
      data-testid="pdf-viewer"
      data-url={url}
      data-title={title}
      data-download-filename={downloadFileName}
      data-in-modal={inModal}
    >
      PDF Viewer Content
      <button type="button">Zoom in</button>
      <section tabIndex={1000}>
        <a href="https://doi.org/10.1000/1">DOI</a>
      </section>
    </div>
  )),
}));

const tab = (shiftKey = false) =>
  fireEvent.keyDown(document, { key: "Tab", shiftKey });

// Mock the deep per-icon import used by pdf-modal (see pdf-modal.tsx)
vi.mock("lucide-react/dist/esm/icons/x", () => ({
  default: vi.fn((props) => <div {...props}>X</div>),
}));

describe("PDFModal", () => {
  let originalBodyOverflow: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Store original body overflow
    originalBodyOverflow = document.body.style.overflow;

    // Create a mock active element
    const button = document.createElement("button");
    button.id = "trigger-button";
    document.body.appendChild(button);
    button.focus();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    // Restore body overflow
    document.body.style.overflow = originalBodyOverflow;

    // Clean up DOM
    const button = document.getElementById("trigger-button");
    if (button) {
      document.body.removeChild(button);
    }
  });

  describe("Rendering", () => {
    it("renders nothing when closed", () => {
      const { container } = render(
        <PDFModal isOpen={false} onClose={vi.fn()} pdfUrl="/test.pdf" />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders modal when open", () => {
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("renders backdrop", () => {
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);

      const backdrop = document.querySelector(".backdrop-blur-xs");
      expect(backdrop).toBeInTheDocument();
    });

    it("renders close button", () => {
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);

      expect(screen.getByLabelText("Close PDF viewer")).toBeInTheDocument();
    });

    it("renders PDFViewer component", () => {
      render(
        <PDFModal
          isOpen={true}
          onClose={vi.fn()}
          pdfUrl="/test.pdf"
          title="Test Document"
          downloadFileName="test-doc.pdf"
        />,
      );

      const pdfViewer = screen.getByTestId("pdf-viewer");
      expect(pdfViewer).toBeInTheDocument();
      expect(pdfViewer).toHaveAttribute("data-url", "/test.pdf");
      expect(pdfViewer).toHaveAttribute("data-title", "Test Document");
      expect(pdfViewer).toHaveAttribute(
        "data-download-filename",
        "test-doc.pdf",
      );
      expect(pdfViewer).toHaveAttribute("data-in-modal", "true");
    });
  });

  describe("Modal Behavior", () => {
    it("closes when close button is clicked", () => {
      const onClose = vi.fn();

      render(<PDFModal isOpen={true} onClose={onClose} pdfUrl="/test.pdf" />);

      const closeButton = screen.getByLabelText("Close PDF viewer");
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it("closes when backdrop is clicked", () => {
      const onClose = vi.fn();

      render(<PDFModal isOpen={true} onClose={onClose} pdfUrl="/test.pdf" />);

      const backdrop = document.querySelector(".backdrop-blur-xs");
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(onClose).toHaveBeenCalled();
    });

    it("closes when Escape key is pressed", () => {
      const onClose = vi.fn();

      render(<PDFModal isOpen={true} onClose={onClose} pdfUrl="/test.pdf" />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });

    it("does not close when other keys are pressed", () => {
      const onClose = vi.fn();

      render(<PDFModal isOpen={true} onClose={onClose} pdfUrl="/test.pdf" />);

      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "Space" });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Focus Management", () => {
    it("takes the focus when it opens", () => {
      // On the dialog itself, as the site's other dialogs: a screen reader
      // names the document, and the first Tab goes to the close button.
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);

      expect(document.activeElement).toBe(screen.getByRole("dialog"));
      tab();
      expect(document.activeElement).toBe(
        screen.getByLabelText("Close PDF viewer"),
      );
    });

    it("gives the focus back when it closes", () => {
      const triggerButton = document.getElementById("trigger-button");
      triggerButton?.focus();

      const { rerender } = render(
        <PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />,
      );
      rerender(
        <PDFModal isOpen={false} onClose={vi.fn()} pdfUrl="/test.pdf" />,
      );

      expect(document.activeElement).toBe(triggerButton);
    });

    it("moves Tab on from a control in the middle, one stop per link", () => {
      // macOS WebKit's own Tab skips buttons and links, so a trap that only
      // wrapped at the first and last control let it out of the reader from
      // anywhere in between. pdf.js's section around each link is not a
      // stop of its own.
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);
      screen.getByRole("button", { name: "Zoom in" }).focus();

      tab();

      expect(document.activeElement).toBe(
        screen.getByRole("link", { name: "DOI" }),
      );
    });

    it("wraps Tab from the last link to the close button", () => {
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);
      screen.getByRole("link", { name: "DOI" }).focus();

      tab();

      expect(document.activeElement).toBe(
        screen.getByLabelText("Close PDF viewer"),
      );
    });

    it("wraps Shift+Tab from the close button to the last link", () => {
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);
      screen.getByLabelText("Close PDF viewer").focus();

      tab(true);

      expect(document.activeElement).toBe(
        screen.getByRole("link", { name: "DOI" }),
      );
    });
  });

  describe("Body Scroll Management", () => {
    it("prevents body scroll when modal is open", () => {
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when modal closes", () => {
      const { rerender } = render(
        <PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />,
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <PDFModal isOpen={false} onClose={vi.fn()} pdfUrl="/test.pdf" />,
      );

      // Cleared inline style hands scrolling back to the stylesheet default.
      expect(document.body.style.overflow).toBe("");
    });

    it("puts back the inline overflow the page had on close", () => {
      // The page's one scroll lock restores what it found (scroll-lock.ts),
      // rather than writing its own idea of unlocked.
      document.body.style.overflow = "scroll";

      const { rerender } = render(
        <PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />,
      );
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <PDFModal isOpen={false} onClose={vi.fn()} pdfUrl="/test.pdf" />,
      );

      expect(document.body.style.overflow).toBe("scroll");
      document.body.style.overflow = "";
    });
  });

  describe("Scroll position", () => {
    it("puts the page back instantly when it closes", () => {
      // "auto" follows globals.css's html { scroll-behavior: smooth }, and
      // the page glided back to where it was; the comment by the call has
      // always said instant.
      const scrollTo = vi
        .spyOn(window, "scrollTo")
        .mockImplementation(() => {});
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        value: 1200,
      });
      try {
        const { rerender } = render(
          <PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />,
        );
        rerender(
          <PDFModal isOpen={false} onClose={vi.fn()} pdfUrl="/test.pdf" />,
        );

        expect(scrollTo).toHaveBeenCalledWith({
          top: 1200,
          behavior: "instant",
        });
      } finally {
        Object.defineProperty(window, "scrollY", {
          configurable: true,
          value: 0,
        });
        scrollTo.mockRestore();
      }
    });
  });

  describe("Event Listeners", () => {
    it("listens for Escape only while open", () => {
      const onClose = vi.fn();
      const { rerender } = render(
        <PDFModal isOpen={false} onClose={onClose} pdfUrl="/test.pdf" />,
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();

      rerender(<PDFModal isOpen={true} onClose={onClose} pdfUrl="/test.pdf" />);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);

      rerender(
        <PDFModal isOpen={false} onClose={onClose} pdfUrl="/test.pdf" />,
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("stops listening when it unmounts", () => {
      const onClose = vi.fn();
      const { unmount } = render(
        <PDFModal isOpen={true} onClose={onClose} pdfUrl="/test.pdf" />,
      );

      unmount();
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has correct ARIA attributes", () => {
      render(
        <PDFModal
          isOpen={true}
          onClose={vi.fn()}
          pdfUrl="/test.pdf"
          title="Test Document"
        />,
      );

      const modal = screen.getByRole("dialog");
      expect(modal).toHaveAttribute("aria-modal", "true");
      expect(modal).toHaveAttribute("aria-label", "Test Document");
      // Not described by its content: that was the toolbar and the text of
      // every page, read out in full as the description on open.
      expect(modal).not.toHaveAttribute("aria-describedby");
    });

    it("uses default aria-label when title not provided", () => {
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);

      const modal = screen.getByRole("dialog");
      expect(modal).toHaveAttribute("aria-label", "PDF viewer");
    });

    it("has aria-hidden on backdrop", () => {
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);

      const backdrop = document.querySelector(".backdrop-blur-xs");
      expect(backdrop).toHaveAttribute("aria-hidden", "true");
    });

    it("has accessible close button", () => {
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);

      const closeButton = screen.getByLabelText("Close PDF viewer");
      expect(closeButton).toHaveAttribute("aria-label", "Close PDF viewer");
    });

    it("has aria-hidden on close icon", () => {
      render(<PDFModal isOpen={true} onClose={vi.fn()} pdfUrl="/test.pdf" />);

      const closeIcon = screen.getByText("X");
      expect(closeIcon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Prop Handling", () => {
    it("passes correct props to PDFViewer", () => {
      const props = {
        pdfUrl: "/test.pdf",
        title: "Test Document",
        downloadFileName: "test-doc.pdf",
      };

      render(<PDFModal isOpen={true} onClose={vi.fn()} {...props} />);

      const pdfViewer = screen.getByTestId("pdf-viewer");
      expect(pdfViewer).toHaveAttribute("data-url", props.pdfUrl);
      expect(pdfViewer).toHaveAttribute("data-title", props.title);
      expect(pdfViewer).toHaveAttribute(
        "data-download-filename",
        props.downloadFileName,
      );
    });

    it("handles prop updates", () => {
      const { rerender } = render(
        <PDFModal
          isOpen={true}
          onClose={vi.fn()}
          pdfUrl="/test1.pdf"
          title="Document 1"
        />,
      );

      rerender(
        <PDFModal
          isOpen={true}
          onClose={vi.fn()}
          pdfUrl="/test2.pdf"
          title="Document 2"
        />,
      );

      const pdfViewer = screen.getByTestId("pdf-viewer");
      expect(pdfViewer).toHaveAttribute("data-url", "/test2.pdf");
      expect(pdfViewer).toHaveAttribute("data-title", "Document 2");
    });
  });

  describe("Performance", () => {
    it("does not render when closed", async () => {
      const { PDFViewer } = await import("./pdf-viewer");

      render(<PDFModal isOpen={false} onClose={vi.fn()} pdfUrl="/test.pdf" />);

      expect(PDFViewer).not.toHaveBeenCalled();
    });

    it("handles rapid open/close cycles", () => {
      const onClose = vi.fn();

      const { rerender } = render(
        <PDFModal isOpen={true} onClose={onClose} pdfUrl="/test.pdf" />,
      );

      // Rapid open/close
      rerender(
        <PDFModal isOpen={false} onClose={onClose} pdfUrl="/test.pdf" />,
      );
      rerender(<PDFModal isOpen={true} onClose={onClose} pdfUrl="/test.pdf" />);
      rerender(
        <PDFModal isOpen={false} onClose={onClose} pdfUrl="/test.pdf" />,
      );
      rerender(<PDFModal isOpen={true} onClose={onClose} pdfUrl="/test.pdf" />);

      // Should not throw or cause issues
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
