import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { devError } from "@/lib/utils/dev-logger";
import { ApiCache } from "@/lib/utils/api-cache";

const CACHE_KEY = "license-content";

export async function GET() {
  try {
    // Check if we have cached data that's still valid
    const cachedContent = ApiCache.get<string>(CACHE_KEY);
    if (cachedContent) {
      return NextResponse.json(
        { content: cachedContent },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=3600, stale-while-revalidate=7200",
          },
        },
      );
    }

    // Read LICENSE file from project root
    const licensePath = path.join(process.cwd(), "LICENSE");

    if (!fs.existsSync(licensePath)) {
      devError("LICENSE file not found at:", licensePath);
      return NextResponse.json(
        {
          error: "LICENSE file not found",
          content:
            "MIT License\n\nCopyright (c) 2025 Romain Claret\n\n[License file not found - please check repository]",
        },
        { status: 404 },
      );
    }

    const licenseContent = fs.readFileSync(licensePath, "utf-8");

    // Cache the result
    ApiCache.set(CACHE_KEY, licenseContent);

    return NextResponse.json(
      { content: licenseContent },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (error) {
    devError("Failed to read LICENSE file:", error);

    // Return fallback MIT License text
    const fallbackLicense = `MIT License

Copyright (c) 2025 Romain Claret

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

    return NextResponse.json(
      {
        content: fallbackLicense,
        warning: "Using fallback license content due to read error",
      },
      { status: 200 },
    );
  }
}
