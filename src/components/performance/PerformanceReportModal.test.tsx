/**
 * PerformanceReportModal Component Tests
 *
 * Critical dashboard component that provides comprehensive performance reporting
 * with auto-generation, multiple export formats, event handling, and
 * integrated progress tracking.
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { PerformanceReportModal } from "./PerformanceReportModal";
import { useLayoutEffect } from "react";

// Mock all the external dependencies
vi.mock("framer-motion", () => {
  // `m` is the slim motion API the app renders inside LazyMotion.
  const mocked = {
    motion: {
      div: ({
        children,
        className,
        onClick,
        ...props
      }: React.PropsWithChildren<{
        className?: string;
        onClick?: React.MouseEventHandler<HTMLDivElement>;
        [key: string]: unknown;
      }>) => (
        <div
          className={className}
          onClick={onClick}
          data-testid="motion-div"
          {...props}
        >
          {children}
        </div>
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
  return { ...mocked, m: mocked.motion };
});

// Mock the deep per-icon imports used by the modal (see PerformanceReportModal.tsx)
vi.mock("lucide-react/dist/esm/icons/x", () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="x-icon" className={className} />
  ),
}));
vi.mock("lucide-react/dist/esm/icons/file-text", () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="filetext-icon" className={className} />
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => {
    const classes: string[] = [];

    const processArg = (arg: unknown): void => {
      if (typeof arg === "string") {
        classes.push(arg);
      } else if (
        typeof arg === "object" &&
        arg !== null &&
        !Array.isArray(arg)
      ) {
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

// Create mock state and functions
let mockIsGenerating = false;
let mockReportData: unknown = null;
const mockGenerateReport = vi.fn();
const mockProgressUI = vi.fn(() => (
  <div data-testid="progress-ui">Report Progress</div>
));

// Store the callback globally for testing
let storedCallback: ((report: unknown) => void) | null = null;

// Mock PerformanceReportGenerator hook
vi.mock("./PerformanceReportGenerator", () => ({
  PerformanceReportGenerator: vi.fn((props) => {
    // Store the callback for manual triggering in tests
    storedCallback = props.onReportGenerated;

    return {
      isGenerating: mockIsGenerating,
      currentPhase: 0,
      phases: [],
      report: mockReportData,
      error: null,
      generateReport: mockGenerateReport,
      formatReportForTerminal: vi.fn(),
      getTerminalProgress: vi.fn(),
      ProgressUI: mockProgressUI,
    };
  }),
}));

// Mock DOM APIs
Object.defineProperty(global, "URL", {
  value: {
    createObjectURL: vi.fn(() => "blob:mock-url"),
    revokeObjectURL: vi.fn(),
  },
});

Object.defineProperty(global, "Blob", {
  value: vi.fn(() => ({})),
});

describe("PerformanceReportModal", () => {
  it("listens for Escape from the moment it is on the page, before it paints", () => {
    // Loaded lazily, its passive effects ran after the browser had painted
    // it: an Escape pressed in between reached the performance monitor's
    // listener on window and closed the monitor instead. A later sibling's
    // layout effect runs after this one's and before any passive effect.
    const onClose = vi.fn();
    const closedAtMount: boolean[] = [];
    function Probe() {
      useLayoutEffect(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        closedAtMount.push(onClose.mock.calls.length > 0);
      }, []);
      return null;
    }

    render(
      <>
        <PerformanceReportModal isOpen={true} onClose={onClose} />
        <Probe />
      </>,
    );

    expect(closedAtMount[0]).toBe(true);
  });

  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnClose = vi.fn();
    mockIsGenerating = false;
    mockReportData = null;
    storedCallback = null;

    // Setup DOM container for testing
    document.body.innerHTML = '<div id="root"></div>';

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Modal Visibility", () => {
    it("does not render when closed", () => {
      const { container } = render(
        <PerformanceReportModal isOpen={false} onClose={mockOnClose} />,
      );

      expect(container).toBeEmptyDOMElement();
    });

    it("renders when open", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText("Performance Report")).toBeInTheDocument();
      expect(screen.getByTestId("progress-ui")).toBeInTheDocument();
    });

    it("renders modal structure with correct elements", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByTestId("filetext-icon")).toBeInTheDocument();
      expect(screen.getByText("Performance Report")).toBeInTheDocument();
      expect(screen.getByTestId("x-icon")).toBeInTheDocument();
      expect(screen.getByTitle("Close (ESC)")).toBeInTheDocument();
    });
  });

  describe("Report Generation", () => {
    it("auto-generates report when modal opens", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      expect(mockGenerateReport).toHaveBeenCalledTimes(1);
    });

    it("does not auto-generate if already generating", () => {
      mockIsGenerating = true;

      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      expect(mockGenerateReport).not.toHaveBeenCalled();
    });

    it("does not start over by itself after a run that brought no report", () => {
      // A failed request (offline, the API's rate limit) ended the run with
      // no report, and the dialog started another at once: every 2.2 s for
      // as long as it stayed open, and the error never stayed up.
      const { rerender } = render(
        <PerformanceReportModal isOpen={true} onClose={mockOnClose} />,
      );
      expect(mockGenerateReport).toHaveBeenCalledTimes(1);

      mockIsGenerating = true;
      rerender(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);
      mockIsGenerating = false;
      rerender(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      expect(mockGenerateReport).toHaveBeenCalledTimes(1);

      // Opened again, it tries again.
      rerender(<PerformanceReportModal isOpen={false} onClose={mockOnClose} />);
      rerender(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);
      expect(mockGenerateReport).toHaveBeenCalledTimes(2);
    });
  });

  describe("Event Handling", () => {
    it("closes modal when close button is clicked", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByTitle("Close (ESC)");
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("closes modal when backdrop is clicked", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      // Find backdrop (first motion div with backdrop classes)
      const motionDivs = screen.getAllByTestId("motion-div");
      const backdrop = motionDivs.find((div) =>
        div.className?.includes("backdrop-blur-sm"),
      );

      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it("closes modal when Escape key is pressed", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      // Marked as used, so the performance monitor under it stays.
      expect(fireEvent.keyDown(document, { key: "Escape" })).toBe(false);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("opens at the end of the page's body, above a dialog already open", () => {
      // Rendered in place at the same z-index, it painted under a PDF reader
      // already open, which a portal puts at the end of <body>.
      const { container } = render(
        <PerformanceReportModal isOpen={true} onClose={vi.fn()} />,
      );

      const dialog = screen.getByRole("dialog", { name: "Performance report" });
      expect(container).not.toContainElement(dialog);
      expect(document.body.lastElementChild).toContainElement(dialog);
    });

    it("leaves an Escape typed in a modal dialog to that dialog", () => {
      // Open first, it listens first: the reader's Escape closed it too.
      const onClose = vi.fn();
      render(<PerformanceReportModal isOpen={true} onClose={onClose} />);
      const reader = document.createElement("div");
      reader.setAttribute("aria-modal", "true");
      const button = document.createElement("button");
      reader.append(button);
      document.body.append(reader);

      expect(fireEvent.keyDown(button, { key: "Escape" })).toBe(true);
      expect(onClose).not.toHaveBeenCalled();

      // From the terminal, or the page, it is still the panel's.
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
      reader.remove();
    });

    it("does not close modal for other keys", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "Space" });
      fireEvent.keyDown(document, { key: "Tab" });

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("listens for terminal report generation events", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = render(
        <PerformanceReportModal isOpen={true} onClose={mockOnClose} />,
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "terminal-generate-performance-report",
        expect.any(Function),
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "terminal-generate-performance-report",
        expect.any(Function),
      );

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it("handles terminal report generation event", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      // Auto-generation should have been called once on mount
      expect(mockGenerateReport).toHaveBeenCalledTimes(1);

      act(() => {
        window.dispatchEvent(
          new CustomEvent("terminal-generate-performance-report"),
        );
      });

      // Should call generateReport again after the event (total of 2)
      expect(mockGenerateReport).toHaveBeenCalledTimes(2);
    });

    it("ignores terminal events when modal is closed", () => {
      render(<PerformanceReportModal isOpen={false} onClose={mockOnClose} />);

      act(() => {
        window.dispatchEvent(
          new CustomEvent("terminal-generate-performance-report"),
        );
      });

      expect(mockGenerateReport).not.toHaveBeenCalled();
    });
  });

  describe("Report Display", () => {
    it("shows score and grade when report data is available", async () => {
      const reportData = {
        summary: {
          overallScore: 95,
          grade: "Excellent" as const,
          primaryIssues: [],
          strengths: [],
        },
        metrics: {
          performance: {
            fps: { value: 60, status: "Excellent", target: 60 },
            memory: { value: 25.5, status: "Excellent", target: 50 },
            cpu: { value: 15, status: "Excellent", target: 50 },
          },
          vitals: {
            lcp: { value: 2000, status: "Excellent", target: 2500 },
            fcp: { value: 1200, status: "Excellent", target: 1800 },
            cls: { value: 0.05, status: "Excellent", target: 0.1 },
            inp: { value: 100, status: "Excellent", target: 200 },
            ttfb: { value: 300, status: "Excellent", target: 600 },
          },
        },
        recommendations: [],
        browserOptimizations: {
          currentBrowser: "Chrome",
          optimizations: [],
          browserSpecificIssues: [],
        },
      };

      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      // Manually trigger the callback to simulate report generation completion
      act(() => {
        if (storedCallback) {
          storedCallback(reportData);
        }
      });

      expect(screen.getByText("Score: 95/100 (Excellent)")).toBeInTheDocument();
    });

    it("does not show score when report data is not available", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.queryByText(/Score:/)).not.toBeInTheDocument();
    });
  });

  describe("Download Functionality", () => {
    it("shows download buttons when report data is available", () => {
      const reportData = {
        summary: {
          overallScore: 80,
          grade: "Good",
          primaryIssues: [],
          strengths: [],
        },
        metrics: {
          performance: {
            fps: { value: 60, status: "Good", target: 60 },
            memory: { value: 40, status: "Good", target: 50 },
            cpu: { status: "Good", target: 50 },
          },
          vitals: {
            lcp: { status: "Good", target: 2500 },
            fcp: { status: "Good", target: 1800 },
            cls: { status: "Good", target: 0.1 },
            inp: { status: "Good", target: 200 },
            ttfb: { status: "Good", target: 600 },
          },
        },
        recommendations: [],
        browserOptimizations: {
          currentBrowser: "Chrome",
          optimizations: [],
          browserSpecificIssues: [],
        },
      };

      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      // Manually trigger the callback to simulate report generation completion
      act(() => {
        if (storedCallback) {
          storedCallback(reportData);
        }
      });

      expect(screen.getByTitle("Download JSON")).toBeInTheDocument();
      expect(screen.getByTitle("Download HTML")).toBeInTheDocument();
      expect(screen.getByTitle("Download CSV")).toBeInTheDocument();
    });

    it("does not show download buttons when no report data", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      // No download buttons should be visible
      expect(screen.queryByTitle("Download JSON")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Download HTML")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Download CSV")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("provides proper button titles and labels", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByTitle("Close (ESC)")).toBeInTheDocument();
    });

    it("handles keyboard navigation", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByTitle("Close (ESC)");
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute("title", "Close (ESC)");
    });

    it("provides proper heading structure", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "Performance Report",
      );
    });
  });

  describe("As a dialog", () => {
    const reportData = {
      summary: {
        overallScore: 80,
        grade: "Good",
        primaryIssues: [],
        strengths: [],
      },
      metrics: {
        performance: {
          fps: { value: 60, status: "Good", target: 60 },
          memory: { value: 40, status: "Good", target: 50 },
          cpu: { status: "Good", target: 50 },
        },
        vitals: {
          lcp: { status: "Good", target: 2500 },
          fcp: { status: "Good", target: 1800 },
          cls: { status: "Good", target: 0.1 },
          inp: { status: "Good", target: 200 },
          ttfb: { status: "Good", target: 600 },
        },
      },
      recommendations: [],
      browserOptimizations: {
        currentBrowser: "Chrome",
        optimizations: [],
        browserSpecificIssues: [],
      },
    };

    it("is a named dialog, not a modal one", () => {
      // Opened from the terminal, which stays usable above it.
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole("dialog", { name: "Performance report" });
      expect(dialog).not.toHaveAttribute("aria-modal");
      const backdrop = screen
        .getAllByTestId("motion-div")
        .find((div) => div.className?.includes("backdrop-blur-sm"));
      expect(backdrop).toHaveAttribute("aria-hidden", "true");
    });

    it("names its buttons by what they do", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);
      act(() => {
        storedCallback?.(reportData);
      });

      const close = screen.getByRole("button", {
        name: "Close performance report",
      });
      expect(close).toHaveAttribute("type", "button");
      expect(close).toHaveAttribute("title", "Close (ESC)");
      for (const format of ["JSON", "HTML", "CSV"]) {
        expect(
          screen.getByRole("button", { name: `Download ${format}` }),
        ).toHaveAttribute("type", "button");
      }
    });

    it("lets the keyboard reach its details, to scroll them", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      const details = screen.getByRole("region", { name: "Report details" });
      expect(details).toHaveAttribute("tabindex", "0");
      expect(details).toContainElement(screen.getByTestId("progress-ui"));
    });
  });

  describe("Styling and Layout", () => {
    it("applies correct modal styling classes", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      const motionDivs = screen.getAllByTestId("motion-div");

      // Check for modal container classes
      const modalContainer = motionDivs.find((div) =>
        div.className?.includes("fixed inset-0"),
      );
      expect(modalContainer).toHaveClass(
        "z-[9999]",
        "flex",
        "items-center",
        "justify-center",
      );

      // Check for backdrop classes
      const backdrop = motionDivs.find((div) =>
        div.className?.includes("backdrop-blur-sm"),
      );
      expect(backdrop).toHaveClass("absolute", "inset-0", "bg-black/80");
    });

    it("applies correct header styling", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      const header = screen.getByText("Performance Report").closest("div");
      expect(header?.parentElement).toHaveClass(
        "flex",
        "items-center",
        "justify-between",
        "px-6",
        "py-4",
        "border-b",
        "border-border",
      );
    });

    it("applies correct content area styling", () => {
      render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);

      // At the end of <body>, outside the render container.
      const contentArea = document.body.querySelector(
        ".flex-1.overflow-auto.p-6",
      );
      expect(contentArea).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles missing report data gracefully", () => {
      expect(() => {
        render(<PerformanceReportModal isOpen={true} onClose={mockOnClose} />);
      }).not.toThrow();
    });

    it("handles onClose being undefined", () => {
      expect(() => {
        render(
          <PerformanceReportModal
            isOpen={true}
            onClose={undefined as unknown as () => void}
          />,
        );
      }).not.toThrow();
    });
  });
});
