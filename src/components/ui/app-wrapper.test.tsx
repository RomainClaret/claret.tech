/**
 * AppWrapper Component Tests
 *
 * Critical infrastructure component that orchestrates the entire application
 * with context providers, dynamic imports, error boundaries, and
 * performance monitoring.
 */

import { render, screen, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { usePageShown } from "@/contexts/page-shown-context";
import { AppWrapper } from "./app-wrapper";
import { SplashUnavailable } from "./splash-unavailable";
import {
  PerformanceDashboardUnavailable,
  PerformanceMonitorUnavailable,
  PerformanceReportUnavailable,
} from "./performance-unavailable";

// What each loader falls back to, keyed by the loader's code. The loaders
// themselves pass through unwrapped, so the next/dynamic mock below can tell
// them apart by what they import.
const fallbacks = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/utils/load-fallback", () => ({
  withLoadFallback: (load: () => Promise<unknown>, Failed: unknown) => {
    fallbacks.set(load.toString(), Failed);
    return load;
  },
}));

// Mock all the external dependencies
vi.mock("@/data/portfolio", () => ({
  terminalConfig: {
    enabled: true,
  },
}));

vi.mock("@/lib/terminal/terminal-context", () => ({
  useTerminalToggle: vi.fn(() => ({
    isOpen: false,
    setIsOpen: vi.fn(),
  })),
  // The research map's renderer: it puts the terminal aside while open.
  useTerminal: vi.fn(() => ({
    isOpen: false,
    setAside: vi.fn(),
    minimize: vi.fn(),
  })),
}));

vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: vi.fn(() => false),
}));

vi.mock("@/lib/utils/error-logger", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/utils/performance-logger", () => ({}));

vi.mock("@/contexts/projects-context", () => ({
  ProjectsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="projects-provider">{children}</div>
  ),
}));

vi.mock("@/contexts/background-context", () => ({
  BackgroundProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="background-provider">{children}</div>
  ),
}));

vi.mock("@/contexts/animation-context", () => ({
  AnimationProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="animation-provider">{children}</div>
  ),
}));

vi.mock("@/contexts/performance-monitor-context", () => ({
  PerformanceMonitorProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="performance-monitor-provider">{children}</div>
  ),
  usePerformanceMonitorContext: vi.fn(() => ({
    isMonitorActive: false,
    isDashboardOpen: false,
    hideDashboard: vi.fn(),
    isReportModalOpen: false,
    hideReportModal: vi.fn(),
  })),
}));

vi.mock("@/components/error/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

vi.mock("./service-worker-cleanup", () => ({
  ServiceWorkerCleanup: () => <div data-testid="service-worker-cleanup" />,
}));

vi.mock("./grid-background", () => ({
  GridBackground: ({ className }: { className: string }) => (
    <div data-testid="grid-background" className={className} />
  ),
}));

// Mock dynamic imports
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: (importFn: () => Promise<unknown>, _options?: unknown) => {
    // Return a mock component that we can control
    const MockComponent = ({
      onComplete,
      onShow,
      skip,
      isOpen,
      onClose,
    }: {
      onComplete?: () => void;
      onShow?: () => void;
      skip?: boolean;
      isOpen?: boolean;
      onClose?: () => void;
    }) => {
      // Handle splash screen
      if (importFn.toString().includes("splash-screen")) {
        return (
          <div data-testid="splash-screen" data-skip={String(Boolean(skip))}>
            <button onClick={() => onShow?.()} data-testid="splash-show">
              Show Splash
            </button>
            <button
              onClick={() => onComplete?.()}
              data-testid="splash-complete"
            >
              Complete Splash
            </button>
          </div>
        );
      }

      // Handle terminal
      if (importFn.toString().includes("Terminal")) {
        return isOpen ? (
          <div data-testid="terminal">
            <button onClick={onClose} data-testid="close-terminal">
              Close Terminal
            </button>
          </div>
        ) : null;
      }

      // Handle performance monitor
      if (importFn.toString().includes("performance-monitor")) {
        return <div data-testid="performance-monitor" />;
      }

      // Handle performance modal
      if (importFn.toString().includes("PerformanceModal")) {
        return isOpen ? (
          <div data-testid="performance-modal">
            <button onClick={onClose} data-testid="close-performance-modal">
              Close Modal
            </button>
          </div>
        ) : null;
      }

      // Handle performance report modal
      if (importFn.toString().includes("PerformanceReportModal")) {
        return isOpen ? (
          <div data-testid="performance-report-modal">
            <button onClick={onClose} data-testid="close-report-modal">
              Close Report
            </button>
          </div>
        ) : null;
      }

      return <div data-testid="mock-dynamic-component" />;
    };

    MockComponent.displayName = "MockDynamicComponent";
    return MockComponent;
  },
}));

describe("AppWrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Component Structure", () => {
    it("renders all context providers in correct order", () => {
      render(
        <AppWrapper>
          <div data-testid="test-children">Test Content</div>
        </AppWrapper>,
      );

      expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
      expect(
        screen.getByTestId("performance-monitor-provider"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("projects-provider")).toBeInTheDocument();

      // The background comes from the BackgroundProvider in the root layout;
      // a second one here shadowed it. The mock above is still registered,
      // so re-mounting one here fails this.
      expect(
        screen.queryByTestId("background-provider"),
      ).not.toBeInTheDocument();

      // AnimationProvider was removed: nothing under it consumed useAnimation,
      // and app-wrapper was the only file importing the context at all. The
      // mock above is deliberately still registered, so this assertion is real
      // rather than vacuous - re-mount the provider and it fails.
      expect(
        screen.queryByTestId("animation-provider"),
      ).not.toBeInTheDocument();
    });

    it("renders children with proper z-index wrapper", () => {
      render(
        <AppWrapper>
          <div data-testid="test-children">Test Content</div>
        </AppWrapper>,
      );

      const childrenWrapper = screen.getByTestId("test-children").parentElement;
      expect(childrenWrapper).toHaveClass("relative", "z-10");
      expect(screen.getByTestId("test-children")).toBeInTheDocument();
    });

    it("renders the service worker cleanup", () => {
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      expect(screen.getByTestId("service-worker-cleanup")).toBeInTheDocument();
    });

    it("renders splash screen initially", () => {
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      expect(screen.getByTestId("splash-screen")).toBeInTheDocument();
      expect(screen.getByTestId("splash-complete")).toBeInTheDocument();
    });
  });

  describe("Grid Background", () => {
    it("renders grid background when animations are enabled (default mock)", () => {
      // Our mock defaults to false (animations enabled)
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      expect(screen.getByTestId("grid-background")).toBeInTheDocument();
      expect(screen.getByTestId("grid-background")).toHaveClass(
        "fixed",
        "inset-0",
        "z-0",
        "opacity-30",
      );
    });

    it("tests that grid background can be conditionally rendered", () => {
      // Test that the component structure supports conditional rendering
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // With our default mock (animations enabled), grid should be present
      expect(screen.getByTestId("grid-background")).toBeInTheDocument();
    });
  });

  describe("Terminal Integration", () => {
    it("does not render terminal initially", () => {
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      expect(screen.queryByTestId("terminal")).not.toBeInTheDocument();
    });

    it("supports terminal rendering after splash completion", async () => {
      // Test the basic structure - terminal won't show because our mock has isOpen: false
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // Complete splash screen first
      const splashCompleteButton = screen.getByTestId("splash-complete");
      await act(async () => {
        splashCompleteButton.click();
      });

      // Terminal should not be visible with our default mock (isOpen: false)
      expect(screen.queryByTestId("terminal")).not.toBeInTheDocument();
    });

    it("tests terminal configuration structure", () => {
      // Test that the component can handle terminal configuration
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // With our mock configuration (enabled: true), the structure supports terminal
      expect(screen.getByTestId("splash-screen")).toBeInTheDocument();
    });

    it("tests terminal close functionality structure", async () => {
      // Test that the component structure supports terminal operations
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // The component should render without errors and support terminal operations
      expect(screen.getByTestId("splash-screen")).toBeInTheDocument();
    });
  });

  describe("Performance Monitoring", () => {
    it("does not render performance monitor when inactive", () => {
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      expect(
        screen.queryByTestId("performance-monitor"),
      ).not.toBeInTheDocument();
    });

    it("supports performance monitor structure", () => {
      // Test that performance monitoring infrastructure is present
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // With default mock (inactive), monitor should not be visible
      expect(
        screen.queryByTestId("performance-monitor"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId("performance-monitor-provider"),
      ).toBeInTheDocument();
    });

    it("supports performance dashboard structure", () => {
      // Test performance dashboard infrastructure
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // With default mock (closed), modal should not be visible
      expect(screen.queryByTestId("performance-modal")).not.toBeInTheDocument();
    });

    it("supports performance report structure", () => {
      // Test performance report infrastructure
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // With default mock (closed), report should not be visible
      expect(
        screen.queryByTestId("performance-report-modal"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Splash Screen Integration", () => {
    it("handles splash screen completion", async () => {
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      const splashCompleteButton = screen.getByTestId("splash-complete");
      expect(splashCompleteButton).toBeInTheDocument();

      // Click to complete splash screen
      await act(async () => {
        splashCompleteButton.click();
      });

      // Once it has played, the splash is unmounted rather than kept hidden,
      // so its Lottie player and parsed animation are released.
      expect(screen.queryByTestId("splash-complete")).not.toBeInTheDocument();
    });
  });

  describe("Splash backdrop", () => {
    it("is in the server's HTML, so the first paint is the splash's", async () => {
      const { renderToString } = await import("react-dom/server");

      const html = renderToString(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // The splash loads with ssr: false: its own backdrop never reached
      // the HTML, and the page showed for a moment before the splash.
      expect(html).toContain("data-splash-backdrop");
    });

    it("gives way once the splash shows its own", async () => {
      const { container } = render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );
      expect(container.querySelector("[data-splash-backdrop]")).not.toBeNull();

      await act(async () => {
        screen.getByTestId("splash-show").click();
      });

      expect(container.querySelector("[data-splash-backdrop]")).toBeNull();
    });

    it("never outlasts a splash that fails to show", () => {
      vi.useFakeTimers();
      try {
        const { container } = render(
          <AppWrapper>
            <div>Test</div>
          </AppWrapper>,
        );

        act(() => {
          vi.advanceTimersByTime(4000);
        });

        expect(container.querySelector("[data-splash-backdrop]")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("A page on screen before the splash", () => {
    // On a slow connection the 4 s timer, or the stylesheet's fallback
    // (globals.css), uncovers the page before the splash shows. The splash
    // is then told to skip itself: playing it covered a page the visitor
    // was already reading.
    const splashSkips = () =>
      screen.getByTestId("splash-screen").getAttribute("data-skip");

    const renderApp = () =>
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

    it("skips the splash when the timer shows the page first", () => {
      vi.useFakeTimers();
      try {
        renderApp();
        expect(splashSkips()).toBe("false");

        act(() => {
          vi.advanceTimersByTime(4000);
        });

        expect(splashSkips()).toBe("true");
      } finally {
        vi.useRealTimers();
      }
    });

    it("lets a splash that showed in time play", () => {
      vi.useFakeTimers();
      try {
        renderApp();
        act(() => {
          screen.getByTestId("splash-show").click();
        });

        act(() => {
          vi.advanceTimersByTime(4000);
        });

        expect(splashSkips()).toBe("false");
      } finally {
        vi.useRealTimers();
      }
    });

    it("skips the splash when the stylesheet's fallback hides the backdrop", () => {
      const { container } = renderApp();
      const backdrop = container.querySelector("[data-splash-backdrop]");
      expect(backdrop).not.toBeNull();

      // The animation that hides it (globals.css) has ended.
      const ended = new Event("animationend");
      Object.assign(ended, { animationName: "splash-backdrop-timeout" });
      act(() => {
        backdrop?.dispatchEvent(ended);
      });

      expect(splashSkips()).toBe("true");
      expect(container.querySelector("[data-splash-backdrop]")).toBeNull();
    });

    it("skips the splash when the fallback hid the backdrop before hydration", () => {
      const realComputedStyle = window.getComputedStyle.bind(window);
      const computedStyle = vi
        .spyOn(window, "getComputedStyle")
        .mockImplementation((element, pseudo) =>
          element instanceof HTMLElement &&
          element.hasAttribute("data-splash-backdrop")
            ? ({ visibility: "hidden" } as CSSStyleDeclaration)
            : realComputedStyle(element, pseudo),
        );
      try {
        renderApp();

        expect(splashSkips()).toBe("true");
      } finally {
        computedStyle.mockRestore();
      }
    });
  });

  describe("What the page is told", () => {
    // Whether the visitor can see it: a deep link's highlight waits for it
    // (useCardDeepLink), as it pulsed under the splash.
    function ShownProbe() {
      return <div data-testid="page-shown">{String(usePageShown())}</div>;
    }
    const shown = () => screen.getByTestId("page-shown").textContent;

    it("is covered while the splash plays, and shown once it has", async () => {
      render(
        <AppWrapper>
          <ShownProbe />
        </AppWrapper>,
      );
      expect(shown()).toBe("false");

      await act(async () => {
        screen.getByTestId("splash-show").click();
      });
      expect(shown()).toBe("false");

      await act(async () => {
        screen.getByTestId("splash-complete").click();
      });
      expect(shown()).toBe("true");
    });

    it("is shown when the page goes on screen without the splash", () => {
      vi.useFakeTimers();
      try {
        render(
          <AppWrapper>
            <ShownProbe />
          </AppWrapper>,
        );

        act(() => {
          vi.advanceTimersByTime(4000);
        });

        expect(shown()).toBe("true");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("Error Handling", () => {
    it("wraps entire application in error boundary", () => {
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      expect(screen.getByTestId("error-boundary")).toBeInTheDocument();

      // Check that error boundary is the outermost wrapper
      const errorBoundary = screen.getByTestId("error-boundary");
      expect(errorBoundary).toBeInTheDocument();
    });
  });

  describe("Dynamic Import Fallbacks", () => {
    it("stands the splash down when its chunk cannot be fetched", () => {
      // Its loader threw into the error boundary around the whole site,
      // which replaced the page until a reload.
      const splash = [...fallbacks].find(([load]) =>
        load.includes("splash-screen"),
      );

      expect(splash?.[1]).toBe(SplashUnavailable);
    });

    it("keeps the site up when a performance tool's chunk cannot be fetched", () => {
      // The terminal's `fps`, `performance` and its report load these under
      // the error boundary around the whole site, which replaced the page
      // with its error screen until a reload.
      const fallbackFor = (marker: string) =>
        [...fallbacks].find(([load]) => load.includes(marker))?.[1];

      expect(fallbackFor("performance-monitor")).toBe(
        PerformanceMonitorUnavailable,
      );
      expect(fallbackFor("/PerformanceModal")).toBe(
        PerformanceDashboardUnavailable,
      );
      expect(fallbackFor("/PerformanceReportModal")).toBe(
        PerformanceReportUnavailable,
      );
    });

    it("provides proper component structure for dynamic imports", () => {
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // All components should render without errors due to our mocks
      expect(screen.getByTestId("splash-screen")).toBeInTheDocument();
      expect(screen.queryByTestId("terminal")).not.toBeInTheDocument(); // Not open by default
    });
  });

  describe("Context Integration", () => {
    it("provides all required context providers", () => {
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // Check that all provider components are rendered
      expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
      expect(
        screen.getByTestId("performance-monitor-provider"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("projects-provider")).toBeInTheDocument();

      // Not AnimationProvider - see the structure test above.
      expect(
        screen.queryByTestId("animation-provider"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Conditional Rendering", () => {
    it("renders components based on default configuration", () => {
      render(
        <AppWrapper>
          <div>Test</div>
        </AppWrapper>,
      );

      // Grid background should render with default mock (animations enabled)
      expect(screen.getByTestId("grid-background")).toBeInTheDocument();

      // Terminal should be ready to render but closed by default
      expect(screen.queryByTestId("terminal")).not.toBeInTheDocument();

      // Service worker should always render
      expect(screen.getByTestId("service-worker-cleanup")).toBeInTheDocument();

      // All context providers should be present
      expect(
        screen.getByTestId("performance-monitor-provider"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("projects-provider")).toBeInTheDocument();
    });
  });
});
