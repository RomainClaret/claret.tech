"use client";

import React, { useEffect, ReactNode } from "react";
import { logWarning, logError } from "@/lib/utils/dev-logger";

interface SVGProtectionWrapperProps {
  children: ReactNode;
  fallbackRadius?: string;
}

/**
 * Global SVG Protection Wrapper
 *
 * This component provides multiple layers of protection against undefined radius values:
 * 1. DOM Mutation Observer to catch dynamic changes
 * 2. Recursive validation of all circle elements
 * 3. Automatic fallback injection for problematic elements
 */
export function SVGProtectionWrapper({
  children,
  fallbackRadius = "4",
}: SVGProtectionWrapperProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Function to validate and fix circle radius attributes
    const validateAndFixCircles = (
      element: Element = document.documentElement,
    ) => {
      try {
        // Find all circle elements
        const circles = element.querySelectorAll("circle");
        let fixedCount = 0;

        circles.forEach((circle) => {
          const currentRadius = circle.getAttribute("r");

          // Check for problematic radius values
          if (
            currentRadius === null ||
            currentRadius === undefined ||
            currentRadius === "undefined" ||
            currentRadius === "NaN" ||
            currentRadius === "" ||
            currentRadius === "null"
          ) {
            // Apply fallback radius
            circle.setAttribute("r", fallbackRadius);
            fixedCount++;

            if (process.env.NODE_ENV === "development") {
              logWarning(
                "🛡️ SVG Protection: Fixed circle with invalid radius",
                "svg-protection-wrapper-fix",
              );
            }
          }
        });

        return fixedCount;
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          logError(error, "svg-protection-wrapper-error");
        }
        return 0;
      }
    };

    // Initial validation run
    const initialCheck = () => {
      validateAndFixCircles();
    };

    // Run initial check after a short delay to catch SSR/hydration issues
    setTimeout(initialCheck, 100);

    // Set up mutation observer to catch dynamic changes
    const observer = new MutationObserver((mutations) => {
      let needsValidation = false;

      mutations.forEach((mutation) => {
        // Check if new nodes were added
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Check if it's an SVG or contains SVG elements
              if (
                element.tagName === "circle" ||
                element.tagName === "svg" ||
                element.querySelector("circle")
              ) {
                needsValidation = true;
              }
            }
          });
        }

        // Check if attributes were modified
        if (
          mutation.type === "attributes" &&
          mutation.target.nodeType === Node.ELEMENT_NODE
        ) {
          const element = mutation.target as Element;
          if (element.tagName === "circle" && mutation.attributeName === "r") {
            needsValidation = true;
          }
        }
      });

      if (needsValidation) {
        // Small delay to allow React to finish rendering
        setTimeout(() => {
          validateAndFixCircles();
        }, 10);
      }
    });

    // Start observing
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["r"], // Only watch radius changes
    });

    // Additional safety net: periodic validation
    const intervalId = setInterval(() => {
      validateAndFixCircles();
    }, 5000); // Check every 5 seconds

    // Cleanup function
    return () => {
      observer.disconnect();
      clearInterval(intervalId);
    };
  }, [fallbackRadius]);

  // Render children normally - protection happens via effects
  return <>{children}</>;
}

// Hook for manual validation trigger
export const useSVGProtection = (fallbackRadius = "4") => {
  const validateCircles = React.useCallback(() => {
    if (typeof window === "undefined") return 0;

    const circles = document.querySelectorAll("circle");
    let fixedCount = 0;

    circles.forEach((circle) => {
      const currentRadius = circle.getAttribute("r");

      if (
        currentRadius === null ||
        currentRadius === undefined ||
        currentRadius === "undefined" ||
        currentRadius === "NaN" ||
        currentRadius === "" ||
        currentRadius === "null"
      ) {
        circle.setAttribute("r", fallbackRadius);
        fixedCount++;
      }
    });

    return fixedCount;
  }, [fallbackRadius]);

  return { validateCircles };
};
