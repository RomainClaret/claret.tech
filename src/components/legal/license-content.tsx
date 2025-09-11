"use client";

import { useState, useEffect } from "react";
import { logError } from "@/lib/utils/dev-logger";

export function LicenseContent() {
  const [licenseText, setLicenseText] = useState<string>("Loading license...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch LICENSE content from API
    fetch("/api/license")
      .then((response) => response.json())
      .then((data) => {
        if (data.content) {
          setLicenseText(data.content);
        } else {
          throw new Error("No license content received");
        }
      })
      .catch((error) => {
        logError(error, "LicenseContent.fetchLicense");
        setLicenseText(
          "Failed to load license content. Please visit the repository to view the full license.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 border-l-4 border-primary p-6 rounded-lg">
        <p className="text-foreground text-lg">
          🧬 Fork, evolve, and build upon this work freely
        </p>
      </div>
      <pre
        className={`whitespace-pre-wrap font-mono text-sm text-muted-foreground 
                    bg-muted/30 p-6 rounded-lg overflow-x-auto border border-border
                    ${isLoading ? "animate-pulse" : ""}`}
      >
        {licenseText}
      </pre>
    </div>
  );
}
