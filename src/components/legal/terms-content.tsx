"use client";

import { useState, useEffect } from "react";
import { logError } from "@/lib/utils/dev-logger";

export function TermsContent() {
  const [termsHtml, setTermsHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const DEFAULT_MARKDOWN_CLASS =
    "prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h2:text-xl prose-h2:font-semibold prose-h2:mb-4 prose-h2:mt-8 prose-p:text-muted-foreground prose-p:mb-4 prose-p:leading-relaxed prose-ul:text-muted-foreground prose-ul:space-y-2 prose-ul:mb-4 prose-li:list-disc prose-li:list-inside prose-ol:text-muted-foreground prose-ol:space-y-2 prose-ol:mb-4 prose-a:text-primary prose-a:hover:text-primary/80 prose-a:transition-colors prose-strong:text-foreground prose-strong:font-semibold prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/50 prose-blockquote:p-4 prose-blockquote:my-6 prose-blockquote:rounded-lg prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-auto";

  useEffect(() => {
    // Fetch Terms of Service content from API
    fetch("/api/terms-of-service")
      .then((response) => response.json())
      .then((data) => {
        if (data.html) {
          setTermsHtml(data.html);
        } else {
          throw new Error("No terms of service HTML received");
        }
      })
      .catch((error) => {
        logError(error, "TermsContent.fetchTermsOfService");
        setTermsHtml(
          "<p>Failed to load terms of service content. Please visit the repository to view the full terms of service.</p>",
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
          📜 Simple terms for an open portfolio
        </p>
      </div>
      <div className={`min-h-[400px] ${isLoading ? "animate-pulse" : ""}`}>
        {isLoading ? (
          <div className="text-muted-foreground">
            Loading terms of service...
          </div>
        ) : (
          <div
            className={DEFAULT_MARKDOWN_CLASS}
            dangerouslySetInnerHTML={{
              __html: termsHtml,
            }}
          />
        )}
      </div>
    </div>
  );
}
