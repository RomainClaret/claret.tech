"use client";

import { useEffect, useState } from "react";

/**
 * Custom hook to detect if the user prefers reduced motion
 * @returns {boolean} true if the user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window === "undefined") return;

    // Create media query
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Handler for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    // Fallback for older browsers
    else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return prefersReducedMotion;
}

/**
 * Get animation duration based on motion preference
 * @param normalDuration - Duration in ms when motion is allowed
 * @param reducedDuration - Duration in ms when motion is reduced (default: 0)
 * @returns {number} Appropriate duration based on user preference
 */
export function getMotionSafeDuration(
  normalDuration: number,
  reducedDuration: number = 0,
): number {
  if (typeof window === "undefined") return normalDuration;

  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  return mediaQuery.matches ? reducedDuration : normalDuration;
}

/**
 * Configuration for motion-safe animations
 */
export const MOTION_SAFE_CONFIG = {
  // Transitions
  transition: {
    normal: "all 0.3s ease",
    reduced: "none",
  },
  // Animation durations
  duration: {
    fast: { normal: 200, reduced: 0 },
    medium: { normal: 300, reduced: 0 },
    slow: { normal: 600, reduced: 0 },
  },
  // Spring animations
  spring: {
    normal: { stiffness: 100, damping: 10 },
    reduced: { stiffness: 300, damping: 30 }, // Faster, less bouncy
  },
} as const;
