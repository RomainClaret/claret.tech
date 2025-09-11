/**
 * Centralized Safari detection utility
 * Provides multiple layers of detection: localStorage -> cookie -> user agent
 * Ensures Safari is detected immediately without animation flash
 */

import { logWarning } from "@/lib/utils/dev-logger";

const BROWSER_DETECTION_KEY = "browser-detection";
const SAFARI_COOKIE_KEY = "safari-detected";
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
 * Get Safari detection from cookie (set by middleware)
 */
function getSafariFromCookie(): BrowserDetection | null {
  if (typeof document === "undefined") {
    // During SSR, we need to parse from request headers
    // This will be handled by the context providers
    return null;
  }

  try {
    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${SAFARI_COOKIE_KEY}=`))
      ?.split("=")[1];

    if (cookieValue !== undefined) {
      return {
        isSafari: cookieValue === "true",
        source: "cookie",
        timestamp: Date.now(),
      };
    }
  } catch {
    logWarning("Failed to read Safari cookie", "Safari Detection");
  }

  return null;
}

/**
 * Get Safari detection from user agent (fallback)
 */
function getSafariFromUserAgent(): BrowserDetection {
  if (typeof window === "undefined") {
    return {
      isSafari: false,
      source: "default",
      timestamp: Date.now(),
    };
  }

  const userAgent = window.navigator.userAgent;

  // Use same detection logic as middleware
  const hasSafari = userAgent.includes("Safari");
  const hasChrome =
    userAgent.includes("Chrome") || userAgent.includes("Chromium");
  const hasEdge = userAgent.includes("Edge") || userAgent.includes("Edg/");
  const hasChromeOnIOS = userAgent.includes("CriOS"); // Chrome on iOS
  const hasFirefoxOnIOS = userAgent.includes("FxiOS"); // Firefox on iOS
  const hasSafariVersion = userAgent.includes("Version/"); // Safari-specific

  // True Safari: has Safari + Version/, but no Chrome/Chromium/Edge
  const isSafari =
    hasSafari &&
    hasSafariVersion &&
    !hasChrome &&
    !hasEdge &&
    !hasChromeOnIOS &&
    !hasFirefoxOnIOS;

  return {
    isSafari,
    source: "userAgent",
    timestamp: Date.now(),
  };
}

/**
 * Detect Safari using multiple sources with priority:
 * 1. localStorage (from splash screen) - most persistent
 * 2. cookie (from middleware) - server-side detection
 * 3. user agent - final fallback
 */
export function detectSafari(): BrowserDetection {
  // Try localStorage first (most reliable if available)
  const localStorageDetection = getSafariFromLocalStorage();
  if (localStorageDetection) {
    return localStorageDetection;
  }

  // Try cookie second (works during SSR)
  const cookieDetection = getSafariFromCookie();
  if (cookieDetection) {
    return cookieDetection;
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
 * Parse Safari cookie value from cookie string (for SSR)
 */
export function parseSafariFromCookieString(cookieString: string): boolean {
  if (!cookieString) return false;

  try {
    const cookies = cookieString.split(";");
    const safariCookie = cookies
      .find((cookie) => cookie.trim().startsWith(`${SAFARI_COOKIE_KEY}=`))
      ?.split("=")[1]
      ?.trim();

    return safariCookie === "true";
  } catch {
    logWarning("Failed to parse Safari from cookie string", "Safari Detection");
    return false;
  }
}

/**
 * Get Safari detection from Next.js cookies() (for server components)
 * Includes fallback to user agent parsing when cookies are not available
 */
export function getSafariFromNextCookies(cookieStore: {
  get: (key: string) => { value?: string } | undefined;
}): boolean {
  if (!cookieStore) return false;

  try {
    const safariCookie = cookieStore.get(SAFARI_COOKIE_KEY);

    if (safariCookie?.value !== undefined) {
      const isSafari = safariCookie.value === "true";
      return isSafari;
    }

    // Fallback: If no cookie (middleware didn't run), assume Safari for safety
    // This ensures Safari users never get animations, even if middleware fails

    return true; // Default to Safari = safe mode (no animations)
  } catch {
    logWarning(
      "Failed to read Safari from Next.js cookies",
      "Safari Detection",
    );
    // On error, assume Safari for safety
    return true;
  }
}

/**
 * Quick Safari check (uses detection cache if available)
 */
export function isSafari(): boolean {
  return detectSafari().isSafari;
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

/**
 * Clear stored browser detection (for testing/debugging)
 */
export function clearBrowserDetection(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(BROWSER_DETECTION_KEY);
  } catch {
    logWarning("Failed to clear browser detection", "Safari Detection");
  }
}
