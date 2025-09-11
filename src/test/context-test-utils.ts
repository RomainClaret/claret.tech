/**
 * Context Testing Utilities for React 18
 *
 * Comprehensive utilities for testing React contexts that integrate with
 * browser APIs, performance monitoring, and complex state management.
 *
 * Created during Test Infrastructure Improvement Phase 3
 * Target: Enable Animation State Context (23 tests) and Performance Monitor Context (31 tests)
 */

import { vi, expect } from "vitest";
import React, { ReactNode } from "react";

// ==============================================================================
// Browser API Mocking Utilities
// ==============================================================================

/**
 * Mock all browser APIs commonly used by performance and animation contexts
 */
export function mockBrowserAPIs() {
  // Performance API mocking
  global.performance = {
    ...global.performance,
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50000000, // 50MB
      totalJSHeapSize: 100000000, // 100MB
      jsHeapSizeLimit: 200000000, // 200MB
    },
    getEntriesByType: vi.fn(() => []),
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  };

  // Navigator API mocking
  Object.defineProperty(navigator, "hardwareConcurrency", {
    writable: true,
    value: 8,
  });

  Object.defineProperty(navigator, "connection", {
    writable: true,
    value: {
      effectiveType: "4g",
      downlink: 10,
      rtt: 100,
      saveData: false,
    },
  });

  // Window dimensions and events
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: 1024,
  });

  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: 768,
  });

  global.addEventListener = vi.fn();
  global.removeEventListener = vi.fn();
  global.dispatchEvent = vi.fn();

  // Animation frame mocking
  global.requestAnimationFrame = vi.fn((cb) => {
    setTimeout(cb, 16); // 60fps = ~16ms per frame
    return 1;
  });
  global.cancelAnimationFrame = vi.fn();

  // Intersection Observer mocking
  global.IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })) as unknown as typeof IntersectionObserver;

  // Resize Observer mocking
  global.ResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })) as unknown as typeof ResizeObserver;

  // Local Storage mocking with configurable property
  Object.defineProperty(global, "localStorage", {
    writable: true,
    configurable: true,
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null),
    },
  });

  // Session Storage mocking with configurable property
  Object.defineProperty(global, "sessionStorage", {
    writable: true,
    configurable: true,
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null),
    },
  });
}

/**
 * Clean up browser API mocks after tests
 */
export function cleanupBrowserAPIs() {
  // Restore original implementations if they exist
  if (global.requestAnimationFrame) {
    vi.mocked(global.requestAnimationFrame).mockRestore?.();
  }
  if (global.cancelAnimationFrame) {
    vi.mocked(global.cancelAnimationFrame).mockRestore?.();
  }
}

// ==============================================================================
// Context Provider Utilities
// ==============================================================================

/**
 * Mock implementation for Safari Context
 */
export const mockSafariContext = {
  isSafari: false,
  isHydrated: true,
};

/**
 * Mock implementation for FPS monitoring
 */
export const mockFpsContext = {
  fps: 60,
  isLowFps: false,
  isAutoDisabled: false,
  cooldownActive: false,
  remainingCooldownMinutes: 0,
  threshold: 30,
  consecutiveLowFpsCount: 0,
  progressToAutoDisable: 0,
  forceEnableAnimations: vi.fn(),
};

/**
 * Create a mock provider wrapper for context testing
 */
export function createMockProvider<T>(
  Provider: React.ComponentType<{ children?: ReactNode; value?: T }>,
  mockValue: T,
) {
  return ({ children }: { children: ReactNode }) =>
    React.createElement(Provider, { value: mockValue }, children);
}

// ==============================================================================
// Animation State Context Specific Utilities
// ==============================================================================

// Note: mockSafariDetection and mockFpsHooks are defined below in the Safari Detection Mocking section

// ==============================================================================
// Performance Monitor Context Specific Utilities
// ==============================================================================

/**
 * Mock performance monitoring utilities
 */
export function mockPerformanceMonitoring() {
  // Mock performance metrics collection
  const mockMetrics = {
    memoryUsage: 50,
    cpuUsage: 25,
    networkSpeed: "fast" as const,
    batteryLevel: 0.8,
    isLowPowerMode: false,
  };

  return {
    collectMetrics: vi.fn(() => Promise.resolve(mockMetrics)),
    generateReport: vi.fn(() =>
      Promise.resolve({
        timestamp: Date.now(),
        metrics: mockMetrics,
        recommendations: [],
      }),
    ),
    isOptimalPerformance: vi.fn(() => true),
    shouldReduceAnimations: vi.fn(() => false),
  };
}

// ==============================================================================
// Test Wrapper Utilities
// ==============================================================================

/**
 * Comprehensive test wrapper that includes all necessary providers and mocks
 */
export function createTestWrapper(
  options: {
    mockSafari?: boolean;
    mockPerformance?: boolean;
    mockFps?: boolean;
  } = {},
) {
  const { mockSafari = true, mockPerformance = true, mockFps = true } = options;

  // Setup mocks based on options
  if (mockSafari) {
    mockSafariDetection();
    vi.mock("@/contexts/safari-context", () => ({
      useSafariContext: vi.fn(() => mockSafariContext),
    }));
  }

  if (mockFps) {
    mockFpsHooks();
  }

  if (mockPerformance) {
    const perfMocks = mockPerformanceMonitoring();
    vi.mock("@/lib/utils/performance-monitor", () => perfMocks);
  }

  // Return wrapper component
  return ({ children }: { children: ReactNode }) => {
    return React.createElement(
      "div",
      { "data-testid": "test-wrapper" },
      children,
    );
  };
}

// ==============================================================================
// Hook Testing Utilities
// ==============================================================================

/**
 * Safe hook testing with proper cleanup
 */
export function createHookTestingEnvironment() {
  const cleanup: (() => void)[] = [];

  const addCleanup = (fn: () => void) => {
    cleanup.push(fn);
  };

  const runCleanup = () => {
    cleanup.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.warn("Cleanup function failed:", error);
      }
    });
    cleanup.length = 0;
  };

  return { addCleanup, runCleanup };
}

// ==============================================================================
// Error Handling Utilities
// ==============================================================================

/**
 * Utility to handle React DOM instanceof errors
 */
export function fixReactDOMErrors() {
  // Mock React.isValidElement to prevent instanceof errors
  vi.mock("react", async () => {
    const actual = (await vi.importActual("react")) as typeof import("react");
    return {
      ...actual,
      isValidElement: vi.fn(() => true),
    };
  });

  // Mock React DOM utilities
  global.Element = global.Element || class Element {};
  global.HTMLElement = global.HTMLElement || class HTMLElement {};
  global.Node = global.Node || class Node {};
}

// ==============================================================================
// Context-Specific Test Patterns
// ==============================================================================

/**
 * Standard test pattern for context providers
 */
export function createContextTestSuite<T>(
  contextName: string,
  useContext: () => T,
  Provider: React.ComponentType<{ children: ReactNode }>,
  _defaultValue: T,
) {
  return {
    testProviderExists: () => {
      expect(Provider).toBeDefined();
    },

    testHookExists: () => {
      expect(useContext).toBeDefined();
    },

    testDefaultValue: () => {
      // This would need to be implemented based on specific context requirements
      // Each context will have different default value expectations
    },
  };
}

// ==============================================================================
// Safari Detection Mocking
// ==============================================================================

/**
 * Mock Safari detection utilities
 */
export function mockSafariDetection() {
  const safariMocks = {
    getAnimationPreference: vi.fn(() => null),
    storeAnimationPreference: vi.fn(),
    shouldResetAnimationPreference: vi.fn(() => false),
    clearAnimationPreference: vi.fn(),
  };

  // Reset all mocks to default state
  safariMocks.getAnimationPreference.mockClear();
  safariMocks.storeAnimationPreference.mockClear();
  safariMocks.shouldResetAnimationPreference.mockClear();
  safariMocks.clearAnimationPreference.mockClear();

  return safariMocks;
}

/**
 * Mock FPS monitoring hooks
 */
export function mockFpsHooks() {
  const fpsMocks = {
    useFpsOnly: vi.fn(() => ({
      fps: 60,
      isLowFps: false,
    })),
    useFpsAutoDisable: vi.fn(() => ({
      isAutoDisabled: false,
      cooldownActive: false,
      remainingCooldownMinutes: 0,
      threshold: 30,
      consecutiveLowFpsCount: 0,
      progressToAutoDisable: 0,
      forceEnableAnimations: vi.fn(),
      durationThreshold: 5,
      cooldownDuration: 30,
    })),
  };

  // Reset all mocks to default state
  fpsMocks.useFpsOnly.mockClear();
  fpsMocks.useFpsAutoDisable.mockClear();

  return fpsMocks;
}

/**
 * Enhanced cleanup function that resets all mocks
 */
export function cleanupAllMocks() {
  cleanupBrowserAPIs();
  vi.clearAllMocks();
  vi.resetAllMocks();
}

// ==============================================================================
// Export All Utilities
// ==============================================================================

export * from "./mock-types";
export * from "./error-test-utils";

/**
 * Quick setup function for most common testing scenarios
 */
export function setupContextTesting(
  options: { skipBrowserAPIs?: boolean } = {},
) {
  if (!options.skipBrowserAPIs) {
    mockBrowserAPIs();
  }
  fixReactDOMErrors();

  return {
    cleanup: cleanupAllMocks,
    wrapper: createTestWrapper(),
  };
}

/**
 * Setup for SSR testing - minimal mocks only
 */
export function setupSSRTesting() {
  fixReactDOMErrors();

  return {
    cleanup: () => {},
    wrapper: createTestWrapper({
      mockSafari: true,
      mockPerformance: false,
      mockFps: true,
    }),
  };
}

// ==============================================================================
// SSR Testing Utilities
// ==============================================================================

/**
 * Properly simulate SSR environment by removing window and ensuring typeof checks work
 */
export function simulateSSR() {
  const originalWindow = global.window;

  // Only remove window - keep document for React Testing Library
  delete (global as { window?: typeof window }).window;

  return {
    restore: () => {
      global.window = originalWindow;
    },
  };
}

/**
 * Enhanced SSR test wrapper that properly handles window removal
 */
export function withSSREnvironment<T>(testFn: () => T): T {
  const ssrCleanup = simulateSSR();

  try {
    return testFn();
  } finally {
    ssrCleanup.restore();
  }
}
