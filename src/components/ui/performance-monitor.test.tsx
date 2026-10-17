import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PerformanceMonitor } from "./performance-monitor";
import { usePerformanceMonitorContext } from "@/contexts/performance-monitor-context";
import { useAnimationState } from "@/contexts/animation-state-context";
import { usePerformanceMonitor } from "@/lib/hooks/usePerformanceMonitor";

// Mock the contexts and hooks
vi.mock("@/contexts/performance-monitor-context");
vi.mock("@/contexts/animation-state-context");
vi.mock("@/lib/hooks/usePerformanceMonitor");

const mockUsePerformanceMonitorContext =
  usePerformanceMonitorContext as ReturnType<typeof vi.fn>;
const mockUseAnimationState = useAnimationState as ReturnType<typeof vi.fn>;
const mockUsePerformanceMonitor = usePerformanceMonitor as ReturnType<
  typeof vi.fn
>;

describe("PerformanceMonitor", () => {
  const defaultContextValue = {
    isMonitorActive: true,
    hidePerformanceMonitor: vi.fn(),
    monitoringOptions: {
      webVitals: true,
      cpu: false,
      gpu: false,
      memory: true,
      network: false,
      resources: false,
      hardware: false,
    },
    toggleMonitoringOption: vi.fn(),
    enableAllMonitoring: vi.fn(),
    disableAllMonitoring: vi.fn(),
  };

  const defaultAnimationState = {
    areAnimationsPlaying: true,
    isAutoDisabled: false,
    cooldownActive: false,
    remainingCooldownMinutes: 0,
    fpsThreshold: 15,
    consecutiveLowFpsCount: 0,
    progressToAutoDisable: 0,
  };

  const defaultPerformanceData = {
    fps: 60,
    averageFps: 58,
    minFps: 45,
    maxFps: 60,
    activeAnimations: 5,
    isLagging: false,
    browserInfo: "Chrome 120",
    shouldReduceAnimations: false,
    getOptimizationStatus: vi.fn(() => "optimized"),
    getPerformanceGrade: vi.fn(() => "A"),
    lcp: 1200,
    inp: 50,
    cls: 0.05,
    fcp: 800,
    ttfb: 200,
    memoryUsed: 50,
    memoryLimit: 100,
    memoryPercentage: 50,
    connectionType: "4g",
    effectiveBandwidth: 10,
    rtt: 50,
    saveData: false,
    resourceCount: 25,
    longTaskCount: 2,
    totalTransferSize: 500,
    fpsHistory: [60, 58, 59, 60],
    memoryHistory: [45, 50, 48, 52],
    cpuCores: 8,
    cpuUsage: 25,
    cpuScore: 8500,
    cpuHistory: [20, 25, 22, 28],
    gpuVendor: "NVIDIA",
    gpuRenderer: "GeForce RTX 3070",
    gpuUsage: 15,
    gpuScore: 12000,
    gpuTier: 3,
    gpuHistory: [12, 15, 13, 16],
    deviceMemory: 16,
    getWebVitalGrade: vi.fn(() => "A"),
    getWebVitalsScore: vi.fn(() => 95),
    getMemoryStatus: vi.fn(() => "good"),
    getNetworkQuality: vi.fn(() => "excellent"),
    getCpuGrade: vi.fn(() => "A"),
    getCpuStatus: vi.fn(() => "Normal"),
    getGpuGrade: vi.fn(() => "A+"),
    getGpuTierLabel: vi.fn(() => "High-end"),
    getThermalState: vi.fn(() => "normal"),
    getRecommendations: vi.fn(() => []),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUsePerformanceMonitorContext.mockReturnValue(defaultContextValue);
    mockUseAnimationState.mockReturnValue(defaultAnimationState);
    mockUsePerformanceMonitor.mockReturnValue(defaultPerformanceData);
  });

  describe("Form Field Accessibility", () => {
    it("has proper id and name attributes for monitoring checkboxes", () => {
      render(<PerformanceMonitor />);

      // Expand the component to show monitoring options
      const expandButton = screen.getByText("+");
      fireEvent.click(expandButton);

      // Check that monitoring option checkboxes have proper accessibility attributes
      const webVitalsCheckbox = screen.getByLabelText("WebVitals");
      const cpuCheckbox = screen.getByLabelText("Cpu");
      const memoryCheckbox = screen.getByLabelText("Memory");

      expect(webVitalsCheckbox).toHaveAttribute("id", "monitoring-webVitals");
      expect(webVitalsCheckbox).toHaveAttribute("name", "monitoring-webVitals");
      expect(webVitalsCheckbox).toHaveAttribute("type", "checkbox");

      expect(cpuCheckbox).toHaveAttribute("id", "monitoring-cpu");
      expect(cpuCheckbox).toHaveAttribute("name", "monitoring-cpu");
      expect(cpuCheckbox).toHaveAttribute("type", "checkbox");

      expect(memoryCheckbox).toHaveAttribute("id", "monitoring-memory");
      expect(memoryCheckbox).toHaveAttribute("name", "monitoring-memory");
      expect(memoryCheckbox).toHaveAttribute("type", "checkbox");
    });

    it("reflects checkbox states correctly", () => {
      render(<PerformanceMonitor />);

      // Expand the component to show monitoring options
      const expandButton = screen.getByText("+");
      fireEvent.click(expandButton);

      const webVitalsCheckbox = screen.getByLabelText(
        "WebVitals",
      ) as HTMLInputElement;
      const cpuCheckbox = screen.getByLabelText("Cpu") as HTMLInputElement;
      const memoryCheckbox = screen.getByLabelText(
        "Memory",
      ) as HTMLInputElement;

      expect(webVitalsCheckbox.checked).toBe(true); // webVitals: true
      expect(cpuCheckbox.checked).toBe(false); // cpu: false
      expect(memoryCheckbox.checked).toBe(true); // memory: true
    });

    it("calls toggleMonitoringOption when checkboxes are clicked", () => {
      render(<PerformanceMonitor />);

      // Expand the component to show monitoring options
      const expandButton = screen.getByText("+");
      fireEvent.click(expandButton);

      const cpuCheckbox = screen.getByLabelText("Cpu");
      fireEvent.click(cpuCheckbox);

      expect(defaultContextValue.toggleMonitoringOption).toHaveBeenCalledWith(
        "cpu",
      );
    });

    it("renders all monitoring option checkboxes with proper attributes", () => {
      render(<PerformanceMonitor />);

      // Expand the component to show monitoring options
      const expandButton = screen.getByText("+");
      fireEvent.click(expandButton);

      const expectedOptions = [
        "webVitals",
        "cpu",
        "gpu",
        "memory",
        "network",
        "resources",
        "hardware",
      ];

      expectedOptions.forEach((option) => {
        // Convert to display format (first letter uppercase)
        // Convert to display format (webVitals -> WebVitals, cpu -> Cpu, etc.)
        const displayName =
          option === "webVitals"
            ? "WebVitals"
            : option.charAt(0).toUpperCase() + option.slice(1);
        const checkbox = screen.getByLabelText(displayName);

        expect(checkbox).toHaveAttribute("id", `monitoring-${option}`);
        expect(checkbox).toHaveAttribute("name", `monitoring-${option}`);
        expect(checkbox).toHaveAttribute("type", "checkbox");
      });
    });
  });

  describe("Performance test", () => {
    it("counts its time to the last reading, not the clock while rendering", () => {
      const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
      const { rerender } = render(<PerformanceMonitor />);
      fireEvent.click(
        screen.getByRole("button", { name: "Performance details" }),
      );
      fireEvent.click(screen.getByRole("tab", { name: /Timeline/ }));
      fireEvent.click(screen.getByRole("button", { name: "Start Test" }));

      mockUsePerformanceMonitor.mockReturnValue({
        ...defaultPerformanceData,
        sampledAt: 6000,
      });
      clock.mockReturnValue(9000);
      rerender(<PerformanceMonitor />);

      expect(screen.getByRole("button", { name: /^Stop/ })).toHaveTextContent(
        "Stop (5s)",
      );
      clock.mockRestore();
    });
  });

  describe("Controls from the keyboard", () => {
    it("opens its details with a real, stated button", () => {
      // The expand control was a div: no keyboard, no name, no state.
      render(<PerformanceMonitor />);

      const details = screen.getByRole("button", {
        name: "Performance details",
      });
      expect(details).toHaveAttribute("type", "button");
      expect(details).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(details);

      expect(details).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByLabelText("WebVitals")).toBeInTheDocument();
    });

    it("names its close button by what it does", () => {
      // Its name was "×".
      render(<PerformanceMonitor />);

      const close = screen.getByRole("button", {
        name: "Close performance monitor",
      });
      expect(close).toHaveAttribute("type", "button");
      expect(close).toHaveAttribute("title", "Close performance monitor (ESC)");
    });

    it("shows its views as tabs: one selected, one Tab stop", () => {
      // They were seven toggle buttons, seven Tab stops, no arrow keys.
      render(<PerformanceMonitor />);
      fireEvent.click(
        screen.getByRole("button", { name: "Performance details" }),
      );

      const tablist = screen.getByRole("tablist", { name: "Monitor views" });
      const tabs = within(tablist).getAllByRole("tab");
      expect(tabs).toHaveLength(7);
      const selected = screen.getByRole("tab", { selected: true });
      expect(selected).toHaveAccessibleName(/^Overview/);
      expect(tabs.filter((tab) => tab.tabIndex === 0)).toEqual([selected]);
      const panel = screen.getByRole("tabpanel");
      expect(panel).toHaveAttribute("aria-labelledby", selected.id);
      expect(selected).toHaveAttribute("aria-controls", panel.id);
    });

    it("moves between its views with the arrow keys, Home and End", () => {
      render(<PerformanceMonitor />);
      fireEvent.click(
        screen.getByRole("button", { name: "Performance details" }),
      );
      const selected = () => screen.getByRole("tab", { selected: true });

      fireEvent.keyDown(selected(), { key: "ArrowRight" });
      expect(selected()).toHaveAccessibleName(/^Web Vitals/);
      expect(document.activeElement).toBe(selected());

      fireEvent.keyDown(selected(), { key: "End" });
      expect(selected()).toHaveAccessibleName(/^System/);
      fireEvent.keyDown(selected(), { key: "ArrowRight" });
      expect(selected()).toHaveAccessibleName(/^Overview/);
      fireEvent.keyDown(selected(), { key: "ArrowLeft" });
      expect(selected()).toHaveAccessibleName(/^System/);
      fireEvent.keyDown(selected(), { key: "Home" });
      expect(selected()).toHaveAccessibleName(/^Overview/);
      expect(document.activeElement).toBe(selected());
      expect(screen.getByRole("tabpanel")).toHaveAttribute(
        "aria-labelledby",
        selected().id,
      );

      fireEvent.click(screen.getByRole("tab", { name: /^Memory/ }));
      expect(selected()).toHaveAccessibleName(/^Memory/);
    });
  });

  describe("Tab counts", () => {
    it("shows a count of 0 in its badge, not as a bare 0", () => {
      // `{tab.count && …}` rendered the 0 itself, outside the badge.
      mockUsePerformanceMonitor.mockReturnValue({
        ...defaultPerformanceData,
        resourceCount: 0,
      });
      render(<PerformanceMonitor />);
      fireEvent.click(
        screen.getByRole("button", { name: "Performance details" }),
      );

      const resources = screen.getByRole("tab", { name: /^Resources/ });
      expect(within(resources).getByText("0").tagName).toBe("SPAN");
      const bare = [...resources.childNodes].filter(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent === "0",
      );
      expect(bare).toHaveLength(0);
    });
  });

  describe("Component Rendering", () => {
    it("opens at the end of the page's body, above a dialog already open", () => {
      // Rendered in place at the PDF reader's z-index, it painted under a
      // reader already open, which a portal puts at the end of <body>.
      const { container } = render(<PerformanceMonitor />);

      const monitor = document.querySelector<HTMLElement>(
        '[data-performance-monitor-active="true"]',
      );
      expect(monitor).not.toBeNull();
      expect(container).not.toContainElement(monitor);
      expect(document.body.lastElementChild).toContainElement(monitor);
    });

    it("renders without crashing", () => {
      render(<PerformanceMonitor />);
      expect(screen.getByText("60 FPS")).toBeInTheDocument(); // FPS display
    });

    it("displays basic performance metrics", () => {
      render(<PerformanceMonitor />);

      expect(screen.getByText("60 FPS")).toBeInTheDocument(); // Current FPS
      // Active animations count is only shown in expanded view
    });

    it("displays monitoring controls when expanded", () => {
      render(<PerformanceMonitor />);

      // Expand the component
      const expandButton = screen.getByText("+");
      fireEvent.click(expandButton);

      // Should show monitoring option toggles
      expect(screen.getByLabelText("WebVitals")).toBeInTheDocument();
      expect(screen.getByLabelText("Memory")).toBeInTheDocument();
    });

    it("calls hidePerformanceMonitor when close button is clicked", () => {
      render(<PerformanceMonitor />);

      const closeButton = screen.getByText("×");
      fireEvent.click(closeButton);

      expect(defaultContextValue.hidePerformanceMonitor).toHaveBeenCalled();
    });
  });

  describe("Expandable Interface", () => {
    it("starts in collapsed state", () => {
      render(<PerformanceMonitor />);

      // Initially should show minimal interface
      expect(screen.queryByText("Web Vitals")).not.toBeInTheDocument();
    });

    it("expands when clicked", () => {
      render(<PerformanceMonitor />);

      // Find and click the expand/toggle button
      const expandButton = screen.getByText("+");
      fireEvent.click(expandButton);

      // Should now show expanded interface with monitoring options
      expect(screen.getByLabelText("WebVitals")).toBeInTheDocument();
    });
  });

  describe("Monitoring Options Integration", () => {
    it("enables all monitoring when Enable All is clicked", () => {
      render(<PerformanceMonitor />);

      // Expand the component
      const expandButton = screen.getByText("+");
      fireEvent.click(expandButton);

      const enableAllButton = screen.getByText("All");
      fireEvent.click(enableAllButton);

      expect(defaultContextValue.enableAllMonitoring).toHaveBeenCalled();
    });

    it("disables all monitoring when Disable All is clicked", () => {
      render(<PerformanceMonitor />);

      // Expand the component
      const expandButton = screen.getByText("+");
      fireEvent.click(expandButton);

      const disableAllButton = screen.getByText("FPS Only");
      fireEvent.click(disableAllButton);

      expect(defaultContextValue.disableAllMonitoring).toHaveBeenCalled();
    });
  });

  describe("Performance Grades and Status", () => {
    it("renders performance data without errors", () => {
      expect(() => render(<PerformanceMonitor />)).not.toThrow();
    });

    it("has access to performance data functions", () => {
      expect(defaultPerformanceData.getPerformanceGrade).toBeDefined();
      expect(defaultPerformanceData.getOptimizationStatus).toBeDefined();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels for interactive elements", () => {
      render(<PerformanceMonitor />);

      // Expand the component
      const expandButton = screen.getByText("+");
      fireEvent.click(expandButton);

      // Checkboxes should have proper labels
      const webVitalsCheckbox = screen.getByLabelText("WebVitals");
      expect(webVitalsCheckbox).toHaveAccessibleName("WebVitals");
    });

    it("maintains keyboard navigation support", () => {
      render(<PerformanceMonitor />);

      // Expand the component
      const expandButton = screen.getByText("+");
      fireEvent.click(expandButton);

      const firstCheckbox = screen.getByLabelText("WebVitals");
      expect(firstCheckbox).toBeInstanceOf(HTMLInputElement);
      expect(firstCheckbox.tabIndex).not.toBe(-1);
    });
  });
});
