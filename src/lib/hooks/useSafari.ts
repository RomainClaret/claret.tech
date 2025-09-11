"use client";

import { useSafariContext } from "@/contexts/safari-context";
import { detectBrowser, type BrowserInfo } from "@/lib/utils/browser-detection";

/**
 * Hook to detect Safari browser and provide performance-related information
 * Safari has significantly worse performance with certain CSS features like backdrop-filter,
 * complex animations, and multiple blur effects.
 *
 * IMPORTANT: Now uses SafariContext to prevent SSR hydration mismatch
 */
export function useSafari(): BrowserInfo {
  const { isSafari, shouldReduceAnimations, isHydrated } = useSafariContext();

  // Fallback to legacy detection if context is not available
  const fallbackInfo = detectBrowser();

  // During SSR or before hydration, return safe fallback (assume Safari)
  if (!isHydrated) {
    return {
      isSafari: true, // Assume Safari until proven otherwise
      isChrome: false,
      isFirefox: false,
      isEdge: false,
      userAgent: "",
      shouldReduceAnimations: true, // Start with animations disabled
    };
  }

  return {
    isSafari,
    isChrome: fallbackInfo.isChrome,
    isFirefox: fallbackInfo.isFirefox,
    isEdge: fallbackInfo.isEdge,
    userAgent: fallbackInfo.userAgent,
    shouldReduceAnimations,
  };
}

/**
 * Simple hook that only returns whether the browser is Safari
 * Useful for quick checks in components
 */
export function useIsSafari(): boolean {
  const { isSafari } = useSafari();
  return isSafari;
}

/**
 * Hook to determine if animations should be reduced for performance
 * Currently only reduces animations on Safari, but could be extended
 * to include other factors like battery level, device performance, etc.
 */
export function useShouldReduceAnimations(): boolean {
  const { shouldReduceAnimations } = useSafariContext();
  return shouldReduceAnimations;
}
