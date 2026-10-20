import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The browser side of the error reports: what a report holds, and that a
 * page sends one per error, in production builds only. Each test imports
 * the module afresh: it remembers what this page load has sent.
 */

let report: typeof import("./report");

const chunk = "/_next/static/chunks/app/page-0a1b2c.js";

function errorWithStack(stack: string, message = "x is not a function") {
  const error = new TypeError(message);
  error.stack = stack;
  return error;
}

beforeEach(async () => {
  vi.resetModules();
  report = await import("./report");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", "/");
});

describe("reportPayload", () => {
  it("takes the first frame in the site's chunks from a Chrome stack", () => {
    const error = errorWithStack(
      [
        "TypeError: x is not a function",
        "    at f (chrome-extension://abc/content.js:1:1)",
        `    at g (https://claret.tech${chunk}:1:2345)`,
        "    at h (https://claret.tech/_next/static/chunks/main.js:3:4)",
      ].join("\n"),
    );

    expect(report.reportPayload(error, "/")).toEqual({
      name: "TypeError",
      message: "x is not a function",
      frame: `${chunk}:1:2345`,
      path: "/",
      build: "unknown",
    });
  });

  it("reads Firefox and Safari stacks", () => {
    const error = errorWithStack(`g@https://claret.tech${chunk}:1:99\n`);
    expect(report.reportPayload(error, "/").frame).toBe(`${chunk}:1:99`);
  });

  it("takes a frame in a dynamic route's chunk", () => {
    const page = "/_next/static/chunks/app/pdf/%5Bslug%5D/page-0a1b2c.js";
    const error = errorWithStack(`    at f (https://claret.tech${page}:1:77)`);
    expect(report.reportPayload(error, "/").frame).toBe(`${page}:1:77`);
  });

  it("leaves out the deployment query of skew protection", () => {
    const error = errorWithStack(
      `    at g (https://claret.tech${chunk}?dpl=dpl_7Hx2kQ:1:2345)`,
    );
    expect(report.reportPayload(error, "/").frame).toBe(`${chunk}:1:2345`);
  });

  it("sends no frame when none is the site's, and a cut message", () => {
    const error = errorWithStack(
      "Error: boom\n    at f (chrome-extension://abc/content.js:1:1)",
      "m".repeat(1000),
    );

    const payload = report.reportPayload(error, "/");
    expect(payload.frame).toBeNull();
    expect(payload.message).toHaveLength(300);
  });
});

describe("what was thrown, when it is not an Error", () => {
  it("is reported by what it is", () => {
    // Next passes the boundaries whatever was thrown.
    expect(report.reportPayload(null, "/")).toMatchObject({
      name: "Error",
      message: "Thrown, not an Error: null",
      frame: null,
    });
    expect(report.reportPayload("a string", "/").message).toBe(
      "Thrown, not an Error: a string",
    );
    expect(report.reportPayload(42, "/").message).toBe(
      "Thrown, not an Error: number",
    );
    expect(
      report.reportPayload({ name: "TypeError", message: "m" }, "/"),
    ).toMatchObject({ name: "TypeError", message: "m" });
  });

  it("never makes the report throw", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 202 }))),
    );
    const hostile = {
      get message(): string {
        throw new Error("a getter that throws");
      },
    };

    await expect(report.reportClientError(hostile)).resolves.toBe(false);
    await expect(report.reportClientError(null)).resolves.toBe(true);
  });
});

describe("reportClientError", () => {
  const answer = (status: number) =>
    vi.fn(() => Promise.resolve(new Response(null, { status })));

  it("sends nothing outside production builds", async () => {
    const fetch = answer(202);
    vi.stubGlobal("fetch", fetch);

    expect(await report.reportClientError(new Error("dev"))).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the error, the page's path without query or hash, and its build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    // next.config.mjs inlines the built commit.
    vi.stubEnv("BUILD_COMMIT", "abc1234");
    const fetch = answer(202);
    vi.stubGlobal("fetch", fetch);
    window.history.replaceState(null, "", "/pdf/neat-for-xor?page=2#zoom");
    const error = errorWithStack(`at g (https://claret.tech${chunk}:1:2)`);

    expect(await report.reportClientError(error)).toBe(true);

    expect(fetch).toHaveBeenCalledWith("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "TypeError",
        message: "x is not a function",
        frame: `${chunk}:1:2`,
        path: "/pdf/neat-for-xor",
        build: "abc1234",
      }),
      keepalive: true,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  });

  it("sends an error once per page load", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetch = answer(202);
    vi.stubGlobal("fetch", fetch);

    const first = report.reportClientError(new Error("once"));
    const again = report.reportClientError(new Error("once"));

    expect(again).toBe(first);
    expect(await again).toBe(true);
    await report.reportClientError(new Error("another"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("is on record only after a 202", async () => {
    vi.stubEnv("NODE_ENV", "production");

    vi.stubGlobal("fetch", answer(204));
    expect(await report.reportClientError(new Error("not filed"))).toBe(false);

    vi.stubGlobal("fetch", answer(429));
    expect(await report.reportClientError(new Error("limited"))).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    expect(await report.reportClientError(new Error("offline"))).toBe(false);
  });
});
