import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// rate-limiter calls devLog() on the 429 path. Mock the logger so this file is
// hermetic; other suites in the same batch mock "./dev-logger" with a partial
// surface, which would otherwise leak in singleFork mode and drop devLog.
vi.mock("./dev-logger", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
  devError: vi.fn(),
  devInfo: vi.fn(),
  devDebug: vi.fn(),
  logError: vi.fn(),
  logWarning: vi.fn(),
  devLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { rateLimit, withRateLimit, RATE_LIMIT_CONFIG } from "./rate-limiter";

// Duck-typed NextRequest with a real Headers object (avoids constructing a real
// NextRequest, which needs edge-runtime plumbing not present in the test env).
function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

// Handler returning a response that carries a real Headers object so the
// limiter can attach X-RateLimit-* headers to it.
function okHandler(): Promise<NextResponse> {
  return Promise.resolve({
    status: 200,
    headers: new Headers(),
    json: async () => ({ ok: true }),
  } as unknown as NextResponse);
}

describe("rate-limiter", () => {
  beforeEach(() => {
    // The 429 branch calls NextResponse.json(); mock it to return a duck-typed
    // response (same pattern the API route tests use).
    vi.spyOn(NextResponse, "json").mockImplementation(
      (data: unknown, init?: ResponseInit) =>
        ({
          status: init?.status ?? 200,
          headers: new Headers(init?.headers),
          json: async () => data,
        }) as unknown as NextResponse,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rateLimit", () => {
    it("allows a request under the limit and attaches X-RateLimit headers", async () => {
      const req = makeRequest({
        "x-real-ip": "10.0.0.1",
        "user-agent": "vitest",
      });
      const res = await rateLimit(req, okHandler);

      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBe(
        String(RATE_LIMIT_CONFIG.maxRequests),
      );
      expect(res.headers.get("X-RateLimit-Remaining")).toBe(
        String(RATE_LIMIT_CONFIG.maxRequests - 1),
      );
    });

    it("returns 429 after exceeding maxRequests", async () => {
      const req = makeRequest({
        "x-real-ip": "10.0.0.2",
        "user-agent": "vitest",
      });

      // Consume exactly the allowed quota (all 200s).
      for (let i = 0; i < RATE_LIMIT_CONFIG.maxRequests; i++) {
        const ok = await rateLimit(req, okHandler);
        expect(ok.status).toBe(200);
      }

      // One more request crosses the threshold.
      const limited = await rateLimit(req, okHandler);
      expect(limited.status).toBe(429);

      const body = (await limited.json()) as {
        error: string;
        retryAfter: number;
      };
      expect(body.error).toBe(RATE_LIMIT_CONFIG.message);
      expect(limited.headers.get("Retry-After")).toBeTruthy();
      expect(limited.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("does not invoke the handler once rate limited", async () => {
      const req = makeRequest({ "x-real-ip": "10.0.0.3" });
      for (let i = 0; i < RATE_LIMIT_CONFIG.maxRequests; i++) {
        await rateLimit(req, okHandler);
      }

      const handler = vi.fn(okHandler);
      const limited = await rateLimit(req, handler);

      expect(limited.status).toBe(429);
      expect(handler).not.toHaveBeenCalled();
    });

    it("isolates buckets per client (distinct IP is unaffected by another's quota)", async () => {
      const heavy = makeRequest({ "x-real-ip": "10.0.0.4" });
      for (let i = 0; i < RATE_LIMIT_CONFIG.maxRequests + 5; i++) {
        await rateLimit(heavy, okHandler);
      }

      const fresh = makeRequest({ "x-real-ip": "10.0.0.5" });
      const res = await rateLimit(fresh, okHandler);
      expect(res.status).toBe(200);
    });

    it("ignores cf-connecting-ip so a spoofed value cannot mint a fresh bucket", async () => {
      // Exhaust the quota for a client keyed by its (Vercel-set) x-real-ip.
      const client = makeRequest({ "x-real-ip": "10.0.0.7" });
      for (let i = 0; i < RATE_LIMIT_CONFIG.maxRequests; i++) {
        await rateLimit(client, okHandler);
      }
      expect((await rateLimit(client, okHandler)).status).toBe(429);

      // Same x-real-ip but an attacker-supplied, distinct cf-connecting-ip must
      // NOT reset the bucket: the site is not behind Cloudflare, so that header
      // is untrusted and no longer part of the client key.
      const spoofed = makeRequest({
        "x-real-ip": "10.0.0.7",
        "cf-connecting-ip": "1.2.3.4",
      });
      expect((await rateLimit(spoofed, okHandler)).status).toBe(429);
    });

    it("tolerates an undefined request without throwing", async () => {
      // getClientId swallows the undefined access and falls back to "unknown".
      const res = await rateLimit(
        undefined as unknown as NextRequest,
        okHandler,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("withRateLimit", () => {
    it("wraps a handler and forwards the request", async () => {
      const handler = vi.fn((_req: NextRequest) => okHandler());
      const wrapped = withRateLimit(handler);
      const req = makeRequest({ "x-real-ip": "10.0.0.6" });

      const res = await wrapped(req);

      expect(handler).toHaveBeenCalledWith(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBe(
        String(RATE_LIMIT_CONFIG.maxRequests),
      );
    });
  });
});
