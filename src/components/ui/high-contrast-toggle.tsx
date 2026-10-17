"use client";

import { useSyncExternalStore } from "react";
import { Contrast } from "lucide-react";
import { writeStorage } from "@/lib/utils/safe-storage";
import { useHydrated } from "@/lib/hooks/useHydrated";

// The class on <html> is the state: the head script (lib/boot/head-boot.ts)
// sets it before the first paint, from the visitor's choice or else the
// system's preference, and the button flips it. Off in the server's HTML and
// while hydrating, then the class's.
const listeners = new Set<() => void>();
const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
const isOn = () => document.documentElement.classList.contains("high-contrast");

export function HighContrastToggle() {
  const isHighContrast = useSyncExternalStore(subscribe, isOn, () => false);
  const hydrated = useHydrated();

  const toggleHighContrast = () => {
    const on = !isOn();
    document.documentElement.classList.toggle("high-contrast", on);
    // Guarded: where storage is blocked, the choice lasts this page view.
    writeStorage("local", "highContrast", on ? "true" : "false");
    listeners.forEach((listener) => listener());
  };

  return (
    <button
      onClick={toggleHighContrast}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      // Until hydration the state above is the server's "off": no pressed
      // state then, rather than a wrong one beside the name below.
      aria-pressed={hydrated ? isHighContrast : undefined}
      aria-describedby="high-contrast-desc"
    >
      {/* The name, picked by the class on <html> from the first paint, as
          the icon's colour is. The description is hidden so it stays out
          of the name; aria-describedby reads it all the same. */}
      <span className="sr-only [.high-contrast_&]:hidden">
        Toggle high contrast mode (currently off)
      </span>
      <span className="sr-only hidden [.high-contrast_&]:inline">
        Toggle high contrast mode (currently on)
      </span>
      <span id="high-contrast-desc" hidden>
        High contrast mode improves visibility for users who need stronger
        visual distinctions
      </span>
      <Contrast
        className="h-5 w-5 text-muted-foreground transition-colors [.high-contrast_&]:text-primary"
        aria-hidden="true"
      />
    </button>
  );
}
