/**
 * Simple in-memory rate limiter for API routes
 * Production deployment should use Redis or similar for distributed rate limiting
 */

import { NextRequest, NextResponse } from "next/server";
import { devLog } from "./dev-logger";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Store rate limit data in memory
// In production with multiple instances, use Redis instead
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 100, // 100 requests per window
  message: "Too many requests, please try again later",
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit headers
};

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/** An IPv4 or IPv6 address, as Vercel's edge sets one; nothing longer. */
const ADDRESS =
  /^(?:\d{1,3}(?:\.\d{1,3}){3}|(?=[0-9A-Fa-f:.]{2,45}$)[0-9A-Fa-f.]*:[0-9A-Fa-f:.]*)$/;

/**
 * Get client identifier from request
 */
function getClientId(request: NextRequest): string {
  // Safely get header function, handle test environments where headers might not exist
  const getHeader = (name: string): string | null => {
    try {
      return request.headers?.get?.(name) || null;
    } catch {
      return null;
    }
  };

  // Try to get real IP from various headers (for proxied requests).
  // cf-connecting-ip is intentionally NOT trusted: this site is deployed on
  // Vercel (not behind Cloudflare), so that header would be entirely
  // client-supplied and would let a caller mint a fresh rate-limit bucket at
  // will. x-real-ip / x-forwarded-for are set by the Vercel edge.
  const forwarded = getHeader("x-forwarded-for");
  const realIp = getHeader("x-real-ip");

  // The first available address, and only an address: a direct client of
  // next start sends its own header, which was taken verbatim, any length,
  // a fresh bucket per value. Anything else shares the "unknown" bucket.
  const candidate = (realIp || forwarded?.split(",")[0] || "").trim();
  const ip = ADDRESS.test(candidate) ? candidate : "unknown";

  // Combine IP with User-Agent for better fingerprinting
  const userAgent = getHeader("user-agent") || "unknown";
  const clientId = `${ip}:${userAgent.substring(0, 50)}`;

  return clientId;
}

/** A route's own limit: its requests count in a bucket of their own. */
export interface RouteLimit {
  /** Names the bucket; the default limit's routes share one. */
  name: string;
  /** Requests a client may make in the window. */
  maxRequests: number;
}

/**
 * Rate limiting middleware for API routes
 */
export async function rateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  limit?: RouteLimit,
): Promise<NextResponse> {
  const clientId = limit
    ? `${limit.name}:${getClientId(request)}`
    : getClientId(request);
  const maxRequests = limit?.maxRequests ?? RATE_LIMIT_CONFIG.maxRequests;
  const now = Date.now();
  const resetTime = now + RATE_LIMIT_CONFIG.windowMs;

  // Get or create rate limit entry
  let entry = rateLimitStore.get(clientId);

  if (!entry || entry.resetTime < now) {
    // New window
    entry = {
      count: 1,
      resetTime: resetTime,
    };
    rateLimitStore.set(clientId, entry);
  } else {
    // Existing window
    entry.count++;
  }

  // Calculate rate limit headers
  const remaining = Math.max(0, maxRequests - entry.count);
  const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

  // Check if rate limit exceeded
  if (entry.count > maxRequests) {
    devLog(`Rate limit exceeded for client: ${clientId}`);

    return NextResponse.json(
      {
        error: RATE_LIMIT_CONFIG.message,
        retryAfter: retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
        },
      },
    );
  }

  // Execute the handler
  const response = await handler();

  // Add rate limit headers to successful responses (skip in test environment)
  if (RATE_LIMIT_CONFIG.standardHeaders) {
    try {
      response.headers?.set?.("X-RateLimit-Limit", maxRequests.toString());
      response.headers?.set?.("X-RateLimit-Remaining", remaining.toString());
      response.headers?.set?.(
        "X-RateLimit-Reset",
        new Date(entry.resetTime).toISOString(),
      );
    } catch {
      // Ignore header setting errors in test environment
    }
  }

  return response;
}

/**
 * Wrapper to apply rate limiting to API route handlers
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  limit?: RouteLimit,
) {
  return async (request: NextRequest) => {
    return rateLimit(request, () => handler(request), limit);
  };
}

// Export configuration for testing
export { RATE_LIMIT_CONFIG };
