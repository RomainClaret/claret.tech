"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  ReactNode,
} from "react";
import { detectSafari } from "@/lib/utils/safari-detection";
import { useHydrated } from "@/lib/hooks/useHydrated";

const subscribeNever = () => () => {};

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
 * Whether this browser is Safari, for the components that hold their
 * animations back there.
 *
 * The HTML is generated once, at build time, for every browser, and it is
 * rendered as not Safari (the layout passes `initialSafari={false}`); so is
 * the render that hydrates it, which keeps the two identical. React then
 * renders the browser's own value at once (useSyncExternalStore), and an
 * effect marks <body data-safari>, which the stylesheets key on. Safari
 * therefore gets the animated version for that first render. (This said
 * the opposite, that the server rendered the Safari version, until
 * 2026-11-07.)
 */
interface SafariProviderProps {
  children: ReactNode;
  initialSafari?: boolean; // Safari state from server-side detection
}

export function SafariProvider({
  children,
  initialSafari,
}: SafariProviderProps) {
  // The value the HTML was rendered with while hydrating, so hydration
  // matches it: the homepage is generated once, at build time, for every
  // browser. Then the browser this really is. The head script has already
  // set <html data-safari> before the first paint (lib/boot/head-boot.ts);
  // detectSafari's user-agent test is the same one.
  const isSafari = useSyncExternalStore(
    subscribeNever,
    () => detectSafari().isSafari,
    () => initialSafari ?? false,
  );
  const isHydrated = useHydrated();

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
        shouldReduceAnimations, // False in the HTML; Safari's own value after
        isHydrated,
      }}
    >
      {children}
    </SafariContext.Provider>
  );
}
