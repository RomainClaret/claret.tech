"use client";

import { useEffect } from "react";

// The classic Konami code sequence.
const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

// Calls onUnlock when the Konami code is typed. Observes keydown only; it never
// preventDefaults, so it coexists with other keyboard handlers.
export function useKonamiCode(onUnlock: () => void): void {
  useEffect(() => {
    let index = 0;
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === KONAMI[index]) {
        index += 1;
        if (index === KONAMI.length) {
          index = 0;
          onUnlock();
        }
      } else {
        // Wrong key: restart, but let it seed a fresh sequence if it's the first.
        index = key === KONAMI[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onUnlock]);
}
