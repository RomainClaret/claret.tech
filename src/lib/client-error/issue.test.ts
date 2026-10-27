import { describe, it, expect } from "vitest";
import {
  REPORT_LIMITS,
  issueBody,
  issueTitle,
  recurrenceComment,
  routeOf,
  sanitizeReport,
  signatureLine,
  signatureOf,
  type ClientErrorReport,
} from "./issue";

/**
 * Anyone can send a report, and what passes here is published as an issue
 * in a public repository: these tests pin what may reach that page.
 */

const report = (
  fields: Partial<ClientErrorReport> = {},
): ClientErrorReport => ({
  name: "TypeError",
  message: "x is not a function",
  frame: "/_next/static/chunks/app/page-0a1b2c.js:1:2345",
  route: "/",
  build: "7c48428",
  ...fields,
});

const deployment = { commit: "7c48428", environment: "production" };

describe("routeOf", () => {
  it("names a route pattern, never the path", () => {
    expect(routeOf("/")).toBe("/");
    expect(routeOf("/pdf/neat-for-xor")).toBe("/pdf/[slug]");
    expect(routeOf("/pdf/a/b")).toBe("/(other)");
    expect(routeOf("/pdf/../etc/passwd")).toBe("/(other)");
    expect(routeOf("/pdf/x?token=secret")).toBe("/(other)");
    expect(routeOf("/@someone")).toBe("/(other)");
    expect(routeOf("")).toBe("/(other)");
  });
});

describe("sanitizeReport", () => {
  it("refuses anything but an object", () => {
    for (const body of [null, undefined, "TypeError", 42, ["TypeError"]]) {
      expect(sanitizeReport(body)).toBeNull();
    }
  });

  it("keeps a type made of letters, else says Error", () => {
    const nameOf = (name: unknown) => sanitizeReport({ name })?.name;
    expect(nameOf("TypeError")).toBe("TypeError");
    expect(nameOf("ChunkLoadError")).toBe("ChunkLoadError");
    expect(nameOf("Type Error")).toBe("Error");
    expect(nameOf("<img src=x>")).toBe("Error");
    expect(nameOf("@someone")).toBe("Error");
    expect(nameOf("A".repeat(41))).toBe("Error");
    expect(nameOf(undefined)).toBe("Error");
    expect(nameOf({ toString: () => "TypeError" })).toBe("Error");
  });

  it("makes the message one line without control characters", () => {
    const { message } = sanitizeReport({
      message: "a\nb\r\nc d e\u0007f\u009bg\t h  ",
    })!;
    expect(message).toBe("a b c d e f g h");
  });

  it("drops invisible format characters and lone surrogates", () => {
    // Bidi overrides and zero-width characters make published text read
    // other than it is; a lone surrogate can make GitHub refuse the issue.
    const { message } = sanitizeReport({
      message: "a\u202Eb\u2066c\u200Bd\uFEFFe\uD800f",
    })!;
    expect(message).toBe("abcdef");
  });

  it("never cuts a character in half", () => {
    const { message } = sanitizeReport({ message: "😀".repeat(400) })!;
    expect(message.endsWith("😀…")).toBe(true);
    expect(message.isWellFormed()).toBe(true);
  });

  it(`cuts the message to ${REPORT_LIMITS.message} characters`, () => {
    const { message } = sanitizeReport({ message: "x".repeat(1000) })!;
    expect(message).toHaveLength(REPORT_LIMITS.message);
    expect(message.endsWith("…")).toBe(true);

    const exact = "y".repeat(REPORT_LIMITS.message);
    expect(sanitizeReport({ message: exact })!.message).toBe(exact);
  });

  it("keeps a frame only in the site's own chunks", () => {
    const frameOf = (frame: unknown) => sanitizeReport({ frame })?.frame;
    const own = "/_next/static/chunks/4bd1b696-0a1b2c3d.js:1:99";
    expect(frameOf(own)).toBe(own);
    const dynamic =
      "/_next/static/chunks/app/pdf/%5Bslug%5D/page-0a1b2c.js:1:77";
    expect(frameOf(dynamic)).toBe(dynamic);
    expect(frameOf("/_next/static/chunks/../../evil.js:1:1")).toBeNull();
    expect(frameOf(`https://claret.tech${own}`)).toBeNull();
    expect(frameOf(`${own}?x=1`)).toBeNull();
    expect(frameOf("/_next/static/chunks/a.js:1:1 `x`")).toBeNull();
    expect(frameOf("chrome-extension://abc/content.js:1:1")).toBeNull();
    expect(frameOf("/_next/static/chunks/a.js:12345678:1")).toBeNull();
    expect(frameOf(42)).toBeNull();
  });

  it("keeps the build only as hex, cut to 7", () => {
    const buildOf = (build: unknown) => sanitizeReport({ build })?.build;
    expect(buildOf("7c48428")).toBe("7c48428");
    expect(buildOf("7c48428e3f0b9d2a1c4e5f6a7b8c9d0e1f2a3b4c")).toBe("7c48428");
    for (const bad of ["unknown", "7c4842", "7C48428", "7c48428z", "`x`", 42]) {
      expect(buildOf(bad)).toBeNull();
    }
    expect(buildOf("a".repeat(41))).toBeNull();
  });

  it("maps the path to its route", () => {
    expect(sanitizeReport({ path: "/pdf/neat-for-xor" })!.route).toBe(
      "/pdf/[slug]",
    );
    expect(sanitizeReport({})!.route).toBe("/(other)");
  });
});

describe("signatureOf", () => {
  it("is 12 hex, the same for the same error on any route", () => {
    const signature = signatureOf(report());
    expect(signature).toMatch(/^[0-9a-f]{12}$/);
    expect(signatureOf(report({ route: "/pdf/[slug]" }))).toBe(signature);
  });

  it("differs when the type, the message or the frame does", () => {
    const signature = signatureOf(report());
    expect(signatureOf(report({ name: "RangeError" }))).not.toBe(signature);
    expect(signatureOf(report({ message: "y is not a function" }))).not.toBe(
      signature,
    );
    expect(signatureOf(report({ frame: null }))).not.toBe(signature);
  });
});

describe("one bug, one signature", () => {
  const frame = (chunk: string, position: string) =>
    `/_next/static/chunks/${chunk}:${position}`;

  it("survives a deploy that changes the chunk's hash and the position", () => {
    const before = report({
      frame: frame("app/page-0a1b2c3d4e5f6a7b.js", "1:2345"),
    });
    const after = report({
      frame: frame("app/page-ffffffffffffffff.js", "1:2398"),
    });
    const lazyBefore = report({
      frame: frame("terminal.c5240bc707b2179b.js", "2:10"),
    });
    const lazyAfter = report({
      frame: frame("terminal.0000000000000000.js", "2:44"),
    });

    expect(signatureOf(after)).toBe(signatureOf(before));
    expect(signatureOf(lazyAfter)).toBe(signatureOf(lazyBefore));
  });

  it("survives the numbers and links a message carries", () => {
    const at = (n: number, args: string) =>
      report({
        message: `Minified React error #${n}; visit https://react.dev/errors/${n}?args[]=${args} for the full message.`,
      });
    const reading = (id: string) =>
      report({
        message: `Cannot read properties of undefined (reading 'x') at ${id}`,
      });

    expect(signatureOf(at(418, "a"))).toBe(signatureOf(at(419, "b")));
    expect(signatureOf(reading("deadbeef12"))).toBe(
      signatureOf(reading("cafebabe34")),
    );
  });

  it("differs for another chunk or another message", () => {
    const page = report({
      frame: frame("app/page-0a1b2c3d4e5f6a7b.js", "1:2"),
    });

    expect(
      signatureOf(
        report({ frame: frame("app/layout-0a1b2c3d4e5f6a7b.js", "1:2") }),
      ),
    ).not.toBe(signatureOf(page));
    expect(signatureOf({ ...page, message: "y is not a function" })).not.toBe(
      signatureOf(page),
    );
  });
});

describe("issueTitle", () => {
  it("holds only the checked type and route", () => {
    expect(issueTitle(report({ route: "/pdf/[slug]" }))).toBe(
      "[client-error] TypeError on /pdf/[slug]",
    );
  });
});

describe("issueBody", () => {
  /** The lines between the message's opening fence and its closing one. */
  function fenced(body: string): { fence: string; inside: string[] } {
    const lines = body.split("\n");
    const open = lines.findIndex((line) => /^`{3,}text$/.test(line));
    const fence = lines[open].slice(0, -"text".length);
    const close = lines.findIndex((line, i) => i > open && line === fence);
    return { fence, inside: lines.slice(open + 1, close) };
  }

  it("puts the message, and only it, inside a code block", () => {
    const message =
      "@someone see [this](https://evil.example) <img src=x onerror=alert(1)> #1";
    const body = issueBody(report({ message }), deployment, "0a1b2c3d4e5f");

    expect(fenced(body).inside).toEqual([message]);
    // Outside the block, nothing a visitor wrote.
    expect(body.replace(message, "")).not.toMatch(/@someone|evil|onerror/);
  });

  it("fences the message longer than any backtick run in it", () => {
    for (const run of ["`", "```", "````", "``````````"]) {
      const message = `before ${run} after`;
      const { fence, inside } = fenced(
        issueBody(report({ message }), deployment, "0a1b2c3d4e5f"),
      );
      expect(fence.length).toBe(Math.max(3, run.length + 1));
      expect(inside).toEqual([message]);
    }
  });

  it("names the route, type, frame and deployment, and ends with the signature", () => {
    const body = issueBody(report(), deployment, "0a1b2c3d4e5f");
    expect(body).toContain("- Route: `/`");
    expect(body).toContain("- Type: `TypeError`");
    expect(body).toContain(
      "- Where: `/_next/static/chunks/app/page-0a1b2c.js:1:2345`",
    );
    expect(body).toContain("- Build: `7c48428` (production)");
    expect(body.endsWith(`\n${signatureLine("0a1b2c3d4e5f")}`)).toBe(true);
  });

  it("names the page's build, and the server's when they differ", () => {
    // A tab opened before a deploy runs the old build against the new one.
    const stale = issueBody(
      report({ build: "abc1234" }),
      deployment,
      "0a1b2c3d4e5f",
    );
    const unknown = issueBody(
      report({ build: null }),
      deployment,
      "0a1b2c3d4e5f",
    );

    expect(stale).toContain(
      "- Build: `abc1234` (served by `7c48428`, production)",
    );
    expect(unknown).toContain(
      "- Build: unknown (served by `7c48428`, production)",
    );
  });

  it("says so when there is no frame or no message", () => {
    const body = issueBody(
      report({ frame: null, message: "" }),
      deployment,
      "0a1b2c3d4e5f",
    );
    expect(body).toContain("- Where: not in the site's own chunks");
    expect(fenced(body).inside).toEqual(["(none)"]);
  });
});

describe("recurrenceComment", () => {
  it("names the route, the deployment and the time, not the message", () => {
    const comment = recurrenceComment(
      report({ route: "/pdf/[slug]", message: "@someone" }),
      deployment,
      new Date("2026-10-19T08:30:00.000Z"),
    );
    expect(comment).toBe(
      "Seen again on `/pdf/[slug]`, build `7c48428` (production), 2026-10-19T08:30:00.000Z.",
    );
  });
});
