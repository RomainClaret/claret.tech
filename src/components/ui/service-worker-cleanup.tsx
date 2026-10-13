"use client";

import { useEffect } from "react";
import { logError } from "@/lib/utils/dev-logger";

/** The site's own caches. WebLLM keeps the AI terminal's model in others. */
const isSiteCache = (name: string) => name.startsWith("claret-tech-");

/**
 * Removes the site's retired service worker, and its caches, from a browser
 * that still has them.
 *
 * The worker served /images, /fonts and /animations cache-first, which the
 * HTTP cache already keeps for a year as immutable, and this component used
 * to register it on the window "load" event, from an effect: an effect
 * that runs after "load" never sees it, so on the static homepage it never
 * registered (0 registrations in Chromium and WebKit, throttled or not).
 * Browsers that registered it when hydration did beat "load" still run it.
 * Here it goes on any visit with scripts; public/sw.js removes itself on
 * the browser's next update check too.
 *
 * Only the site's own: the worker at /sw.js (on localhost, other projects'
 * workers can share the origin) and the claret-tech-* caches (Cache Storage
 * belongs to the whole origin, and WebLLM's model is about 1 GB).
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations
              .filter((registration) =>
                [
                  registration.active,
                  registration.waiting,
                  registration.installing,
                ].some(
                  (worker) =>
                    worker && new URL(worker.scriptURL).pathname === "/sw.js",
                ),
              )
              .map((registration) => registration.unregister()),
          ),
        )
        .catch((error) => logError(error, "service-worker-cleanup"));
    }
    if ("caches" in window) {
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names.filter(isSiteCache).map((name) => caches.delete(name)),
          ),
        )
        .catch((error) => logError(error, "service-worker-cache-cleanup"));
    }
  }, []);

  return null;
}
