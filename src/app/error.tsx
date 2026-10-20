"use client";

import React, { useEffect } from "react";
import { ErrorFallback } from "@/components/error/ErrorFallback";
import { useErrorReport } from "@/lib/hooks/useErrorReport";
import { devError } from "@/lib/utils/dev-logger";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const reported = useErrorReport(error);

  useEffect(() => {
    // Log the error in development
    devError("Application error:", error);
  }, [error]);

  return <ErrorFallback error={error} resetError={reset} reported={reported} />;
}
