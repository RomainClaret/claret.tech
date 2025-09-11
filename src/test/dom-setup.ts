/**
 * DOM Environment Setup for Test Isolation
 *
 * This module ensures proper DOM initialization for tests that require
 * DOM manipulation, especially in batch mode where tests run in parallel
 * or sequential isolation.
 */

import { vi } from "vitest";

// Ensure DOM is properly initialized
export function ensureDOMEnvironment() {
  if (typeof document === "undefined") {
    return; // Not in a DOM environment
  }

  // Ensure documentElement exists
  if (!document.documentElement) {
    const html = document.createElement("html");
    (document as any).documentElement = html;
  }

  // Ensure body exists and is attached
  if (!document.body) {
    document.body = document.createElement("body");
    if (document.documentElement && document.documentElement.appendChild) {
      document.documentElement.appendChild(document.body);
    }
  }

  // Ensure matchMedia for framer-motion
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  // Ensure navigator.clipboard for terminal tests
  if (typeof navigator !== "undefined" && !navigator.clipboard) {
    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(""),
        read: vi.fn(),
        write: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      },
    });
  }

  // Ensure btoa/atob for base64 encoding
  if (typeof window !== "undefined") {
    if (!window.btoa) {
      window.btoa = (str: string) => Buffer.from(str).toString("base64");
    }
    if (!window.atob) {
      window.atob = (str: string) => Buffer.from(str, "base64").toString();
    }
  }

  // Ensure canvas mock for animation tests
  const originalCreateElement = document.createElement.bind(document);
  if (!(document as any).__createElementMocked) {
    (document as any).__createElementMocked = true;
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === "canvas") {
        const canvas = originalCreateElement(tagName) as HTMLCanvasElement;
        canvas.getContext = vi.fn((type: string) => {
          if (type === "webgl2" || type === "webgl") {
            return {
              getExtension: vi.fn(() => null),
              getParameter: vi.fn(() => "Mock Renderer"),
            };
          }
          return null;
        }) as any;
        return canvas;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement;
  }
}

// Initialize immediately for module-level setup
ensureDOMEnvironment();
