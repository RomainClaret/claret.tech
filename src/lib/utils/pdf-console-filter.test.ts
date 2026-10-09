import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * pdf.js prints font warnings that mean nothing to a reader of the site; the
 * reader filters them out of the console in production.
 */

const original = { warn: console.warn, error: console.error };

afterEach(() => {
  console.warn = original.warn;
  console.error = original.error;
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** A fresh copy of the module, so its "installed" flag starts clear. */
async function load() {
  vi.stubEnv("NODE_ENV", "production");
  return (await import("./pdf-console-filter")).setupPDFConsoleFilter;
}

describe("setupPDFConsoleFilter", () => {
  it("wraps the console once, however many documents open", async () => {
    // Each reader mount used to wrap it again, so after N documents every
    // console call went through N filters.
    const setupPDFConsoleFilter = await load();

    setupPDFConsoleFilter();
    const wrapped = console.warn;
    setupPDFConsoleFilter();
    setupPDFConsoleFilter();

    expect(wrapped).not.toBe(original.warn);
    expect(console.warn).toBe(wrapped);
  });

  it("drops the known pdf.js font noise and passes the rest", async () => {
    const warn = vi.fn();
    console.warn = warn;
    const setupPDFConsoleFilter = await load();
    setupPDFConsoleFilter();

    console.warn("Warning: TT: undefined function: 32");
    console.warn("something else");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("something else");
  });
});
