"use client";

import { useEffect, useState } from "react";
import { Contrast } from "lucide-react";

export function HighContrastToggle() {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    // Check localStorage on mount
    const savedHighContrast = localStorage.getItem("highContrast") === "true";
    setIsHighContrast(savedHighContrast);

    if (savedHighContrast) {
      document.documentElement.classList.add("high-contrast");
    }
  }, []);

  const toggleHighContrast = () => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);

    if (newValue) {
      document.documentElement.classList.add("high-contrast");
      localStorage.setItem("highContrast", "true");
    } else {
      document.documentElement.classList.remove("high-contrast");
      localStorage.setItem("highContrast", "false");
    }
  };

  return (
    <button
      onClick={toggleHighContrast}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Toggle high contrast mode (currently ${isHighContrast ? "on" : "off"})`}
      aria-pressed={isHighContrast}
      aria-describedby="high-contrast-desc"
    >
      <span id="high-contrast-desc" className="sr-only">
        High contrast mode improves visibility for users who need stronger
        visual distinctions
      </span>
      <Contrast
        className={`h-5 w-5 transition-colors ${
          isHighContrast ? "text-primary" : "text-muted-foreground"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}
