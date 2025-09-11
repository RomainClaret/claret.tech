/**
 * Privacy-First Server-Side Error Logger
 *
 * This logger is designed for production error tracking without compromising user privacy:
 * - NO user identifiable information is logged
 * - NO client-side error tracking
 * - Only server-side errors are logged
 * - No third-party error monitoring services
 */

import { devError, devWarn } from "./dev-logger";

interface ErrorLogEntry {
  timestamp: string;
  level: "error" | "warn" | "info";
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  environment: string;
  nodeVersion: string;
}

/**
 * Sanitize context data to remove any potential PII
 */
function sanitizeContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    // Skip potentially sensitive keys
    const sensitiveKeys = [
      "authorization",
      "cookie",
      "password",
      "secret",
      "token",
      "key",
      "email",
      "ip",
      "user",
      "session",
      "x-forwarded-for",
      "x-real-ip",
      "cf-connecting-ip",
      "user-agent",
    ];

    if (
      sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
    ) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    // Recursively sanitize objects
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value as Record<string, unknown>);
    } else if (typeof value === "string" && value.length > 500) {
      // Truncate very long strings
      sanitized[key] = value.substring(0, 500) + "...[TRUNCATED]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Log error to server-side only (Vercel logs, console in production)
 */
export function logError(
  error: Error | string,
  context?: Record<string, unknown>,
): void {
  // Only log in server environment (not in browser)
  if (typeof window !== "undefined") {
    return;
  }

  const isDevelopment = process.env.NODE_ENV === "development";

  // In development, use dev-logger for consistency
  if (isDevelopment) {
    devError("Server Error:", error);
    if (context) {
      devError("Error Context:", context);
    }
    return;
  }

  // Production logging
  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: "error",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: context ? sanitizeContext(context) : undefined,
    environment: process.env.NODE_ENV || "unknown",
    nodeVersion: process.version,
  };

  // Log to console (captured by Vercel/server logs)
  console.error("[ERROR]", JSON.stringify(logEntry, null, 2));
}

/**
 * Log warning to server-side only
 */
export function logWarning(
  message: string,
  context?: Record<string, unknown>,
): void {
  // Only log in server environment
  if (typeof window !== "undefined") {
    return;
  }

  const isDevelopment = process.env.NODE_ENV === "development";

  // In development, use dev-logger
  if (isDevelopment) {
    devWarn("Server Warning:", message);
    if (context) {
      devWarn("Warning Context:", context);
    }
    return;
  }

  // Production logging
  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: "warn",
    message,
    context: context ? sanitizeContext(context) : undefined,
    environment: process.env.NODE_ENV || "unknown",
    nodeVersion: process.version,
  };

  console.warn("[WARNING]", JSON.stringify(logEntry, null, 2));
}

/**
 * Log info to server-side only
 */
export function logInfo(
  message: string,
  context?: Record<string, unknown>,
): void {
  // Only log in server environment
  if (typeof window !== "undefined") {
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";

  // Only log info in production for important events
  if (!isProduction) {
    return;
  }

  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: "info",
    message,
    context: context ? sanitizeContext(context) : undefined,
    environment: process.env.NODE_ENV || "unknown",
    nodeVersion: process.version,
  };

  console.info("[INFO]", JSON.stringify(logEntry, null, 2));
}

/**
 * Log API route errors with request context (sanitized)
 */
export function logApiError(
  error: Error | string,
  route: string,
  method: string,
  statusCode?: number,
): void {
  logError(error, {
    type: "api_error",
    route,
    method,
    statusCode,
  });
}

/**
 * Log performance issues (server-side only)
 */
export function logPerformanceIssue(
  metric: string,
  value: number,
  threshold: number,
  context?: Record<string, unknown>,
): void {
  logWarning(
    `Performance issue: ${metric} (${value}) exceeded threshold (${threshold})`,
    {
      type: "performance_issue",
      metric,
      value,
      threshold,
      ...context,
    },
  );
}
