import { describe, it, expect } from "vitest";
// next.config.mjs lives at the repo root. Importing it exercises the real header
// configuration Next.js serves. With ANALYZE unset, the @next/bundle-analyzer
// wrapper returns the config object untouched, so `headers()` is intact.
import nextConfig from "../../next.config.mjs";

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

/**
 * Headers as production serves them.
 *
 * HSTS and the two https-forcing CSP directives depend on the origin actually
 * being reachable over https: emitted over plain http they make WebKit rewrite
 * every asset to https://<host> and fail on TLS. Two things turn them off,
 * `next dev` and SERVE_HTTP=true, and both states are pinned below rather than
 * left to whatever env the runner happens to have.
 */
async function securityHeaderMap(): Promise<Map<string, string>> {
  return withEnv(
    { NODE_ENV: "production", SERVE_HTTP: undefined },
    readHeaders,
  );
}

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const env = process.env as Record<string, string | undefined>;
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = env[key];
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

async function readHeaders(): Promise<Map<string, string>> {
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
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    // Legacy XSS auditor disabled per OWASP guidance; CSP is the real control.
    expect(headers.get("X-XSS-Protection")).toBe("0");
    // Isolate our browsing-context group from cross-origin popups.
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Permissions-Policy")).toContain("geolocation=()");

    const hsts = headers.get("Strict-Transport-Security") ?? "";
    expect(hsts).toContain("max-age=63072000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  it("forces https on the deployed site", async () => {
    const csp =
      (await securityHeaderMap()).get("Content-Security-Policy") ?? "";

    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("block-all-mixed-content");
  });

  /**
   * SERVE_HTTP is what the e2e jobs set, because they run `npm start` over
   * http://localhost:3000. With the https-forcing headers on, WebKit rewrites
   * every asset URL to https and fails on TLS: measured 19 failed requests,
   * both stylesheets, the fonts and every JS chunk, leaving an unstyled page
   * with no React on it. Chromium ignores the directive on localhost, so the
   * whole WebKit suite was testing a blank document.
   *
   * It must stay opt-in. Vercel never sets it, so the assertions above are
   * what the deployed site gets; this only describes a local http server.
   */
  it("drops the https-forcing headers when SERVE_HTTP is set", async () => {
    const headers = await withEnv(
      { NODE_ENV: "production", SERVE_HTTP: "true" },
      readHeaders,
    );
    const csp = headers.get("Content-Security-Policy") ?? "";

    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("block-all-mixed-content");
    expect(headers.get("Strict-Transport-Security")).toBeUndefined();

    // Everything that does not depend on the scheme must survive, or this
    // switch would quietly become a way to run the suite with no CSP at all.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("ships a restrictive Content-Security-Policy", async () => {
    const headers = await securityHeaderMap();
    const csp = headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("upgrade-insecure-requests");

    // connect-src must not fall back to a bare `https:` wildcard, which would
    // nullify the allowlist. Every https source must be a concrete origin
    // (https://...), so no `https:` may appear that isn't followed by `//`.
    expect(csp).not.toMatch(/\bhttps:(?!\/\/)/);
  });
});
