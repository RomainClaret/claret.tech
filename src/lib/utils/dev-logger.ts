/**
 * Development-only logger utility for production safety
 * This utility ensures no console logs appear in production builds
 */

/**
 * Development-only console.log
 */
export const devLog = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
};

/**
 * Development-only console.warn
 */
export const devWarn = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === "development") {
    console.warn(...args);
  }
};

/**
 * Development-only console.error
 */
export const devError = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === "development") {
    console.error(...args);
  }
};

/**
 * Development-only console.info
 */
export const devInfo = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === "development") {
    console.info(...args);
  }
};

/**
 * Development-only console.debug
 */
export const devDebug = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === "development") {
    console.debug(...args);
  }
};

/**
 * Production-safe error logger
 * This will always log errors, but in production it could be
 * sent to a server-side logging service instead
 */
export const logError = (error: Error | unknown, context?: string): void => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  if (process.env.NODE_ENV === "development") {
    console.error(`[${context || "Error"}]:`, errorMessage, errorStack);
  } else {
    // In production, we only log critical errors
    // Later this could be sent to server-side logging
    if (typeof window === "undefined") {
      // Server-side: safe to log
      console.error(`[${context || "Error"}]:`, errorMessage);
    }
    // Client-side: no logging in production to maintain privacy
  }
};

/**
 * Production-safe warning logger
 */
export const logWarning = (message: string, context?: string): void => {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[${context || "Warning"}]:`, message);
  } else if (typeof window === "undefined") {
    // Server-side only in production
    console.warn(`[${context || "Warning"}]:`, message);
  }
};

// Export a default logger object for convenience
export const devLogger = {
  log: devLog,
  warn: devWarn,
  error: devError,
  info: devInfo,
  debug: devDebug,
  logError,
  logWarning,
};

export default devLogger;
