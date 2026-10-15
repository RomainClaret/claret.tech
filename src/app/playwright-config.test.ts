import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The e2e config starts `npm run dev` only when no server is named. With
 * PLAYWRIGHT_BASE_URL pointing at a build on another port, the tests went
 * to that build, and the config still checked localhost:3000, found it
 * empty and started a dev server in the checkout, which rewrote its .next
 * as a development build.
 */

const named = process.env.PLAYWRIGHT_BASE_URL;
const ci = process.env.CI;

async function loadConfig(baseUrl: string | undefined) {
  vi.resetModules();
  if (baseUrl === undefined) delete process.env.PLAYWRIGHT_BASE_URL;
  else process.env.PLAYWRIGHT_BASE_URL = baseUrl;
  return (await import("../../playwright.config")).default;
}

afterEach(() => {
  if (named === undefined) delete process.env.PLAYWRIGHT_BASE_URL;
  else process.env.PLAYWRIGHT_BASE_URL = named;
  if (ci === undefined) delete process.env.CI;
  else process.env.CI = ci;
});

describe("the e2e config", () => {
  it("starts no dev server when the tests are pointed at a server", async () => {
    const config = await loadConfig("http://localhost:3001");

    expect(config.webServer).toBeUndefined();
    expect(String(config.use?.baseURL)).toContain("http://localhost:3001");
  });

  it("starts the dev server when no server is named", async () => {
    const config = await loadConfig(undefined);

    expect(config.webServer).toMatchObject({
      command: "npm run dev",
      url: "http://localhost:3000",
    });
  });

  it("leaves CI's Firefox its content processes", async () => {
    // Two prefs kept CI's Firefox to one content process, as "stability
    // settings" nobody measured. With them, axe crashed the tab in 10 of
    // 10 runs; without them, CI's Firefox suites pass the same (45 of 45,
    // three runs each) in the same time (median 120 s against 118 s).
    process.env.CI = "true";
    const config = await loadConfig(undefined);
    const firefox = config.projects?.find(
      (project) => project.name === "firefox",
    );
    const prefs = Object.keys(
      firefox?.use?.launchOptions?.firefoxUserPrefs ?? {},
    );

    expect(prefs).toContain("dom.max_script_run_time"); // CI's block is on
    expect(prefs).not.toContain("dom.ipc.processCount");
    expect(prefs).not.toContain("browser.tabs.remote.autostart");
  });
});
