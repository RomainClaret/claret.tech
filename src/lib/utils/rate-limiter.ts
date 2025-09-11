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

  // Try to get real IP from various headers (for proxied requests)
  const forwarded = getHeader("x-forwarded-for");
  const realIp = getHeader("x-real-ip");
  const cfConnectingIp = getHeader("cf-connecting-ip");

  // Use the first available IP
  const ip = cfConnectingIp || realIp || forwarded?.split(",")[0] || "unknown";

  // Combine IP with User-Agent for better fingerprinting
  const userAgent = getHeader("user-agent") || "unknown";
  const clientId = `${ip}:${userAgent.substring(0, 50)}`;

  return clientId;
}

/**
 * Rate limiting middleware for API routes
 */
export async function rateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const clientId = getClientId(request);
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
  const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequests - entry.count);
  const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

  // Check if rate limit exceeded
  if (entry.count > RATE_LIMIT_CONFIG.maxRequests) {
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
          "X-RateLimit-Limit": RATE_LIMIT_CONFIG.maxRequests.toString(),
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
      response.headers?.set?.(
        "X-RateLimit-Limit",
        RATE_LIMIT_CONFIG.maxRequests.toString(),
      );
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
) {
  return async (request: NextRequest) => {
    return rateLimit(request, () => handler(request));
  };
}

/**
 * Custom rate limit configuration for specific endpoints
 */
export function createRateLimiter(options: {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
}) {
  const config = {
    ...RATE_LIMIT_CONFIG,
    ...options,
  };

  return function withCustomRateLimit(
    handler: (request: NextRequest) => Promise<NextResponse>,
  ) {
    return async (request: NextRequest) => {
      // Use custom config for this specific rate limiter
      const originalConfig = { ...RATE_LIMIT_CONFIG };
      Object.assign(RATE_LIMIT_CONFIG, config);

      const response = await rateLimit(request, () => handler(request));

      // Restore original config
      Object.assign(RATE_LIMIT_CONFIG, originalConfig);

      return response;
    };
  };
}

// Export configuration for testing
export { RATE_LIMIT_CONFIG };
