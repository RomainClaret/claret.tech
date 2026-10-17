// URL and URLSearchParams from Node for the jsdom test environment
// This file MUST be loaded before any other imports

import { URL, URLSearchParams } from "url";

// Force polyfill installation with proper type handling
// Check if URL needs to be polyfilled (safely handle read-only properties)
try {
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
    if (!global.URL || (global as any).URL !== URL) {
      (global as any).URL = URL;
    }
  } catch {
    // Ignore if read-only
  }

  try {
    if (
      !global.URLSearchParams ||
      (global as any).URLSearchParams !== URLSearchParams
    ) {
      (global as any).URLSearchParams = URLSearchParams;
    }
  } catch {
    // Ignore if read-only
  }
}

// Ensure they're available on window for browser-like tests
if (typeof window !== "undefined") {
  try {
    if (!window.URL || (window as any).URL !== URL) {
      (window as any).URL = URL;
    }
  } catch {
    // Ignore if read-only
  }

  try {
    if (
      !window.URLSearchParams ||
      (window as any).URLSearchParams !== URLSearchParams
    ) {
      (window as any).URLSearchParams = URLSearchParams;
    }
  } catch {
    // Ignore if read-only
  }
}
