"use client";

import { useEffect, useRef } from "react";

// Stands in for the splash while its code cannot be fetched (withLoadFallback
// in app-wrapper.tsx). It shows nothing, and once its own try has failed
// too, it completes as a finished splash does: AppWrapper then removes the
// backdrop and opens the terminal's gate. Before, the failed load reached the
// error boundary around the whole site, whose error screen replaced the page
// until a reload.
//
// The splash's own work goes with its chunk, and nothing waits on it:
// Projects fetches the full list when it is asked for, the providers detect
// the browser themselves, and on / the hero draws the grid's background.
// Only a route without the hero (the 404 page) keeps a bare grid.
export function SplashUnavailable({
  onComplete,
  retrying,
}: {
  onComplete?: () => void;
  retrying: boolean;
}) {
  // Once: a new callback on a re-render would otherwise complete it again.
  const completed = useRef(false);
  useEffect(() => {
    if (retrying || completed.current) return;
    completed.current = true;
    onComplete?.();
  }, [retrying, onComplete]);

  return null;
}
