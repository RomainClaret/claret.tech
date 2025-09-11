"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/utils/error-logger";

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error with privacy-first server-side logging
    logError(error, {
      type: "react_error_boundary",
      componentStack: errorInfo.componentStack,
      errorBoundary: "ErrorBoundary",
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            resetError={this.resetError}
          />
        );
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="mx-auto max-w-md text-center">
            <h2 className="mb-4 text-2xl font-bold text-red-600">
              Oops! Something went wrong
            </h2>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              We apologize for the inconvenience. Please try again.
            </p>
            {process.env.NODE_ENV === "development" && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Error details (development only)
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <Button onClick={this.resetError} variant="default">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
