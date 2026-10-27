import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/** next.config.mjs as the dev server loads it, under this DEV_ALLOWED_ORIGINS. */
async function allowedDevOrigins(value: string | undefined) {
  vi.stubEnv("DEV_ALLOWED_ORIGINS", value);
  vi.resetModules();
  const { default: config } = await import("../../next.config.mjs");
  return config.allowedDevOrigins;
}

// Next 16 refuses its dev resources, the /_next/hmr connection among them, to
// any host but localhost: a page opened from the Mac's Tailscale address, as
// a phone does, never hydrated (2026-10-26).
describe("allowedDevOrigins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists the hostnames DEV_ALLOWED_ORIGINS names", async () => {
    expect(
      await allowedDevOrigins(" 100.101.102.103 , my-mac.example.ts.net,"),
    ).toEqual(["100.101.102.103", "my-mac.example.ts.net"]);
  });

  it("adds no host when it is unset or empty", async () => {
    expect(await allowedDevOrigins(undefined)).toEqual([]);
    expect(await allowedDevOrigins("")).toEqual([]);
  });
});

describe("the server scripts", () => {
  // next dev and next start listen on every interface by default: on a Mac
  // with a public address (UCD's) and its firewall off, any network could
  // reach the dev server (2026-10-26), and the production build, which loads
  // .env.local too (security audit run 1, lead 6). `localhost` would bind ::1 alone, which a client of
  // 127.0.0.1 then misses; a client of localhost falls back to 127.0.0.1.
  it("listen on the loopback address alone", () => {
    const scripts: Record<string, string> = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ).scripts;

    for (const name of ["dev", "dev:https", "start"]) {
      expect(scripts[name], name).toMatch(/\s-H 127\.0\.0\.1(\s|$)/);
    }
  });
});
