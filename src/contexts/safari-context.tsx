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
  // The value the HTML was rendered with, so hydration matches it: the
  // homepage is generated once, at build time, for every browser. The
  // browser itself is known on the client only, and settled after mount.
  const [isSafari, setIsSafari] = useState(initialSafari ?? false);
  const [isHydrated, setIsHydrated] = useState(false);

  // After mount: the browser this really is. The head script has already
  // set <html data-safari> before the first paint (lib/boot/head-boot.ts);
  // detectSafari's user-agent test is the same one.
  useEffect(() => {
    setIsHydrated(true);
    const detected = detectSafari().isSafari;
    if (detected !== isSafari) setIsSafari(detected);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  // CSS targets <body data-safari> and .enable-animations on <body>.
  useEffect(() => {
    document.body.setAttribute("data-safari", isSafari.toString());
    if (isSafari) {
      document.body.classList.remove("enable-animations");
    } else {
      document.body.classList.add("enable-animations");
    }
  }, [isSafari]);

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
