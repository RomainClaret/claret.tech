"use client";

import { useEffect } from "react";
import { logError } from "@/lib/utils/dev-logger";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then(() => {})
          .catch((error) => {
            logError(error, "service-worker-registration");
          });
      });
    } else {
      // Dev: a production service worker from a previous local build test
      // stays registered on localhost and keeps serving cached responses to
      // the dev site. Remove any such leftover.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        })
        .catch((error) => {
          logError(error, "service-worker-unregistration");
        });
    }
  }, []);

  return null;
}
