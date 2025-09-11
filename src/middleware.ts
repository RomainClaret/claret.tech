import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "";

  // Detect Safari with more robust logic
  // Chrome, Edge, and other Chromium browsers include "Safari" for compatibility
  // Real Safari includes "Version/" which Chromium browsers don't
  const hasSafari = userAgent.includes("Safari");
  const hasChrome =
    userAgent.includes("Chrome") || userAgent.includes("Chromium");
  const hasEdge = userAgent.includes("Edge") || userAgent.includes("Edg/");
  const hasChromeOnIOS = userAgent.includes("CriOS"); // Chrome on iOS
  const hasFirefoxOnIOS = userAgent.includes("FxiOS"); // Firefox on iOS
  const hasSafariVersion = userAgent.includes("Version/"); // Safari-specific

  // True Safari: has Safari + Version/, but no Chrome/Chromium/Edge
  const isSafari =
    hasSafari &&
    hasSafariVersion &&
    !hasChrome &&
    !hasEdge &&
    !hasChromeOnIOS &&
    !hasFirefoxOnIOS;

  const response = NextResponse.next();

  // Set Safari detection cookie with proper attributes
  response.cookies.set("safari-detected", isSafari.toString(), {
    httpOnly: false, // Need to be readable by client
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return response;
}

export const config = {
  // Apply to all routes except static files and API routes that don't need Safari detection
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)"],
};
