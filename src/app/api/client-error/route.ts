import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/utils/dev-logger";
import { withRateLimit } from "@/lib/utils/rate-limiter";
import {
  ISSUE_LABEL,
  ISSUE_REPO,
  REPORT_LIMITS,
  issueBody,
  issueTitle,
  recurrenceComment,
  regressionComment,
  sanitizeReport,
  signatureLine,
  signatureOf,
  type ClientErrorReport,
  type Deployment,
} from "@/lib/client-error/issue";

/**
 * POST /api/client-error: the error pages report the error that stopped a
 * page, and it becomes an issue in the site's public repository, or a
 * comment on the issue it already has. 202 says the error is on record;
 * 204, that nothing was filed (no GITHUB_ISSUES_TOKEN, as in CI and local
 * builds, the day's cap reached, or GitHub failing). No IP address, user
 * agent or cookie is kept with a report (src/lib/client-error/issue.ts).
 */

const GITHUB = "https://api.github.com";

// This instance's memory: the issue each error has (looked up again after
// the hour, so its state follows the owner's closing and reopening), when
// it last got a comment, and how many issues and comments it posted today.
interface KnownIssue {
  number: number;
  state: "open" | "closed";
  /** Locked by the owner: closed for good, whatever build reports it. */
  locked?: boolean;
  at: number;
}
const issues = new Map<string, KnownIssue>();
const lastComment = new Map<string, number>();
let today = "";
let openedToday = 0;
let commentedToday = 0;
// When this instance's recent GitHub searches ran, for its per-minute budget.
let searchedAt: number[] = [];

/** Takes one of the minute's searches, if one is left. */
function takeSearch(now: number): boolean {
  searchedAt = searchedAt.filter((at) => now - at < 60_000);
  if (searchedAt.length >= REPORT_LIMITS.searchesPerMinute) return false;
  searchedAt.push(now);
  return true;
}

// After GitHub refuses for its rate limits, no call until it says.
let quietUntil = 0;

const noContent = () => new NextResponse(null, { status: 204 });

/** A GitHub API failure, with its status. */
class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** How long GitHub asks to wait, from its headers; a minute when silent. */
function waitAsked(response: Response): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (retryAfter > 0) return retryAfter * 1000;
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (response.headers.get("x-ratelimit-remaining") === "0" && reset > 0) {
    return Math.max(0, reset * 1000 - Date.now());
  }
  return 60_000;
}

async function github(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const response = await fetch(`${GITHUB}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "claret.tech",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      quietUntil = Date.now() + waitAsked(response);
    }
    throw new GitHubError(
      `GitHub ${init.method ?? "GET"} ${path}: ${response.status}`,
      response.status,
    );
  }
  return response.json();
}

/**
 * A write to an issue GitHub may no longer have (deleted, or transferred):
 * the instance forgets it, so the next report looks again.
 */
async function writeToIssue(
  signature: string,
  write: () => Promise<unknown>,
): Promise<void> {
  try {
    await write();
  } catch (error) {
    if (error instanceof GitHubError && [404, 410].includes(error.status)) {
      issues.delete(signature);
    }
    throw error;
  }
}

/**
 * The reports opened today, by every instance: the daily cap's count. null
 * when there is none to trust (the minute's searches spent, or GitHub's
 * count incomplete or missing), which must not open an issue.
 */
async function openedOnGitHub(
  token: string,
  day: string,
  now: number,
): Promise<number | null> {
  if (!takeSearch(now)) return null;
  const query = `repo:${ISSUE_REPO} is:issue author:@me label:${ISSUE_LABEL} created:>=${day}`;
  const found = (await github(
    token,
    `/search/issues?per_page=1&q=${encodeURIComponent(query)}`,
  )) as { total_count?: number; incomplete_results?: boolean };
  if (found.incomplete_results || typeof found.total_count !== "number") {
    return null;
  }
  return found.total_count;
}

/**
 * The issue an error already has, open or closed, by its signature line,
 * which the route writes as an issue's last line. Only the site's own
 * reports count: anyone can open an issue holding a signature line, and it
 * would have taken the comments. "incomplete" when
 * GitHub's search ran out of time, which must not open a duplicate.
 */
async function findIssue(
  token: string,
  signature: string,
  now: number,
): Promise<KnownIssue | null | "incomplete"> {
  const known = issues.get(signature);
  if (known && now - known.at < REPORT_LIMITS.commentEveryMs) return known;
  if (!takeSearch(now)) return "incomplete";
  const line = signatureLine(signature);
  const query = `repo:${ISSUE_REPO} is:issue author:@me label:${ISSUE_LABEL} in:body "${line}"`;
  const found = (await github(
    token,
    `/search/issues?per_page=100&q=${encodeURIComponent(query)}`,
  )) as {
    incomplete_results?: boolean;
    items?: {
      number: number;
      state?: string;
      locked?: boolean;
      body?: string | null;
    }[];
  };
  // The route writes an issue's signature line last, and a report's message
  // is published in the same body: a decoy could carry another error's line
  // in its message. Only the last line names an issue's error.
  const item = found.items?.find((candidate) => {
    const lines = (candidate.body ?? "").replace(/\r\n/g, "\n").trimEnd();
    return lines === line || lines.endsWith(`\n${line}`);
  });
  if (!item) return found.incomplete_results ? "incomplete" : null;
  const issue: KnownIssue = {
    number: item.number,
    state: item.state === "closed" ? "closed" : "open",
    locked: item.locked === true,
    at: now,
  };
  issues.set(signature, issue);
  return issue;
}

/**
 * Takes one of the day's comments, if one is left. A slot is taken in the
 * same step as its check, after the GitHub search: reports in flight
 * together would otherwise all pass a check read before any of them filed.
 */
function takeComment(): boolean {
  if (commentedToday >= REPORT_LIMITS.commentsPerDay) return false;
  commentedToday++;
  return true;
}

/** Takes one of the day's new issues, if one is left (as takeComment). */
function takeOpen(): boolean {
  if (openedToday >= REPORT_LIMITS.newIssuesPerDay) return false;
  openedToday++;
  return true;
}

/** "filed": a new issue or a comment; "known": on record, no comment; "capped": nothing filed. */
async function fileReport(
  report: ClientErrorReport,
  token: string,
  deployment: Deployment,
  now: Date,
): Promise<"filed" | "known" | "capped"> {
  if (now.getTime() < quietUntil) return "capped";
  const day = now.toISOString().slice(0, 10);
  if (day !== today) {
    today = day;
    openedToday = 0;
    commentedToday = 0;
  }
  const canOpen = openedToday < REPORT_LIMITS.newIssuesPerDay;
  const canComment = commentedToday < REPORT_LIMITS.commentsPerDay;
  const signature = signatureOf(report);
  // Nothing could be filed today: GitHub is not asked, not even searched.
  if (!canOpen && !canComment && !issues.has(signature)) return "capped";

  const found = await findIssue(token, signature, now.getTime());
  if (found === "incomplete") return "capped";
  if (found?.state === "closed") {
    // Fixed and closed. From an older build, it is that bug, in a tab
    // opened before the fix: on record. From the build serving now, it is
    // back: reopened, and the workflow tells the owner, once an hour at
    // most, as for a comment.
    const last = lastComment.get(signature) ?? 0;
    const recent = now.getTime() - last < REPORT_LIMITS.commentEveryMs;
    // The build a page reports is public, so anyone can claim the serving
    // one: a closed issue the owner locked stays closed.
    if (
      found.locked ||
      report.build !== deployment.commit ||
      recent ||
      !takeComment()
    ) {
      return "known";
    }
    lastComment.set(signature, now.getTime());
    await writeToIssue(signature, () =>
      github(token, `/repos/${ISSUE_REPO}/issues/${found.number}`, {
        method: "PATCH",
        body: { state: "open" },
      }),
    );
    issues.set(signature, { ...found, state: "open", at: now.getTime() });
    await writeToIssue(signature, () =>
      github(token, `/repos/${ISSUE_REPO}/issues/${found.number}/comments`, {
        method: "POST",
        body: { body: regressionComment(report, deployment, now) },
      }),
    );
    return "filed";
  }
  if (found) {
    // On record either way; a comment once the hour is over, while the
    // day's comments last.
    const last = lastComment.get(signature) ?? 0;
    const recent = now.getTime() - last < REPORT_LIMITS.commentEveryMs;
    if (recent || !takeComment()) return "known";
    lastComment.set(signature, now.getTime());
    await writeToIssue(signature, () =>
      github(token, `/repos/${ISSUE_REPO}/issues/${found.number}/comments`, {
        method: "POST",
        body: { body: recurrenceComment(report, deployment, now) },
      }),
    );
    return "filed";
  }

  // Each instance counts its own, and GitHub counts them all: an instance
  // starts at zero, and Vercel runs as many as the traffic calls for.
  if (!takeOpen()) return "capped";
  let openedAll: number | null;
  try {
    openedAll = await openedOnGitHub(token, day, now.getTime());
  } catch (error) {
    // Nothing was filed: the slot goes back.
    openedToday--;
    throw error;
  }
  if (openedAll === null) {
    openedToday--;
    return "capped";
  }
  if (openedAll >= REPORT_LIMITS.newIssuesPerDay) {
    // Full on GitHub today: this instance stops asking.
    openedToday = REPORT_LIMITS.newIssuesPerDay;
    return "capped";
  }
  const created = (await github(token, `/repos/${ISSUE_REPO}/issues`, {
    method: "POST",
    body: {
      title: issueTitle(report),
      body: issueBody(report, deployment, signature),
      labels: [ISSUE_LABEL],
    },
  })) as { number: number };
  issues.set(signature, {
    number: created.number,
    state: "open",
    at: now.getTime(),
  });
  lastComment.set(signature, now.getTime());
  return "filed";
}

/**
 * The body as text, or null past REPORT_LIMITS.bodyBytes, counted as it
 * arrives: request.text() read a chunked body whole before measuring it.
 */
async function readBody(request: NextRequest): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) {
    const text = await request.text();
    return new TextEncoder().encode(text).length > REPORT_LIMITS.bodyBytes
      ? null
      : text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > REPORT_LIMITS.bodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function postHandler(request: NextRequest): Promise<NextResponse> {
  // Only the site's own pages report. A cross-site page could make its
  // visitors' browsers post text/plain, which needs no preflight, from as
  // many IPs as it has visitors; JSON from another origin needs one, which
  // this route never grants. Sec-Fetch-Site says the rest where present.
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) {
    return NextResponse.json({ error: "A report is JSON" }, { status: 415 });
  }
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") {
    return NextResponse.json({ error: "Not from this site" }, { status: 403 });
  }

  const token = process.env.GITHUB_ISSUES_TOKEN;
  if (!token) return noContent();

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > REPORT_LIMITS.bodyBytes) {
    return NextResponse.json({ error: "Report too large" }, { status: 413 });
  }
  const text = await readBody(request);
  if (text === null) {
    return NextResponse.json({ error: "Report too large" }, { status: 413 });
  }
  let report: ClientErrorReport | null;
  try {
    report = sanitizeReport(JSON.parse(text));
  } catch {
    report = null;
  }
  if (!report) {
    return NextResponse.json({ error: "Not a report" }, { status: 400 });
  }

  const deployment: Deployment = {
    commit: process.env.BUILD_COMMIT || "unknown",
    environment: process.env.VERCEL_ENV || "unknown",
  };
  try {
    const outcome = await fileReport(report, token, deployment, new Date());
    return outcome === "capped"
      ? noContent()
      : NextResponse.json({ reported: true }, { status: 202 });
  } catch (error) {
    logError(error, "Client error report");
    return noContent();
  }
}

// Five a minute per client, in a bucket of their own: each may open an
// issue in a public repository.
export const POST = withRateLimit(postHandler, {
  name: "client-error",
  maxRequests: 5,
});
