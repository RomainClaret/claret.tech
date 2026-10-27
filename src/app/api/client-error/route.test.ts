import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { logError } from "@/lib/utils/dev-logger";
import {
  REPORT_LIMITS,
  sanitizeReport,
  signatureLine,
  signatureOf,
} from "@/lib/client-error/issue";

/**
 * The route publishes what anyone sends as an issue in a public repository,
 * so these tests pin what it files, how often, and what it never sends on.
 * GitHub is faked at fetch; each test imports the route afresh, as a new
 * server instance with nothing in memory.
 */

vi.mock("@/lib/utils/dev-logger", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
  devError: vi.fn(),
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

interface GitHubCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: {
    title?: string;
    body?: string;
    labels?: string[];
    state?: string;
  };
}

let calls: GitHubCall[];
// Issues the search finds besides the route's own: another instance's.
// Without a body of its own, an item's body ends with the line searched
// for, as a report the route filed does.
let searchItems: { number: number; state?: string; body?: string }[];
let searchIncomplete: boolean;
// The daily count's own incomplete_results.
let countIncomplete: boolean;
// The issues the route opened, which the search finds by signature line,
// as GitHub's does.
let opened: { number: number; body: string; state: string; day: string }[];
// Reports other instances opened today, for the cross-instance cap.
let othersToday: number;
let nextIssue: number;
let failing: (call: GitHubCall) => boolean;
// Seconds GitHub's rate limits ask to wait, while it refuses (429).
let limitedFor: number | null;
// Calls on something GitHub no longer has (404).
let gone: (call: GitHubCall) => boolean;
// Milliseconds GitHub takes to answer, on a real timer: 0 answers at once.
// A call's reads and writes take effect when it answers, so reports in
// flight together all see GitHub as it was before any of them.
let latencyMs: number;

const json = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

async function fakeGitHub(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  if (latencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
  }
  const call: GitHubCall = {
    url: String(input),
    method: init?.method ?? "GET",
    headers: init?.headers as Record<string, string>,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
  calls.push(call);
  if (limitedFor !== null) {
    return Promise.resolve(
      new Response(JSON.stringify({ message: "rate limited" }), {
        status: 429,
        headers: { "retry-after": String(limitedFor) },
      }),
    );
  }
  if (failing(call)) return json({ message: "Server Error" }, 500);
  if (gone(call)) return json({ message: "Not Found" }, 404);
  if (call.url.includes("/search/issues")) {
    const query = new URL(call.url).searchParams.get("q") ?? "";
    const since = /created:>=(\d{4}-\d{2}-\d{2})/.exec(query)?.[1];
    if (since) {
      return json({
        total_count:
          opened.filter((issue) => issue.day >= since).length + othersToday,
        items: [],
        incomplete_results: countIncomplete,
      });
    }
    const phrase = /"([^"]+)"/.exec(query)?.[1] ?? "";
    // GitHub matches the phrase anywhere in a body, and answers each item
    // with its body.
    const own = opened
      .filter((issue) => issue.body.includes(phrase))
      .map(({ number, state, body }) => ({ number, state, body }));
    const others = searchItems
      .map((item) => ({ ...item, body: item.body ?? `...\n${phrase}` }))
      .filter((item) => item.body.includes(phrase));
    return json({
      items: [...own, ...others],
      incomplete_results: searchIncomplete,
    });
  }
  if (call.url.endsWith("/comments")) return json({ id: 1 }, 201);
  if (call.url.endsWith("/issues")) {
    const number = nextIssue++;
    opened.push({
      number,
      body: call.body?.body ?? "",
      state: "open",
      day: new Date().toISOString().slice(0, 10),
    });
    return json({ number }, 201);
  }
  const patched = /\/issues\/(\d+)$/.exec(call.url);
  if (patched && call.method === "PATCH") {
    return json({ number: Number(patched[1]), state: call.body?.state });
  }
  return json({ message: "Not Found" }, 404);
}

const REPO = "https://api.github.com/repos/RomainClaret/claret.tech";

const report = {
  name: "TypeError",
  message: "x is not a function",
  frame: "/_next/static/chunks/app/page-0a1b2c.js:1:2345",
  path: "/pdf/neat-for-xor",
  build: "7c48428",
};

function reportRequest(
  body: unknown,
  {
    ip = "10.1.0.1",
    raw,
    headers = {},
  }: { ip?: string; raw?: string; headers?: Record<string, string> } = {},
) {
  const text = vi.fn(async () => raw ?? JSON.stringify(body));
  const request = {
    headers: new Headers({
      "content-type": "application/json",
      "x-real-ip": ip,
      "user-agent": "vitest",
      ...headers,
    }),
    text,
  } as unknown as NextRequest;
  return { request, text };
}

/**
 * Distinct errors for the cap tests: a word per number, since a signature
 * ignores the digits in a message (one bug, one issue).
 */
const errorNumbered = (n: number) => ({
  ...report,
  message: `error ${[...n.toString(26)].map((d) => String.fromCharCode(97 + parseInt(d, 26))).join("")}`,
});

/**
 * Reports a few seconds apart, as real ones arrive: the cap tests send more
 * than a minute's GitHub searches (REPORT_LIMITS.searchesPerMinute).
 */
const later = () => vi.setSystemTime(Date.now() + 7_000);

describe("POST /api/client-error", () => {
  let POST: typeof import("./route").POST;
  const send = async (
    body: unknown,
    options?: Parameters<typeof reportRequest>[1],
  ) => POST(reportRequest(body, options).request);

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("GITHUB_ISSUES_TOKEN", "test-issues-token");
    // next.config.mjs inlines it at build time.
    vi.stubEnv("BUILD_COMMIT", "7c48428");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubGlobal("fetch", vi.fn(fakeGitHub));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T08:00:00.000Z"));
    calls = [];
    searchItems = [];
    searchIncomplete = false;
    countIncomplete = false;
    opened = [];
    othersToday = 0;
    limitedFor = null;
    gone = () => false;
    latencyMs = 0;
    nextIssue = 7;
    failing = () => false;
    ({ POST } = await import("./route"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("files nothing without a token, as in CI and local builds", async () => {
    vi.stubEnv("GITHUB_ISSUES_TOKEN", "");

    const response = await send(report);

    expect(response.status).toBe(204);
    expect(fetch).not.toHaveBeenCalled();
  });

  it(`refuses a body over ${REPORT_LIMITS.bodyBytes} bytes, declared or not`, async () => {
    const declared = reportRequest(report, {
      headers: { "content-length": String(REPORT_LIMITS.bodyBytes + 1) },
    });
    expect((await POST(declared.request)).status).toBe(413);
    expect(declared.text).not.toHaveBeenCalled();

    const raw = JSON.stringify({ ...report, message: "x".repeat(5000) });
    expect((await send(null, { raw })).status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops reading a body past the limit, with no length declared", async () => {
    // request.text() read a chunked body whole before measuring it.
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 64) controller.close();
        else controller.enqueue(new Uint8Array(1024).fill(120));
      },
    });
    const { request, text } = reportRequest(report);
    Object.assign(request, { body });

    expect((await POST(request)).status).toBe(413);
    expect(text).not.toHaveBeenCalled();
    expect(pulled).toBeLessThanOrEqual(7);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a report that is not JSON", async () => {
    // text/plain needs no preflight: a cross-site page could post it from
    // every visitor's browser.
    const response = await send(report, {
      headers: { "content-type": "text/plain" },
    });

    expect(response.status).toBe(415);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a report another site's page sent", async () => {
    for (const site of ["cross-site", "same-site", "none"]) {
      const response = await send(report, {
        headers: { "sec-fetch-site": site },
      });
      expect(response.status).toBe(403);
    }
    expect(fetch).not.toHaveBeenCalled();

    const own = await send(report, {
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(own.status).toBe(202);
  });

  it(`measures the ${REPORT_LIMITS.bodyBytes}-byte limit in bytes`, async () => {
    // 2,150 characters, more than 4,096 bytes in UTF-8.
    const raw = JSON.stringify({ ...report, message: "é".repeat(2100) });
    expect(raw.length).toBeLessThan(REPORT_LIMITS.bodyBytes);

    expect((await send(null, { raw })).status).toBe(413);
  });

  it("refuses what is not a report", async () => {
    for (const raw of ["not json", "[1,2]", "null", '"TypeError"']) {
      expect((await send(null, { raw })).status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("opens an issue for a new error", async () => {
    const response = await send(report);

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ reported: true });
    const signature = signatureOf(sanitizeReport(report)!);
    const [search, count, create] = calls;
    expect(calls).toHaveLength(3);
    expect(new URL(count.url).searchParams.get("q")).toBe(
      "repo:RomainClaret/claret.tech is:issue author:@me label:client-error created:>=2026-10-19",
    );

    expect(search.method).toBe("GET");
    const query = new URL(search.url).searchParams.get("q");
    expect(query).toBe(
      `repo:RomainClaret/claret.tech is:issue author:@me label:client-error in:body "${signatureLine(signature)}"`,
    );

    expect(create.url).toBe(`${REPO}/issues`);
    expect(create.method).toBe("POST");
    expect(create.headers.Authorization).toBe("Bearer test-issues-token");
    expect(create.body?.title).toBe("[client-error] TypeError on /pdf/[slug]");
    expect(create.body?.labels).toEqual(["client-error"]);
    expect(create.body?.body).toContain("```text\nx is not a function\n```");
    expect(create.body?.body).toContain("- Build: `7c48428` (production)");
    expect(create.body?.body).toContain(signatureLine(signature));
  });

  it("names the build the page ran, not only the one serving", async () => {
    // A tab opened before a deploy reports into the next deployment.
    await send({
      ...report,
      build: "abc1234def5678abc1234def5678abc1234def56",
    });

    expect(calls[2].body?.body).toContain(
      "- Build: `abc1234` (served by `7c48428`, production)",
    );
  });

  it("sends GitHub nothing about the visitor", async () => {
    await send(report, {
      ip: "203.0.113.9",
      headers: { "user-agent": "Visitor/1.0", cookie: "session=abc123" },
    });

    expect(calls).toHaveLength(3);
    const sent = JSON.stringify(calls);
    for (const visitor of [
      "203.0.113.9",
      "Visitor/1.0",
      "session=abc123",
      "neat-for-xor",
    ]) {
      expect(sent).not.toContain(visitor);
    }
  });

  it("answers a recurrence within the hour from memory", async () => {
    await send(report);
    vi.setSystemTime(new Date("2026-10-19T08:59:59.000Z"));

    const response = await send(report, { ip: "10.1.0.2" });

    expect(response.status).toBe(202);
    expect(calls).toHaveLength(3);
  });

  it("comments on a recurrence once the hour is over", async () => {
    await send(report);
    vi.setSystemTime(new Date("2026-10-19T09:00:00.000Z"));

    const response = await send({ ...report, path: "/" }, { ip: "10.1.0.2" });

    // After the hour the issue is looked up again, so a close or a reopen
    // by the owner shows.
    expect(response.status).toBe(202);
    expect(calls.map((call) => call.method)).toEqual([
      "GET",
      "GET",
      "POST",
      "GET",
      "POST",
    ]);
    expect(calls[4].url).toBe(`${REPO}/issues/7/comments`);
    expect(calls[4].body?.body).toBe(
      "Seen again on `/`, build `7c48428` (production), 2026-10-19T09:00:00.000Z.",
    );
  });

  it("searches only the site's own reports, closed ones too", async () => {
    // Anyone can open an issue holding a signature line; only the
    // owner's labeled reports count, open or closed.
    await send(report);

    const query = new URL(calls[0].url).searchParams.get("q") ?? "";
    expect(query).toContain("author:@me label:client-error");
    expect(query).not.toContain("is:open");
  });

  it("leaves a closed issue alone for a report from an older build", async () => {
    // A tab opened before the fix: the error is on record, and closed.
    searchItems = [{ number: 12, state: "closed" }];

    const response = await send({ ...report, build: "abc1234" });

    expect(response.status).toBe(202);
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("reopens a closed issue the build serving now runs into", async () => {
    searchItems = [{ number: 12, state: "closed" }];

    const response = await send({ ...report, build: "7c48428" });

    expect(response.status).toBe(202);
    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["GET", expect.stringContaining("/search/issues")],
      ["PATCH", `${REPO}/issues/12`],
      ["POST", `${REPO}/issues/12/comments`],
    ]);
    expect(calls[1].body).toEqual({ state: "open" });
    expect(calls[2].body?.body).toMatch(/^Back on the build serving now/);
  });

  it("opens nothing when GitHub's search came back incomplete", async () => {
    searchIncomplete = true;

    const response = await send(report);

    expect(response.status).toBe(204);
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("takes no issue whose own signature line is another's", async () => {
    // A report's message is published in its issue's body, so a decoy can
    // carry another error's signature line, inside its fenced message. Only
    // the line the route writes last names an issue's error (security audit
    // run 1, lead 18).
    const target = signatureLine(signatureOf(sanitizeReport(report)!));
    searchItems = [
      {
        number: 40,
        body: `\`\`\`text\nx ${target}\n\`\`\`\n\n${signatureLine("0123456789ab")}`,
      },
    ];

    const response = await send(report);

    expect(response.status).toBe(202);
    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["GET", expect.stringContaining("/search/issues")],
      ["GET", expect.stringContaining("/search/issues")],
      ["POST", `${REPO}/issues`],
    ]);
  });

  it("finds the issue whose last line is its signature, wherever GitHub ranks it", async () => {
    const target = signatureLine(signatureOf(sanitizeReport(report)!));
    searchItems = [
      { number: 40, body: `decoy ${target}\n${signatureLine("0123456789ab")}` },
      { number: 41, body: `the error\r\n${target}\r\n` },
    ];

    await send(report);

    expect(calls.at(-1)?.url).toBe(`${REPO}/issues/41/comments`);
  });

  it("comments on the issue another instance opened", async () => {
    searchItems = [{ number: 12 }];

    const response = await send(report);

    expect(response.status).toBe(202);
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST"]);
    expect(calls[1].url).toBe(`${REPO}/issues/12/comments`);
  });

  it(`opens at most ${REPORT_LIMITS.newIssuesPerDay} issues a UTC day`, async () => {
    const opened = () =>
      calls.filter((call) => call.url === `${REPO}/issues`).length;
    const error = errorNumbered;

    for (let n = 0; n < REPORT_LIMITS.newIssuesPerDay; n++) {
      expect((await send(error(n), { ip: `10.2.0.${n}` })).status).toBe(202);
    }
    expect(opened()).toBe(REPORT_LIMITS.newIssuesPerDay);

    const capped = await send(error(99), { ip: "10.2.1.0" });
    expect(capped.status).toBe(204);
    expect(opened()).toBe(REPORT_LIMITS.newIssuesPerDay);

    vi.setSystemTime(new Date("2026-10-20T00:00:00.000Z"));
    expect((await send(error(99), { ip: "10.2.1.1" })).status).toBe(202);
    expect(opened()).toBe(REPORT_LIMITS.newIssuesPerDay + 1);
  });

  it(`posts at most ${REPORT_LIMITS.commentsPerDay} comments a UTC day, then asks GitHub nothing it cannot file`, async () => {
    // Anyone can resend an open issue's error: read off the issue.
    const comments = () =>
      calls.filter((call) => call.url.endsWith("/comments")).length;
    const error = errorNumbered;
    searchItems = [{ number: 12 }];

    for (let n = 0; n < REPORT_LIMITS.commentsPerDay; n++) {
      later();
      expect((await send(error(n), { ip: `10.3.0.${n}` })).status).toBe(202);
    }
    expect(comments()).toBe(REPORT_LIMITS.commentsPerDay);

    // Still on record, so still a 202, but no comment.
    later();
    expect((await send(error(50), { ip: "10.3.1.0" })).status).toBe(202);
    expect(comments()).toBe(REPORT_LIMITS.commentsPerDay);

    searchItems = [];
    for (let n = 0; n < REPORT_LIMITS.newIssuesPerDay; n++) {
      later();
      await send(error(100 + n), { ip: `10.3.2.${n}` });
    }
    const asked = calls.length;
    expect((await send(error(200), { ip: "10.3.3.0" })).status).toBe(204);
    expect(calls).toHaveLength(asked);
  });

  describe("reports in flight together", () => {
    // A parallel burst from one machine, each report from its own client
    // (the limiter keys on address and User-Agent), all within one GitHub
    // round-trip: the caps must hold for any arrival order.
    const burst = (bodies: unknown[], net: number) =>
      Promise.all(
        bodies.map((body, n) => send(body, { ip: `10.9.${net}.${n}` })),
      );
    const count = (match: (call: GitHubCall) => boolean) =>
      calls.filter(match).length;

    // These test the daily caps, which a burst passes only by more than a
    // minute's searches: the search budget has its own test.
    // The route's own copy: each test imports it, and its modules, afresh.
    beforeEach(async () => {
      latencyMs = 20;
      const issue = await import("@/lib/client-error/issue");
      issue.REPORT_LIMITS.searchesPerMinute = 1000;
    });

    it(`open at most ${REPORT_LIMITS.newIssuesPerDay} issues`, async () => {
      await burst(
        Array.from({ length: 15 }, (_, n) => errorNumbered(n)),
        1,
      );
      expect(
        count(
          (call) => call.url === `${REPO}/issues` && call.method === "POST",
        ),
      ).toBe(REPORT_LIMITS.newIssuesPerDay);
    });

    it(`post at most ${REPORT_LIMITS.commentsPerDay} comments`, async () => {
      searchItems = [{ number: 12 }];
      await burst(
        Array.from({ length: 30 }, (_, n) => errorNumbered(n)),
        2,
      );
      expect(count((call) => call.url.endsWith("/comments"))).toBe(
        REPORT_LIMITS.commentsPerDay,
      );
    });

    it("reopen a closed issue once, with one comment, within the hour", async () => {
      searchItems = [{ number: 12, state: "closed" }];
      await burst(
        Array.from({ length: 10 }, () => ({ ...report, build: "7c48428" })),
        3,
      );
      expect(count((call) => call.method === "PATCH")).toBe(1);
      expect(count((call) => call.url.endsWith("/comments"))).toBe(1);
    });
  });

  it("gives a new-issue slot back when GitHub's count fails", async () => {
    // Nothing was filed: ten failed counts must not use up the day.
    failing = (call) => call.url.includes("created%3A%3E%3D");
    for (let n = 0; n < REPORT_LIMITS.newIssuesPerDay; n++) {
      later();
      expect((await send(errorNumbered(n), { ip: `10.8.0.${n}` })).status).toBe(
        204,
      );
    }
    failing = () => false;
    later();
    expect((await send(errorNumbered(50), { ip: "10.8.1.0" })).status).toBe(
      202,
    );
    expect(calls.at(-1)?.url).toBe(`${REPO}/issues`);
  });

  it("opens nothing when GitHub's count came back incomplete", async () => {
    // A count that timed out is not a count: the day may be full.
    countIncomplete = true;

    const response = await send(report);

    expect(response.status).toBe(204);
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
  });

  it("keeps its GitHub searches under GitHub's limit", async () => {
    // GitHub allows 30 searches a minute; past them it refuses with 403 and
    // the route goes quiet for everyone. Each report costs one or two.
    searchItems = [{ number: 12 }];
    for (let n = 0; n < 30; n++) {
      await send(errorNumbered(n), { ip: `10.7.0.${n}` });
    }
    const searches = calls.filter((call) => call.url.includes("/search/"));
    expect(searches.length).toBeLessThanOrEqual(
      REPORT_LIMITS.searchesPerMinute,
    );
    expect(REPORT_LIMITS.searchesPerMinute).toBeLessThan(30);
  });

  it("counts the reports every instance opened today", async () => {
    // A fresh instance counts zero; GitHub counts them all.
    othersToday = REPORT_LIMITS.newIssuesPerDay;

    const response = await send(report);

    expect(response.status).toBe(204);
    expect(calls.map((call) => call.method)).toEqual(["GET", "GET"]);
  });

  it("goes quiet while GitHub limits the token", async () => {
    limitedFor = 120;
    expect((await send(report)).status).toBe(204);
    expect(calls).toHaveLength(1);

    limitedFor = null;
    vi.setSystemTime(new Date("2026-10-19T08:01:59.000Z"));
    expect((await send(report, { ip: "10.1.0.2" })).status).toBe(204);
    expect(calls).toHaveLength(1);

    vi.setSystemTime(new Date("2026-10-19T08:02:01.000Z"));
    expect((await send(report, { ip: "10.1.0.3" })).status).toBe(202);
    expect(calls).toHaveLength(4);
  });

  it("forgets an issue GitHub no longer has", async () => {
    await send(report);
    // The owner deleted it: the comment's write fails with a 404.
    opened = [];
    vi.setSystemTime(new Date("2026-10-19T09:00:00.000Z"));
    searchItems = [{ number: 7 }];
    gone = (call) => call.url.endsWith("/issues/7/comments");
    expect((await send(report, { ip: "10.1.0.2" })).status).toBe(204);

    searchItems = [];
    gone = () => false;
    const again = await send(report, { ip: "10.1.0.3" });

    expect(again.status).toBe(202);
    expect(calls.at(-1)?.url).toBe(`${REPO}/issues`);
  });

  it("answers 204 and logs when GitHub fails", async () => {
    failing = (call) => call.url.includes("/search/issues");
    const searchFails = await send(report);

    failing = (call) => call.url === `${REPO}/issues`;
    const createFails = await send(report, { ip: "10.1.0.2" });

    expect(searchFails.status).toBe(204);
    expect(createFails.status).toBe(204);
    expect(logError).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(logError).mock.calls[0][0])).toContain("500");
  });

  it("takes five reports a minute from one client", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await send(report)).status);

    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
    expect(calls).toHaveLength(3);
  });
});
