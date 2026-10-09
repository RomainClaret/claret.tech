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
 * 1. A MutationObserver that validates circles as they are inserted
 * 2. A periodic validation of every circle on the page
 * 3. Automatic fallback injection for problematic elements
 *
 * Writes to `r` are not watched here: every one, from React or from
 * framer-motion, goes through the Element.prototype.setAttribute guard in
 * layout.tsx, which replaces a bad value before it reaches the DOM. Watching
 * the attribute as well made a framer `r` animation (the constellation pulses)
 * queue a whole-document circle scan on every frame.
 */
export function SVGProtectionWrapper({
  children,
  fallbackRadius = "4",
}: SVGProtectionWrapperProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Function to validate and fix circle radius attributes, in one subtree
    // (including the root itself when it is a circle)
    const validateAndFixCircles = (
      element: Element = document.documentElement,
    ) => {
      try {
        const circles: Element[] = Array.from(
          element.querySelectorAll("circle"),
        );
        if (element.tagName === "circle") circles.push(element);
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
    const initialTimer = setTimeout(initialCheck, 100);

    // Validate inserted subtrees only, batched into one check per burst of
    // mutations rather than a whole-document scan for each.
    let pendingRoots: Element[] = [];
    let pendingTimer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const element = node as Element;
          // Check if it's an SVG or contains SVG elements
          if (
            element.tagName === "circle" ||
            element.tagName === "svg" ||
            element.querySelector("circle")
          ) {
            pendingRoots.push(element);
          }
        });
      });

      if (pendingRoots.length > 0 && pendingTimer === undefined) {
        // Small delay to allow React to finish rendering
        pendingTimer = setTimeout(() => {
          pendingTimer = undefined;
          const roots = pendingRoots;
          pendingRoots = [];
          roots.forEach((root) => {
            if (root.isConnected) validateAndFixCircles(root);
          });
        }, 10);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Safety net for what the observer cannot see, such as an `r` removed
    // outright. Skipped while the tab is hidden.
    const intervalId = setInterval(() => {
      if (!document.hidden) validateAndFixCircles();
    }, 5000); // Check every 5 seconds

    // Cleanup function
    return () => {
      observer.disconnect();
      clearTimeout(initialTimer);
      if (pendingTimer !== undefined) clearTimeout(pendingTimer);
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
