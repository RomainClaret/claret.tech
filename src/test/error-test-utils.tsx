/**
 * Error Testing Utilities for React Hook Testing
 *
 * Comprehensive utilities for testing React hooks that throw errors when used
 * improperly (e.g., outside their required providers). These utilities work
 * with our custom Vitest environment to properly capture and test errors.
 *
 * Key features:
 * - Error boundary wrapper for hook testing
 * - Enhanced renderHook with error capturing
 * - Assertion helpers for hook errors
 * - Error isolation and recovery mechanisms
 *
 * Created for Engineering Excellence: Achieving 100% Test Pass Rate
 */

import React, { Component, ReactNode, ErrorInfo } from "react";
import {
  renderHook as originalRenderHook,
  RenderHookOptions,
  RenderHookResult,
} from "@testing-library/react";
import { act } from "@testing-library/react";
import { vi } from "vitest";

// Global error capture interface (set by our custom environment)
interface ErrorCaptureGlobal {
  captureError: (error: Error, context?: string) => void;
  getLastError: () => CapturedError | undefined;
  getCapturedErrors: () => CapturedError[];
  clearErrors: () => void;
  hasErrors: () => boolean;
}

interface CapturedError {
  error: Error;
  errorInfo?: unknown;
  timestamp: number;
  testContext?: string;
}

// Extend global to include our error capture
declare global {
  // eslint-disable-next-line no-var
  var __VITEST_ERROR_CAPTURE__: ErrorCaptureGlobal | undefined;
}

/**
 * Error boundary component for capturing React errors in tests
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class TestErrorBoundary extends Component<
  {
    children: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
  },
  ErrorBoundaryState
> {
  constructor(props: {
    children: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
  }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Capture the error through our global handler
    if (global.__VITEST_ERROR_CAPTURE__) {
      global.__VITEST_ERROR_CAPTURE__.captureError(error, "ErrorBoundary");
    }

    // Update state with error info
    this.setState({
      hasError: true,
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Return null to prevent rendering when error occurs
      return null;
    }

    return this.props.children;
  }

  // Method to get the captured error
  getError(): { error: Error; errorInfo: ErrorInfo } | null {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      return {
        error: this.state.error,
        errorInfo: this.state.errorInfo,
      };
    }
    return null;
  }
}

/**
 * Enhanced renderHook that captures errors thrown by hooks
 */
export function renderHookWithErrorBoundary<T>(
  hook: () => T,
  options?: RenderHookOptions<unknown> & {
    expectError?: boolean;
    errorContext?: string;
  },
): RenderHookResult<T, unknown> & {
  getError: () => Error | null;
  hasError: () => boolean;
  clearErrors: () => void;
} {
  let capturedError: Error | null = null;
  let originalConsoleError: typeof console.error;
  let originalOnError: OnErrorEventHandler;
  let originalOnUnhandledRejection:
    | ((event: PromiseRejectionEvent) => void)
    | null;

  // Setup error capture
  const setupErrorCapture = () => {
    // Store original console.error
    originalConsoleError = console.error;

    // Store original window error handlers
    originalOnError = window.onerror;
    originalOnUnhandledRejection = window.onunhandledrejection;

    // Mock console.error to capture React errors with enhanced CI suppression
    console.error = vi.fn((...args: unknown[]) => {
      const message = args[0];
      const fullMessage = args.join(" ");

      // Enhanced pattern matching for expected errors with comprehensive patterns
      const isExpectedError =
        (typeof message === "string" &&
          (message.includes("must be used within") ||
            message.includes("Invalid hook call") ||
            message.includes(
              "usePerformanceMonitorContext must be used within",
            ) ||
            message.includes("useProjects must be used within") ||
            message.includes("useAnimation must be used within") ||
            message.includes("useBackground must be used within"))) ||
        (typeof fullMessage === "string" &&
          (fullMessage.includes("Uncaught [Error:") ||
            fullMessage.includes("The above error occurred in the") ||
            fullMessage.includes("React will try to recreate") ||
            fullMessage.includes(
              "useAnimation must be used within an AnimationProvider",
            ) ||
            fullMessage.includes(
              "useProjects must be used within a ProjectsProvider",
            ) ||
            fullMessage.includes(
              "useBackground must be used within a BackgroundProvider",
            )));

      if (isExpectedError) {
        // This is likely a hook error, create an Error object and suppress output
        if (typeof message === "string") {
          capturedError = new Error(message);
        }
        // In CI, completely suppress expected errors to avoid stderr pollution
        if (process.env.CI) {
          return; // Don't log anything
        }
      } else {
        // Call original for other errors
        originalConsoleError.apply(console, args);
      }
    });

    // Suppress jsdom uncaught errors for our expected React hook errors
    window.onerror = (message, _source, _lineno, _colno, error) => {
      const messageStr = typeof message === "string" ? message : "";
      const errorMessage = error?.message || "";

      // Enhanced detection of expected errors with comprehensive patterns
      const isExpectedError =
        messageStr.includes("must be used within") ||
        messageStr.includes("Invalid hook call") ||
        errorMessage.includes("must be used within") ||
        errorMessage.includes("Invalid hook call") ||
        messageStr.includes("Uncaught [Error:") ||
        messageStr.includes(
          "useAnimation must be used within an AnimationProvider",
        ) ||
        messageStr.includes(
          "useProjects must be used within a ProjectsProvider",
        ) ||
        messageStr.includes(
          "useBackground must be used within a BackgroundProvider",
        ) ||
        messageStr.includes(
          "usePerformanceMonitorContext must be used within",
        ) ||
        (error &&
          (errorMessage.includes(
            "usePerformanceMonitorContext must be used within",
          ) ||
            errorMessage.includes("useProjects must be used within") ||
            errorMessage.includes("useAnimation must be used within") ||
            errorMessage.includes("useBackground must be used within")));

      if (isExpectedError) {
        // Suppress jsdom error reporting for expected hook errors
        if (error) {
          capturedError = error;
        } else if (messageStr) {
          capturedError = new Error(messageStr);
        }
        return true; // Prevent default error handling (suppress stderr)
      }

      // Let other errors bubble up
      if (originalOnError) {
        return originalOnError.call(
          window,
          message,
          _source,
          _lineno,
          _colno,
          error,
        );
      }
      return false;
    };

    // Handle unhandled promise rejections
    window.onunhandledrejection = (event) => {
      const error = event.reason;
      const errorMessage = error instanceof Error ? error.message : "";

      // Enhanced detection for promise rejections with comprehensive patterns
      const isExpectedError =
        error instanceof Error &&
        (errorMessage.includes("must be used within") ||
          errorMessage.includes("Invalid hook call") ||
          errorMessage.includes(
            "usePerformanceMonitorContext must be used within",
          ) ||
          errorMessage.includes("useProjects must be used within") ||
          errorMessage.includes("useAnimation must be used within") ||
          errorMessage.includes("useBackground must be used within") ||
          errorMessage.includes(
            "useAnimation must be used within an AnimationProvider",
          ) ||
          errorMessage.includes(
            "useProjects must be used within a ProjectsProvider",
          ) ||
          errorMessage.includes(
            "useBackground must be used within a BackgroundProvider",
          ));

      if (isExpectedError) {
        capturedError = error;
        event.preventDefault(); // Suppress jsdom error reporting
        return;
      }

      // Let other rejections bubble up
      if (originalOnUnhandledRejection) {
        originalOnUnhandledRejection.call(window, event);
      }
    };
  };

  const restoreErrorCapture = () => {
    if (originalConsoleError) {
      console.error = originalConsoleError;
    }
    if (originalOnError !== undefined) {
      window.onerror = originalOnError;
    }
    if (originalOnUnhandledRejection !== undefined) {
      window.onunhandledrejection = originalOnUnhandledRejection;
    }
  };

  // Setup error capture before rendering
  setupErrorCapture();

  // Clear any previous errors
  capturedError = null;

  // Create wrapper with error boundary
  const ErrorBoundaryWrapper = ({ children }: { children: ReactNode }) => {
    return (
      <TestErrorBoundary
        onError={(error, _errorInfo) => {
          capturedError = error;
        }}
      >
        {options?.wrapper ? (
          <options.wrapper>{children}</options.wrapper>
        ) : (
          children
        )}
      </TestErrorBoundary>
    );
  };

  let result: RenderHookResult<T, unknown>;

  try {
    // Render the hook with error boundary
    result = originalRenderHook(hook, {
      ...options,
      wrapper: ErrorBoundaryWrapper,
    });
  } catch (error) {
    // If error is thrown during render, capture it
    if (error instanceof Error) {
      capturedError = error;
    }
    // Create a mock result for failed renders
    result = {
      result: { current: undefined as T },
      rerender: vi.fn(),
      unmount: vi.fn(),
    };
  } finally {
    // Restore error handling
    restoreErrorCapture();
  }

  return {
    ...result,
    getError: (): Error | null => {
      return capturedError;
    },
    hasError: (): boolean => {
      return capturedError !== null;
    },
    clearErrors: (): void => {
      capturedError = null;
    },
  };
}

/**
 * Assertion helper for hook errors
 */
export function expectHookError(
  error: Error | null,
  expectedError: {
    message: string | RegExp;
    type?: new (...args: unknown[]) => Error;
  },
) {
  if (!error) {
    throw new Error(
      "Expected hook to throw an error, but no error was captured",
    );
  }

  // Check error type
  if (expectedError.type) {
    if (!(error instanceof expectedError.type)) {
      throw new Error(
        `Expected error to be instance of ${expectedError.type.name}, but got ${(error as Error).constructor.name}`,
      );
    }
  }

  // Check error message
  if (typeof expectedError.message === "string") {
    if (error.message !== expectedError.message) {
      throw new Error(
        `Expected error message "${expectedError.message}", but got "${error.message}"`,
      );
    }
  } else if (expectedError.message instanceof RegExp) {
    if (!expectedError.message.test(error.message)) {
      throw new Error(
        `Expected error message to match ${expectedError.message}, but got "${error.message}"`,
      );
    }
  }
}

/**
 * Higher-order component for error isolation in tests
 */
export function withErrorIsolation<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<
  P & { onError?: (error: Error, errorInfo: ErrorInfo) => void }
> {
  return function WrappedComponent(props) {
    const { onError, ...componentProps } = props as P & {
      onError?: (error: Error, errorInfo: ErrorInfo) => void;
    };

    return (
      <TestErrorBoundary onError={onError}>
        <Component {...(componentProps as P)} />
      </TestErrorBoundary>
    );
  };
}

/**
 * Create an error boundary wrapper for custom providers
 */
export function createErrorBoundaryWrapper(
  Provider?: React.ComponentType<{ children: ReactNode }>,
): React.ComponentType<{ children: ReactNode }> {
  return function ErrorBoundaryWrapper({ children }) {
    return (
      <TestErrorBoundary>
        {Provider ? <Provider>{children}</Provider> : children}
      </TestErrorBoundary>
    );
  };
}

/**
 * Test helper to verify error handling in async scenarios
 */
export async function testAsyncHookError<T>(
  hookFn: () => T,
  expectedError: {
    message: string | RegExp;
    type?: new (...args: unknown[]) => Error;
  },
  options?: RenderHookOptions<unknown>,
): Promise<void> {
  const { getError } = renderHookWithErrorBoundary(hookFn, options);

  // Wait for any async operations to complete
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expectHookError(getError(), expectedError);
}

/**
 * Utility to test hook errors in different scenarios
 */
export interface HookErrorTestScenario<T> {
  name: string;
  hookFn: () => T;
  expectedError: {
    message: string | RegExp;
    type?: new (...args: unknown[]) => Error;
  };
  setup?: () => void | Promise<void>;
  cleanup?: () => void | Promise<void>;
}

export async function testHookErrorScenarios<T>(
  scenarios: HookErrorTestScenario<T>[],
): Promise<void> {
  for (const scenario of scenarios) {
    // Setup
    if (scenario.setup) {
      await scenario.setup();
    }

    try {
      // Test the scenario
      await testAsyncHookError(scenario.hookFn, scenario.expectedError);
    } catch (error) {
      // Add scenario context to error
      const contextualError = new Error(
        `Error in scenario "${scenario.name}": ${(error as Error).message}`,
      );
      contextualError.stack = (error as Error).stack;
      throw contextualError;
    } finally {
      // Cleanup
      if (scenario.cleanup) {
        await scenario.cleanup();
      }
    }
  }
}

/**
 * Debug utility to inspect captured errors
 */
export function inspectCapturedErrors(): CapturedError[] {
  if (!global.__VITEST_ERROR_CAPTURE__) {
    console.warn(
      "Error capture not available. Make sure you are using the custom Vitest environment.",
    );
    return [];
  }

  const errors = global.__VITEST_ERROR_CAPTURE__.getCapturedErrors();
  console.log("Captured Errors:", errors);
  return errors;
}

/**
 * Utility to clear all captured errors
 */
export function clearAllCapturedErrors(): void {
  if (global.__VITEST_ERROR_CAPTURE__) {
    global.__VITEST_ERROR_CAPTURE__.clearErrors();
  }
}

/**
 * Check if error capture is available
 */
export function isErrorCaptureAvailable(): boolean {
  return typeof global.__VITEST_ERROR_CAPTURE__ !== "undefined";
}

// ==============================================================================
// Expected Error Context Utilities
// ==============================================================================

/**
 * Provides clear context for intentional error tests
 * Use this to explain why stderr output is expected and indicates success
 */
export function logExpectedError(testName: string, expectedError: string) {
  console.info(`⚠️ EXPECTED ERROR TEST: ${testName}`);
  console.info(`   Expected stderr: "${expectedError}"`);
  console.info(
    "   This error proves our error handling infrastructure works correctly.",
  );
  console.info(
    "   ↓ The following stderr output is intentional and indicates success:",
  );
}

/**
 * Enhanced hook error testing with better error context
 * Combines error logging context with existing error testing infrastructure
 */
export function testHookErrorWithContext(
  testName: string,
  hook: () => unknown,
  expectedMessage: string,
  _options: { expectError?: boolean } = {},
) {
  // Log clear context about this expected error
  logExpectedError(testName, expectedMessage);

  // Use existing error testing infrastructure
  const { getError } = renderHookWithErrorBoundary(hook, { expectError: true });

  expectHookError(getError(), {
    message: expectedMessage,
    type: Error as new (...args: unknown[]) => Error,
  });
}
