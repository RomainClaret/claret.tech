import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { devError } from "@/lib/utils/dev-logger";
import { renderMarkdownToHtml } from "@/lib/utils/markdown-server";
import { ApiCache } from "@/lib/utils/api-cache";
import { withRateLimit } from "@/lib/utils/rate-limiter";

const CACHE_KEY = "privacy-policy-content";

async function handler() {
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

    // Read PRIVACY-POLICY file from project root
    const privacyPath = path.join(process.cwd(), "PRIVACY-POLICY.md");

    if (!fs.existsSync(privacyPath)) {
      devError("PRIVACY-POLICY.md file not found at:", privacyPath);
      return NextResponse.json(
        {
          error: "PRIVACY-POLICY file not found",
          content:
            "# Privacy Policy\n\n**Last Updated: 2025-01-03**\n\n[Privacy policy file not found - please check repository]",
        },
        { status: 404 },
      );
    }

    const privacyContent = fs.readFileSync(privacyPath, "utf-8");

    // Render markdown to HTML
    const privacyHtml = renderMarkdownToHtml(privacyContent);

    // Cache the result
    ApiCache.set(CACHE_KEY, {
      content: privacyContent,
      html: privacyHtml,
    });

    return NextResponse.json(
      { content: privacyContent, html: privacyHtml },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (error) {
    devError("Failed to read PRIVACY-POLICY file:", error);

    // Return fallback privacy policy content
    const fallbackPrivacy = `# Privacy Policy

**Last Updated: 2025-01-03**

## Our Commitment to Privacy

At Claret.Tech, we believe in complete transparency and respect for your privacy. This website is designed with a privacy-first approach.

> **🔒 We DO NOT track you. We DO NOT collect personal data. We use only privacy-focused analytics that cannot identify you.**

## What We Don't Collect

- ❌ No personal identification information
- ❌ No IP address logging
- ❌ No behavioral tracking
- ❌ No tracking cookies
- ❌ No session recording
- ❌ No fingerprinting

## Contact

If you have any questions about this privacy policy, please contact:

**Email:** [privacy@claret.tech](mailto:privacy@claret.tech)`;

    return NextResponse.json(
      {
        content: fallbackPrivacy,
        warning: "Using fallback privacy policy content due to read error",
      },
      { status: 200 },
    );
  }
}

export async function GET(request: NextRequest) {
  return withRateLimit(handler)(request);
}
