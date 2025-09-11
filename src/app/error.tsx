"use client";

import React, { useEffect } from "react";
import { ErrorFallback } from "@/components/error/ErrorFallback";
import { devError } from "@/lib/utils/dev-logger";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log the error in development
    devError("Application error:", error);
  }, [error]);

  return <ErrorFallback error={error} resetError={reset} />;
}
