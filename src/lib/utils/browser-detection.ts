/**
 * Browser detection utilities for immediate, synchronous detection
 * Used to prevent race conditions in Safari performance optimizations
 */

import { isSafari as detectIsSafari } from "./safari-detection";

// Flag to prevent repeated console logging
let hasLoggedBrowserDetection = false;

export interface BrowserInfo {
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  userAgent: string;
  shouldReduceAnimations: boolean;
}

/**
 * Get Safari detection from cookie (for SSR compatibility)
 */
function getSafariFromCookie(): boolean {
  if (typeof document === "undefined") return false;

  const cookieValue = document.cookie
    .split("; ")
    .find((row) => row.startsWith("safari-detected="))
    ?.split("=")[1];

  return cookieValue === "true";
}

/**
 * Synchronously detect browser information
 * This prevents the race condition where Safari detection starts as false
 * Now SSR-compatible using cookies from middleware
 */
export function detectBrowser(): BrowserInfo {
  // Server-side: Try to get Safari detection from cookie
  if (typeof window === "undefined") {
    // During SSR, we can't access cookies directly, so assume non-Safari
    // The client will hydrate with the correct Safari state
    return {
      isSafari: false,
      isChrome: false,
      isFirefox: false,
      isEdge: false,
      userAgent: "",
      shouldReduceAnimations: false,
    };
  }

  const userAgent = window.navigator.userAgent;

  // First, try to get Safari detection from cookie (set by middleware)
  const cookieSafari = getSafariFromCookie();

  // Detect Safari from user agent (but not Chrome, which also contains "Safari" in userAgent)
  const userAgentSafari =
    userAgent.includes("Safari") && !userAgent.includes("Chrome");

  // Use cookie if available, otherwise fall back to user agent detection
  const isSafari = cookieSafari || userAgentSafari;

  // Detect other browsers
  const isChrome = userAgent.includes("Chrome") && !userAgent.includes("Edg");
  const isFirefox = userAgent.includes("Firefox");
  const isEdge = userAgent.includes("Edg");

  // Safari should reduce animations due to performance issues
  const shouldReduceAnimations = isSafari;

  const browserInfo = {
    isSafari,
    isChrome,
    isFirefox,
    isEdge,
    userAgent,
    shouldReduceAnimations,
  };

  if (!hasLoggedBrowserDetection) {
    hasLoggedBrowserDetection = true;
  }

  return browserInfo;
}

/**
 * Check if the current browser is Safari
 * Useful for quick checks in components
 * Re-exported from safari-detection for consistency
 */
export const isSafari = detectIsSafari;

/**
 * Check if animations should be reduced for performance
 * Currently only reduces animations on Safari, but could be extended
 * to include other factors like battery level, device performance, etc.
 */
export function shouldReduceAnimations(): boolean {
  return detectBrowser().shouldReduceAnimations;
}
