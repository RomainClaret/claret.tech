"use client";

import React from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20">
            <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          Something went wrong
        </h1>

        <p className="mb-6 text-gray-600 dark:text-gray-400">
          We encountered an unexpected error. Don&apos;t worry, we&apos;ve been
          notified and are working on fixing it.
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="mb-6">
            <details className="text-left">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                Error details (development only)
              </summary>
              <div className="mt-2 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {error.name || "Error"}: {error.message}
                </p>
                <pre className="overflow-x-auto text-xs text-gray-600 dark:text-gray-400">
                  {error.stack}
                </pre>
              </div>
            </details>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={resetError}
            variant="default"
            className="inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Link href="/">
            <Button
              variant="outline"
              className="inline-flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
