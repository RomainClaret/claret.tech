import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { devError } from "@/lib/utils/dev-logger";
import { ApiCache } from "@/lib/utils/api-cache";
import { withRateLimit } from "@/lib/utils/rate-limiter";

const CACHE_KEY = "license-content";

async function handler() {
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
            "GPL-3.0-or-later\n\nCopyright (C) 2025 Romain Claret\n\n[LICENSE file not found - see https://www.gnu.org/licenses/gpl-3.0.txt]",
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

    // Return fallback GPL-3.0-or-later notice (full text lives in the LICENSE file)
    const fallbackLicense = `GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) 2025 Romain Claret

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
this program. If not, see <https://www.gnu.org/licenses/>.

Full text: https://www.gnu.org/licenses/gpl-3.0.txt`;

    return NextResponse.json(
      {
        content: fallbackLicense,
        warning: "Using fallback license content due to read error",
      },
      { status: 200 },
    );
  }
}

export async function GET(request: NextRequest) {
  return withRateLimit(handler)(request);
}
