"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { detectSafari } from "@/lib/utils/safari-detection";

interface SafariContextType {
  isSafari: boolean;
  shouldReduceAnimations: boolean;
  isHydrated: boolean; // To prevent hydration mismatch
}

const SafariContext = createContext<SafariContextType>({
  isSafari: false, // Will be set by provider
  shouldReduceAnimations: false,
  isHydrated: false,
});

export function useSafariContext() {
  return useContext(SafariContext);
}

/**
 * SafariProvider that handles SSR hydration mismatch properly
 *
 * REVERSED STRATEGY for Safari performance:
 * 1. During SSR: Always render SAFARI version (static, no animations)
 * 2. After hydration: Only enable animations if NOT Safari
 * 3. This ensures Safari NEVER sees animations, even briefly
 */
interface SafariProviderProps {
  children: ReactNode;
  initialSafari?: boolean; // Safari state from server-side detection
}

export function SafariProvider({
  children,
  initialSafari,
}: SafariProviderProps) {
  // Use server-provided Safari state for consistent server/client rendering
  const [isSafari, setIsSafari] = useState(() => {
    // Use server-provided value if available, otherwise detect on client
    if (initialSafari !== undefined) {
      return initialSafari;
    }

    // Fallback to client detection (should only happen in edge cases)
    if (typeof window !== "undefined") {
      const detection = detectSafari();
      return detection.isSafari;
    }

    return false; // Default for SSR
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated and set up DOM attributes
    setIsHydrated(true);

    // Add data attribute to body for CSS targeting
    document.body.setAttribute("data-safari", isSafari.toString());

    // Enable/disable animations based on Safari detection
    if (isSafari) {
      document.body.classList.remove("enable-animations");
    } else {
      document.body.classList.add("enable-animations");
    }

    // Optional: Update detection if localStorage has newer info
    if (typeof window !== "undefined") {
      const detection = detectSafari();
      if (
        detection.isSafari !== isSafari &&
        detection.source === "localStorage"
      ) {
        setIsSafari(detection.isSafari);
        document.body.setAttribute(
          "data-safari",
          detection.isSafari.toString(),
        );

        if (detection.isSafari) {
          document.body.classList.remove("enable-animations");
        } else {
          document.body.classList.add("enable-animations");
        }
      }
    }
  }, [isSafari, initialSafari]);

  // Only reduce animations for confirmed Safari browsers
  const shouldReduceAnimations = isSafari;

  return (
    <SafariContext.Provider
      value={{
        isSafari: isSafari, // Always report actual Safari status
        shouldReduceAnimations, // True until we confirm it's NOT Safari
        isHydrated,
      }}
    >
      {children}
    </SafariContext.Provider>
  );
}
