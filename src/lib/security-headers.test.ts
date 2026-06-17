import { describe, it, expect } from "vitest";
// next.config.mjs lives at the repo root. Importing it exercises the real header
// configuration Next.js serves. With ANALYZE unset, the @next/bundle-analyzer
// wrapper returns the config object untouched, so `headers()` is intact.
import nextConfig from "../../next.config.mjs";

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

async function securityHeaderMap(): Promise<Map<string, string>> {
  const rules = (await (
    nextConfig as { headers: () => Promise<HeaderRule[]> }
  ).headers()) as HeaderRule[];
  const rule = rules.find((r) => r.source === "/:path*");
  expect(rule, "expected a header rule for source '/:path*'").toBeDefined();
  return new Map(rule!.headers.map((h) => [h.key, h.value]));
}

describe("security headers (next.config)", () => {
  it("sets the expected security response headers on all paths", async () => {
    const headers = await securityHeaderMap();

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("geolocation=()");

    const hsts = headers.get("Strict-Transport-Security") ?? "";
    expect(hsts).toContain("max-age=63072000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  it("ships a restrictive Content-Security-Policy", async () => {
    const headers = await securityHeaderMap();
    const csp = headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});
