/**
 * Centralized Safari detection utility
 * Provides two layers of detection: localStorage -> user agent. (A cookie
 * the middleware set came between them until the homepage was generated at
 * build time; the head script, lib/boot/head-boot.ts, now settles the
 * browser before the first paint.)
 */

import { logWarning } from "@/lib/utils/dev-logger";
import { isSafariUserAgent } from "@/lib/boot/head-boot";

const BROWSER_DETECTION_KEY = "browser-detection";
const ANIMATION_STORAGE_KEY = "background-animations-state";

export interface BrowserDetection {
  isSafari: boolean;
  source: "localStorage" | "cookie" | "userAgent" | "default";
  timestamp: number;
}

export interface AnimationPreference {
  value: boolean;
  browser: "safari" | "other";
  isUserPreference: boolean; // true = user explicitly changed, false = browser default
  timestamp: number;
}

/**
 * Get Safari detection from localStorage (most reliable, set by splash screen)
 */
function getSafariFromLocalStorage(): BrowserDetection | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(BROWSER_DETECTION_KEY);
    if (stored) {
      const detection = JSON.parse(stored) as BrowserDetection;
      // Check if detection is less than 24 hours old
      if (Date.now() - detection.timestamp < 24 * 60 * 60 * 1000) {
        return detection;
      }
    }
  } catch {
    logWarning(
      "Failed to read browser detection from localStorage",
      "Safari Detection",
    );
  }

  return null;
}

/**
 * Get Safari detection from user agent (fallback): the same test as the
 * head script's, which settles the browser before the first paint.
 */
function getSafariFromUserAgent(): BrowserDetection {
  if (typeof window === "undefined") {
    return {
      isSafari: false,
      source: "default",
      timestamp: Date.now(),
    };
  }

  return {
    isSafari: isSafariUserAgent(window.navigator.userAgent),
    source: "userAgent",
    timestamp: Date.now(),
  };
}

/**
 * Detect Safari using two sources, in this order:
 * 1. localStorage (from splash screen) - most persistent
 * 2. user agent - final fallback
 */
export function detectSafari(): BrowserDetection {
  // Try localStorage first (most reliable if available)
  const localStorageDetection = getSafariFromLocalStorage();
  if (localStorageDetection) {
    return localStorageDetection;
  }

  // Fall back to user agent detection
  return getSafariFromUserAgent();
}

/**
 * Store Safari detection in localStorage for persistence
 * Called by splash screen after detection
 */
export function storeSafariDetection(
  isSafari: boolean,
  source: BrowserDetection["source"],
): void {
  if (typeof window === "undefined") return;

  const detection: BrowserDetection = {
    isSafari,
    source,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(BROWSER_DETECTION_KEY, JSON.stringify(detection));
  } catch {
    logWarning("Failed to store browser detection", "Safari Detection");
  }
}

/**
 * Get animation preference with browser awareness
 */
export function getAnimationPreference(): AnimationPreference | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(ANIMATION_STORAGE_KEY);
    if (stored) {
      // Try to parse as new format
      const parsed = JSON.parse(stored);
      if (typeof parsed === "object" && parsed.browser !== undefined) {
        return parsed as AnimationPreference;
      }

      // Handle legacy boolean format
      return {
        value: parsed as boolean,
        browser: "other", // Unknown browser for legacy data
        isUserPreference: true, // Assume legacy data is user preference
        timestamp: Date.now(),
      };
    }
  } catch {
    logWarning("Failed to read animation preference", "Safari Detection");
  }

  return null;
}

/**
 * Store animation preference with browser context
 */
export function storeAnimationPreference(
  value: boolean,
  isSafari: boolean,
  isUserPreference: boolean = false,
): void {
  if (typeof window === "undefined") return;

  const preference: AnimationPreference = {
    value,
    browser: isSafari ? "safari" : "other",
    isUserPreference,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(ANIMATION_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    logWarning("Failed to store animation preference", "Safari Detection");
  }
}

/**
 * Clear animation preference (for browser changes or testing)
 */
export function clearAnimationPreference(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(ANIMATION_STORAGE_KEY);
  } catch {
    logWarning("Failed to clear animation preference", "Safari Detection");
  }
}

/**
 * Check if animation preference should be reset due to browser change
 */
export function shouldResetAnimationPreference(
  currentIsSafari: boolean,
): boolean {
  const preference = getAnimationPreference();
  if (!preference) return false;

  const currentBrowser = currentIsSafari ? "safari" : "other";
  const storedBrowser = preference.browser;

  if (currentBrowser !== storedBrowser) {
    return true;
  }

  return false;
}
