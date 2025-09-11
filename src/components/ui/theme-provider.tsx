"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Theme, setTheme as setCookieTheme } from "@/lib/theme-cookie";
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
  initialTheme: Theme;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

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

  useEffect(() => {
    // Apply theme on mount and when it changes
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    // Sync with localStorage on mount only
    try {
      const storedTheme = localStorage.getItem("theme") as Theme;
      if (storedTheme && (storedTheme === "light" || storedTheme === "dark")) {
        // If localStorage has a valid theme different from initial, use it
        if (storedTheme !== theme) {
          setTheme(storedTheme);
        }
      }
    } catch {
      // Only log in non-test environments to avoid test stderr pollution
      if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
        logWarning(
          "Failed to read theme from localStorage",
          "theme-provider-read",
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run once on mount to avoid overwriting user preference
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
