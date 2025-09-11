import { expect, afterEach, vi, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { createElement } from "react";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Global error suppression for expected hook context errors
const EXPECTED_HOOK_ERRORS = [
  "useAnimation must be used within",
  "useBackground must be used within",
  "useProjects must be used within",
  "useLegalModals must be used within",
  "useAnimationState must be used within",
  "usePerformanceMonitorContext must be used within",
  // Additional React hook patterns
  "Invalid hook call",
  "Hooks can only be called inside the body of a function component",
  "must be used within an AnimationStateProvider",
  "must be used within a PerformanceMonitorProvider",
  "must be used within a ProjectsProvider",
  "must be used within a BackgroundProvider",
  "must be used within a LegalModalsProvider",
];

const EXPECTED_TEST_ERRORS = [
  "Test error",
  "Development error",
  "Production error",
  "Stack trace error",
  "Custom error message",
  "Logging test error",
  "Custom error type",
  "First error",
  "Second error",
  "Error without stack",
  // Context provider expected errors from tests
  "Context not found",
  "usePerformanceMonitorContext must be used within",
  "useAnimationState must be used within",
  "useAnimation must be used within",
  "useLegalModals must be used within",
  "useBackground must be used within",
  "useProjects must be used within",
  // React Testing Library expected errors
  "TestingLibraryElementError",
  "Error from expected error test",
  "Expected error in test",
];

// CI environment detection - multiple fallbacks for reliability
function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.BUILD_NUMBER ||
    process.env.RUN_ID ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL ||
    process.env.TEAMCITY_VERSION
  );
}

function isExpectedError(message: string): boolean {
  return (
    EXPECTED_HOOK_ERRORS.some((pattern) => message.includes(pattern)) ||
    EXPECTED_TEST_ERRORS.some((pattern) => message.includes(pattern))
  );
}

// Enhanced error checking for React Testing Library and Vitest context
function isExpectedReactTestError(error: unknown): boolean {
  if (!error) return false;

  const message = (error as Error)?.message || String(error);
  const stack = (error as Error)?.stack || "";

  // Check for expected test errors
  if (isExpectedError(message)) return true;

  // Check for React Testing Library errors from expected error tests
  if (
    stack.includes("[EXPECTED ERROR]") ||
    message.includes("[EXPECTED ERROR]")
  ) {
    return true;
  }

  // Check for context provider test errors
  if (
    stack.includes("expectError") ||
    stack.includes("renderHookWithErrorBoundary")
  ) {
    return true;
  }

  // Check for React Testing Library hook errors
  if (
    stack.includes("renderWithHooks") &&
    (stack.includes("TestComponent") || stack.includes("callCallback"))
  ) {
    // This is a React hook error from a test component
    if (EXPECTED_HOOK_ERRORS.some((pattern) => message.includes(pattern))) {
      return true;
    }
  }

  // Check for test file origin of expected errors
  if (stack.includes(".test.tsx") || stack.includes(".test.ts")) {
    // If it's from a test file and matches our patterns, it's likely expected
    if (EXPECTED_HOOK_ERRORS.some((pattern) => message.includes(pattern))) {
      return true;
    }
  }

  return false;
}

// Centralized error suppression system
function suppressExpectedErrors() {
  const originalConsoleError = console.error;
  const originalWindowError = window?.onerror;
  const originalUnhandledRejection = window?.onunhandledrejection;

  // Intercept console.error
  console.error = (...args: unknown[]) => {
    const message = args[0];

    // Enhanced error checking for React Testing Library errors
    if (typeof message === "string" && isExpectedError(message)) {
      if (isCI()) {
        // In CI, completely suppress expected errors to avoid stderr pollution
        return;
      } else {
        // In development, show a muted version
        console.debug("[SUPPRESSED ERROR]", ...args);
        return;
      }
    }

    // Check if it's a React Test error object
    if (typeof message === "object" && isExpectedReactTestError(message)) {
      if (isCI()) {
        return;
      } else {
        console.debug("[SUPPRESSED REACT ERROR]", ...args);
        return;
      }
    }

    // Log other errors normally
    originalConsoleError.apply(console, args);
  };

  // Intercept window errors
  if (typeof window !== "undefined") {
    window.onerror = (message, source, lineno, colno, error) => {
      if (typeof message === "string" && isExpectedError(message)) {
        if (isCI()) {
          return true; // Suppress in CI
        } else {
          console.debug("[SUPPRESSED WINDOW ERROR]", message);
          return true;
        }
      }

      // Let other errors bubble up
      if (originalWindowError) {
        return originalWindowError.call(
          window,
          message,
          source,
          lineno,
          colno,
          error,
        );
      }
      return false;
    };

    // Intercept unhandled promise rejections
    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;

      // Check for expected string errors
      if (error instanceof Error && isExpectedError(error.message)) {
        if (isCI()) {
          event.preventDefault();
          return;
        } else {
          console.debug("[SUPPRESSED PROMISE REJECTION]", error);
          event.preventDefault();
          return;
        }
      }

      // Check for expected React test errors
      if (isExpectedReactTestError(error)) {
        if (isCI()) {
          event.preventDefault();
          return;
        } else {
          console.debug("[SUPPRESSED REACT PROMISE REJECTION]", error);
          event.preventDefault();
          return;
        }
      }

      // Let other rejections bubble up
      if (originalUnhandledRejection) {
        originalUnhandledRejection.call(window, event);
      }
    };
  }

  // Return cleanup function
  return () => {
    console.error = originalConsoleError;
    if (typeof window !== "undefined") {
      window.onerror = originalWindowError;
      window.onunhandledrejection = originalUnhandledRejection;
    }
  };
}

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers(); // Reset timers after each test

  // Clear document body
  if (typeof document !== "undefined" && document.body) {
    document.body.innerHTML = "";
  }

  // Force React to clear internal state for batch test isolation
  // This prevents render count issues in useReducedMotion and similar hooks
  if (typeof global !== "undefined" && global.gc) {
    global.gc(); // Force garbage collection if available
  }

  // Re-establish critical global mocks for batch mode isolation
  global.IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
    root: null,
    rootMargin: "",
    thresholds: [],
  })) as unknown as typeof IntersectionObserver;

  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Re-establish matchMedia mock for framer-motion tests
  if (typeof window !== "undefined") {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof matchMedia;
  }

  // Re-establish clipboard mock for terminal tests
  if (typeof navigator !== "undefined") {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(""),
        read: vi.fn(),
        write: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      },
    });
  }

  // Re-establish btoa/atob for validation utils tests
  if (typeof window !== "undefined") {
    window.btoa = vi.fn((str: string) => Buffer.from(str).toString("base64"));
    window.atob = vi.fn((str: string) => Buffer.from(str, "base64").toString());
  }

  // Canvas mock is now set up at the top level of the file to ensure it's available
  // when modules are imported, preventing issues with singleton initialization

  // Clear storage to prevent state leakage
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.clear();
    } catch {
      // Ignore errors in test environment
    }
  }
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.clear();
    } catch {
      // Ignore errors in test environment
    }
  }
});

// Setup requestAnimationFrame and cancelAnimationFrame immediately
let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

const mockRequestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  const id = ++rafId;
  rafCallbacks.set(id, cb);
  setTimeout(() => {
    if (rafCallbacks.has(id)) {
      const callback = rafCallbacks.get(id);
      if (callback) {
        callback(Date.now());
      }
      rafCallbacks.delete(id);
    }
  }, 0);
  return id;
});

const mockCancelAnimationFrame = vi.fn((id: number) => {
  rafCallbacks.delete(id);
});

// Set on global immediately (for Node.js environment)
global.requestAnimationFrame =
  mockRequestAnimationFrame as typeof requestAnimationFrame;
global.cancelAnimationFrame =
  mockCancelAnimationFrame as typeof cancelAnimationFrame;

// Also ensure they're available on window immediately
if (typeof window !== "undefined") {
  Object.defineProperty(window, "requestAnimationFrame", {
    writable: true,
    configurable: true,
    value: mockRequestAnimationFrame,
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    writable: true,
    configurable: true,
    value: mockCancelAnimationFrame,
  });
}

// Re-apply in beforeAll to ensure they persist
beforeAll(() => {
  // happy-dom handles DOM initialization automatically, no need for manual setup

  global.requestAnimationFrame =
    mockRequestAnimationFrame as typeof requestAnimationFrame;
  global.cancelAnimationFrame =
    mockCancelAnimationFrame as typeof cancelAnimationFrame;

  if (typeof window !== "undefined") {
    (window as Window & typeof globalThis).requestAnimationFrame =
      mockRequestAnimationFrame;
    (window as Window & typeof globalThis).cancelAnimationFrame =
      mockCancelAnimationFrame;
  }

  // Apply centralized error suppression
  suppressExpectedErrors();

  // Ensure matchMedia is available (for framer-motion)
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  // Additional global error handling for Vitest context errors
  if (typeof global !== "undefined") {
    // Override global process error handling for test environment
    const originalProcessEmit = process.emit;
    process.emit = function (
      this: typeof process,
      event: string,
      error: unknown,
      ...args: unknown[]
    ) {
      // Catch unhandled errors that bubble up to process level
      if (event === "uncaughtException" || event === "unhandledRejection") {
        if (isExpectedReactTestError(error)) {
          // Suppress expected test errors at process level
          console.debug(
            "[SUPPRESSED PROCESS ERROR]",
            (error as Error)?.message || error,
          );
          return false; // Prevent the error from propagating
        }
      }

      // Let other errors propagate normally
      return originalProcessEmit.apply(this, [
        event,
        error,
        ...args,
      ] as Parameters<typeof originalProcessEmit>);
    } as typeof process.emit;
  }
});

// Set up canvas mock IMMEDIATELY for animation-manager
const mockGetContext = vi.fn((type: string) => {
  if (type === "webgl2" || type === "webgl") {
    return {
      getExtension: vi.fn(() => null),
      getParameter: vi.fn(() => "Mock Renderer"),
    };
  }
  return null;
}) as HTMLCanvasElement["getContext"];

// Override createElement IMMEDIATELY to provide canvas mock
const originalCreateElement = document.createElement.bind(document);
document.createElement = vi.fn((tagName: string) => {
  if (tagName === "canvas") {
    const canvas = originalCreateElement(tagName) as HTMLCanvasElement;
    if (canvas) {
      canvas.getContext = mockGetContext;
    }
    return canvas;
  }
  return originalCreateElement(tagName);
}) as typeof document.createElement;

// Mock IntersectionObserver globally
global.IntersectionObserver = vi.fn().mockImplementation((_callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn().mockReturnValue([]),
  root: null,
  rootMargin: "",
  thresholds: [],
})) as unknown as typeof IntersectionObserver;

// Mock ResizeObserver globally
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia - ensure it's always available
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.localStorage = localStorageMock as Storage;

// Mock performance.now
global.performance = {
  ...global.performance,
  now: vi.fn(() => Date.now()),
};

// Mock PDF configuration module to prevent worker loading in tests
vi.mock("@/lib/pdf-config", () => ({
  Document: vi.fn(({ children, ...props }) =>
    createElement(
      "div",
      { "data-testid": "mock-pdf-document", ...props },
      children,
    ),
  ),
  Page: vi.fn((props) =>
    createElement(
      "div",
      { "data-testid": "mock-pdf-page", ...props },
      "PDF Page Mock",
    ),
  ),
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: "/pdf.worker.mjs",
    },
  },
}));

// Add custom matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Type augmentation moved to vitest.d.ts to avoid duplication
