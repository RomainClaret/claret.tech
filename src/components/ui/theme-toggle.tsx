"use client";

import { useTheme } from "@/components/ui/theme-provider";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      data-testid="theme-toggle"
    >
      {/* The name and the icon, both twice, picked by the class the head
          script put on <html> before the first paint: React's theme state
          settles only after hydration. A hidden name is not spoken. */}
      <span className="sr-only dark:hidden">Toggle theme (current: light)</span>
      <span className="sr-only hidden dark:inline">
        Toggle theme (current: dark)
      </span>
      <Sun className="h-5 w-5 dark:hidden" aria-hidden="true" />
      <Moon className="hidden h-5 w-5 dark:block" aria-hidden="true" />
    </button>
  );
}
