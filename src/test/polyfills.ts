// URL and URLSearchParams polyfills for happy-dom environment
// This file MUST be loaded before any other imports

import { URL, URLSearchParams } from "url";

// Force polyfill installation with proper type handling
// Check if URL needs to be polyfilled (safely handle read-only properties)
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!globalThis.URL || (globalThis as any).URL !== URL) {
    Object.defineProperty(globalThis, "URL", {
      value: URL,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
} catch {
  // Property might be read-only, that's okay if it already exists
}

try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (
    !globalThis.URLSearchParams ||
    (globalThis as any).URLSearchParams !== URLSearchParams
  ) {
    Object.defineProperty(globalThis, "URLSearchParams", {
      value: URLSearchParams,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
} catch {
  // Property might be read-only, that's okay if it already exists
}

// Also set on global for older Node.js compatibility
if (typeof global !== "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!global.URL || (global as any).URL !== URL) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).URL = URL;
    }
  } catch {
    // Ignore if read-only
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (
      !global.URLSearchParams ||
      (global as any).URLSearchParams !== URLSearchParams
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).URLSearchParams = URLSearchParams;
    }
  } catch {
    // Ignore if read-only
  }
}

// Ensure they're available on window for browser-like tests
if (typeof window !== "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!window.URL || (window as any).URL !== URL) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).URL = URL;
    }
  } catch {
    // Ignore if read-only
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (
      !window.URLSearchParams ||
      (window as any).URLSearchParams !== URLSearchParams
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).URLSearchParams = URLSearchParams;
    }
  } catch {
    // Ignore if read-only
  }
}
