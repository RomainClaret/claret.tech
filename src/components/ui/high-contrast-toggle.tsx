"use client";

import { useEffect, useState } from "react";
import { Contrast } from "lucide-react";
import { wantsHighContrast } from "@/lib/boot/head-boot";
import { writeStorage } from "@/lib/utils/safe-storage";

export function HighContrastToggle() {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    // The head script set the class before the first paint, from the
    // visitor's choice or else the system's preference; this settles the
    // button on the same answer. Guarded: where storage is blocked a read
    // threw in an effect, which takes the page down to the error boundary.
    const on = wantsHighContrast();
    setIsHighContrast(on);
    document.documentElement.classList.toggle("high-contrast", on);
  }, []);

  const toggleHighContrast = () => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);

    if (newValue) {
      document.documentElement.classList.add("high-contrast");
      writeStorage("local", "highContrast", "true");
    } else {
      document.documentElement.classList.remove("high-contrast");
      writeStorage("local", "highContrast", "false");
    }
  };

  return (
    <button
      onClick={toggleHighContrast}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
