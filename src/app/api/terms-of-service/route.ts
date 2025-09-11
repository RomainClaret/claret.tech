import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { devError } from "@/lib/utils/dev-logger";
import { renderMarkdownToHtml } from "@/lib/utils/markdown-server";
import { ApiCache } from "@/lib/utils/api-cache";

const CACHE_KEY = "terms-of-service-content";

export async function GET() {
  try {
    // Check if we have cached data that's still valid
    const cachedData = ApiCache.get<{ content: string; html: string }>(
      CACHE_KEY,
    );
    if (cachedData) {
      return NextResponse.json(
        { content: cachedData.content, html: cachedData.html },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=3600, stale-while-revalidate=7200",
          },
        },
      );
    }

    // Read TERMS-OF-SERVICE file from project root
    const termsPath = path.join(process.cwd(), "TERMS-OF-SERVICE.md");

    if (!fs.existsSync(termsPath)) {
      devError("TERMS-OF-SERVICE.md file not found at:", termsPath);
      return NextResponse.json(
        {
          error: "TERMS-OF-SERVICE file not found",
          content:
            "# Terms of Service\n\n**Effective Date: 2025-01-03**\n\n[Terms of service file not found - please check repository]",
        },
        { status: 404 },
      );
    }

    const termsContent = fs.readFileSync(termsPath, "utf-8");

    // Render markdown to HTML
    const termsHtml = renderMarkdownToHtml(termsContent);

    // Cache the result
    ApiCache.set(CACHE_KEY, {
      content: termsContent,
      html: termsHtml,
    });

    return NextResponse.json(
      { content: termsContent, html: termsHtml },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (error) {
    devError("Failed to read TERMS-OF-SERVICE file:", error);

    // Return fallback terms of service content
    const fallbackTerms = `# Terms of Service

**Effective Date: 2025-01-03**

## 1. Acceptance of Terms

By accessing and using claret.tech ("this website"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use this website.

## 2. Use of Website

This website is a personal portfolio and research showcase. You may view and read all publicly available content.

## 12. Contact Information

For questions about these Terms of Service, please contact:

**Email:** [legal@claret.tech](mailto:legal@claret.tech)`;

    return NextResponse.json(
      {
        content: fallbackTerms,
        warning: "Using fallback terms of service content due to read error",
      },
      { status: 200 },
    );
  }
}
