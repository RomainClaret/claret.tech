"use client";

import React, { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";

interface ProtectedLucideIconProps {
  Icon: LucideIcon;
  className?: string;
  size?: number;
  strokeWidth?: number;
  fallbackRadius?: string;
  [key: string]: unknown;
}

/**
 * Protected wrapper for Lucide icons to prevent undefined radius errors
 * Specifically targets SVG circle elements within Lucide icons
 */
export function ProtectedLucideIcon({
  Icon,
  className = "",
  size = 24,
  strokeWidth = 2,
  fallbackRadius = "4",
  ...props
}: ProtectedLucideIconProps) {
  const iconRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!iconRef.current) return;

    // Function to validate and fix circle radius in this specific icon
    const protectIcon = () => {
      if (!iconRef.current) return;

      try {
        const circles = iconRef.current.querySelectorAll("circle");
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
            currentRadius === "null" ||
            isNaN(parseFloat(currentRadius))
          ) {
            circle.setAttribute("r", fallbackRadius);
            fixedCount++;
          }
        });

        return fixedCount;
      } catch {
        return 0;
      }
    };

    // Protect immediately after render
    const timeoutId = setTimeout(protectIcon, 0);

    // Set up mutation observer for this specific icon
    const observer = new MutationObserver((mutations) => {
      let needsProtection = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "childList" || mutation.type === "attributes") {
          needsProtection = true;
        }
      });

      if (needsProtection) {
        setTimeout(protectIcon, 0);
      }
    });

    observer.observe(iconRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["r"],
    });

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [Icon, fallbackRadius]);

  return (
    <Icon
      ref={iconRef}
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}

// Hook to wrap any Lucide icon with protection
export function useProtectedLucideIcon() {
  return React.useCallback(
    (Icon: LucideIcon, props: Omit<ProtectedLucideIconProps, "Icon"> = {}) => {
      return <ProtectedLucideIcon Icon={Icon} {...props} />;
    },
    [],
  );
}
