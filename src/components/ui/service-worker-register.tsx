"use client";

import { useEffect } from "react";
import { logError } from "@/lib/utils/dev-logger";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then(() => {})
          .catch((error) => {
            logError(error, "service-worker-registration");
          });
      });
    }
  }, []);

  return null;
}
