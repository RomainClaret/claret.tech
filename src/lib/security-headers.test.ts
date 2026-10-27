import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// next.config.mjs lives at the repo root. Importing it exercises the real header
// configuration Next.js serves. With ANALYZE unset, the @next/bundle-analyzer
// wrapper returns the config object untouched, so `headers()` is intact.
import nextConfig from "../../next.config.mjs";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";

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

/**
 * The headers a path gets, as Next resolves them: every matching rule, in
 * order, a later value replacing an earlier one under the same key.
 */
async function headersFor(path: string): Promise<Map<string, string>> {
  const rules = (await (
    nextConfig as { headers: () => Promise<HeaderRule[]> }
  ).headers()) as HeaderRule[];
  const out = new Map<string, string>();
  for (const rule of rules) {
    if (!getPathMatch(rule.source)(path)) continue;
    for (const { key, value } of rule.headers) out.set(key, value);
  }
  return out;
}

describe("the headers each path gets", () => {
  // Read through Next's own matcher: the site policy's rule (/:path*) also
  // matches /python-worker.js, which gets its own policy only because its
  // rule comes later (security audit run 1, hardening).
  it("gives the Python worker its own policy, nothing of the site's", async () => {
    const worker = await withEnv(
      { NODE_ENV: "production", SERVE_HTTP: undefined },
      () => headersFor("/python-worker.js"),
    );
    expect(worker.get("Content-Security-Policy")).toMatch(
      /^default-src 'none'/,
    );
  });

  it.each([
    "/",
    "/pdf/geenns",
    "/api/fetch-github",
    "/images/x.png",
    "/rss.xml",
  ])("keeps every other page out of frames: %s", async (path) => {
    const headers = await withEnv(
      { NODE_ENV: "production", SERVE_HTTP: undefined },
      () => headersFor(path),
    );
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });
});

describe("the large static files", () => {
  // The Pyodide runtime (a 9.6 MB wasm) and the PDFs draw on the plan's
  // shared monthly transfer. Same-origin keeps another site from making its
  // visitors' browsers fetch them; the site's own worker and pdf.js load
  // them same-origin, and opening a PDF in a tab is a navigation, which the
  // header does not touch (security audit run 1, lead 12).
  it.each(["/pyodide/:path*", "/pdfs/:path*"])(
    "%s may be loaded by this site's pages only",
    async (source) => {
      const rules = (await (
        nextConfig as { headers: () => Promise<HeaderRule[]> }
      ).headers()) as HeaderRule[];
      const rule = rules.find((r) => r.source === source);
      expect(rule?.headers).toContainEqual({
        key: "Cross-Origin-Resource-Policy",
        value: "same-origin",
      });
    },
  );
});

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

  it("forces https on a build under any NODE_ENV but development", async () => {
    // isProd read NODE_ENV === "production", so a build run under
    // NODE_ENV=test silently dropped HSTS and both https directives
    // (security audit run 1, hardening).
    const headers = await withEnv(
      { NODE_ENV: "test", SERVE_HTTP: undefined },
      readHeaders,
    );
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(headers.get("Content-Security-Policy")).toContain(
      "upgrade-insecure-requests",
    );
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

  // Round 25 found most of the hosts the CSP allowed contacted by nothing in
  // the browser (the server fetches GitHub, ORCID, Semantic Scholar and
  // Kudos; remote images go through the image optimizer). An allowed host is
  // an exfiltration route, and the privacy policy names this list.
  it("lets the browser reach only the hosts the site uses", async () => {
    const csp =
      (await securityHeaderMap()).get("Content-Security-Policy") ?? "";
    const sources = (name: string) =>
      csp
        .split(";")
        .find((directive) => directive.trim().startsWith(`${name} `))
        ?.trim()
        .split(/\s+/)
        .slice(1) ?? [];

    expect(sources("connect-src")).toEqual([
      "'self'",
      "https://huggingface.co",
      "https://www.huggingface.co",
      "https://cdn.huggingface.co",
      "https://cdn-lfs.huggingface.co",
      "https://cdn-lfs-us-1.huggingface.co",
      "https://cdn-lfs-eu-1.huggingface.co",
      "https://*.hf.co",
      "https://raw.githubusercontent.com",
      "https://vercel.live",
      "wss://ws-us3.pusher.com",
    ]);
    expect(sources("img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(sources("script-src").filter((s) => /^https:/.test(s))).toEqual([
      "https://vercel.live",
    ]);
    expect(sources("font-src").filter((s) => /^https:/.test(s))).toEqual([]);
  });

  it("is the list the privacy policy names", async () => {
    // PRIVACY-POLICY.md tells visitors where their browser may connect;
    // its note named Hugging Face alone while the CSP allowed 17 hosts.
    const csp =
      (await securityHeaderMap()).get("Content-Security-Policy") ?? "";
    const connect =
      csp
        .split(";")
        .find((directive) => directive.trim().startsWith("connect-src "))
        ?.trim()
        .split(/\s+/)
        .slice(1) ?? [];
    const policy = readFileSync(
      join(process.cwd(), "PRIVACY-POLICY.md"),
      "utf8",
    );
    const note = policy.slice(
      policy.indexOf("Note: The Content Security Policy"),
    );

    for (const source of connect.filter((s) => s !== "'self'")) {
      const host = source.replace(/^[a-z]+:\/\//, "").replace("*.", "\\*.");
      expect(note, source).toContain(host);
    }
  });

  // Hugging Face redirects model weights to its Xet CDN (us.aws.cdn.hf.co on
  // 2026-10-18; other regions elsewhere under hf.co). Without it every weight
  // download was refused, and the terminal's AI chat could load no model.
  it("lets the AI chat download model weights from Hugging Face's CDN", async () => {
    const headers = await securityHeaderMap();
    const connect =
      (headers.get("Content-Security-Policy") ?? "")
        .split(";")
        .find((directive) => directive.trim().startsWith("connect-src"))
        ?.trim()
        .split(/\s+/) ?? [];

    expect(connect).toContain("https://huggingface.co");
    expect(connect).toContain("https://*.hf.co");
  });
});
