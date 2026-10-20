"use client";

import React, { useEffect } from "react";
import { useErrorReport } from "@/lib/hooks/useErrorReport";
import { reloadPage } from "@/lib/utils/reload-page";
import { devError } from "@/lib/utils/dev-logger";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const reported = useErrorReport(error);

  useEffect(() => {
    // Log the error in development
    devError("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="mx-auto max-w-md text-center">
            <h2 className="mb-4 text-2xl font-bold">Something went wrong!</h2>
            <p className="mb-2 text-gray-600">
              A critical error occurred. Please try again.
            </p>
            <p role="status" className="mb-6 min-h-5 text-sm text-gray-500">
              {reported ? "A report of it was sent." : ""}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={reset}
                className="rounded-sm bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
              >
                Try again
              </button>
              {/* After a deploy, only fresh code from the server recovers. */}
              <button
                onClick={reloadPage}
                className="rounded-sm border border-blue-500 px-4 py-2 text-blue-600 hover:bg-blue-50"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
