"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Theme, setTheme as setCookieTheme } from "@/lib/theme-cookie";
import { readStoredTheme } from "@/lib/boot/head-boot";
import { logWarning } from "@/lib/utils/dev-logger";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  /** The theme the HTML was rendered with; hydration starts from it. */
  initialTheme?: Theme;
}

export function ThemeProvider({
  children,
  initialTheme = "light",
}: ThemeProviderProps) {
  // The visitor's theme is on <html> before the first paint (the head script,
  // lib/boot/head-boot.ts); the state starts from the HTML's and follows on
  // mount.
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const appliedOnMountRef = useRef(false);

  const setTheme = (newTheme: Theme) => {
    setCookieTheme(newTheme);
    setThemeState(newTheme);

    // Also store in localStorage as fallback
    try {
      localStorage.setItem("theme", newTheme);
    } catch {
      logWarning("Failed to save theme to localStorage", "theme-provider-save");
    }

    // Apply theme immediately
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(newTheme);
  };

  // On mount: the stored theme, applied to <html> at once, then to the state.
  // Applying the state first would strip the class the head script set,
  // for a frame, whenever the stored theme is not the HTML's.
  useEffect(() => {
    const sync = () => {
      const stored = readStoredTheme(initialTheme);
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(stored);
      setThemeState(stored);
    };
    sync();
    // A page restored from the back/forward cache keeps the theme it was
    // left with, and another page may have changed it since.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) sync();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  // Then the state's own changes.
  useEffect(() => {
    if (!appliedOnMountRef.current) {
      appliedOnMountRef.current = true;
      return;
    }
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
