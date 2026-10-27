/**
 * Error reports from the error pages, published as issues in the site's
 * public repository (src/app/api/client-error/route.ts).
 *
 * Anyone can send one, so everything here is written for a public page:
 * the title holds only fields checked against fixed patterns, and the
 * message, the one free text, appears only inside a code block, where
 * GitHub renders no link, mention or markdown.
 */

import { createHash } from "node:crypto";

/** The repository the issues go to, and their label. */
export const ISSUE_REPO = "RomainClaret/claret.tech";
export const ISSUE_LABEL = "client-error";

export const REPORT_LIMITS = {
  /** A request body larger than this is refused. */
  bodyBytes: 4096,
  /** The message is cut to this many characters. */
  message: 300,
  /**
   * New issues a UTC day: exact for one instance (its slot is taken before
   * GitHub's count is read), and the threshold of GitHub's count of every
   * instance's reports. That count reserves nothing, so reports whose count
   * search runs before earlier creates are searchable can pass it.
   */
  newIssuesPerDay: 10,
  /**
   * Comments one instance posts in a UTC day. Anyone can resend an open
   * issue's error, read off the issue, so without it the comments grew
   * with the number of open issues.
   */
  commentsPerDay: 20,
  /** One comment per error and instance in this time, at most. */
  commentEveryMs: 60 * 60 * 1000,
  /**
   * GitHub searches one instance makes in a minute. GitHub allows 30, and
   * past them refuses with 403, after which the route goes quiet for
   * everyone; a report costs one or two.
   */
  searchesPerMinute: 20,
};

/** A report, checked: what may be published. */
export interface ClientErrorReport {
  /** The error's type: letters only, else "Error". */
  name: string;
  /** One line, at most REPORT_LIMITS.message characters: free text. */
  message: string;
  /** Where in the site's own chunks it was thrown, if it was. */
  frame: string | null;
  /** The page's route pattern, never its path. */
  route: string;
  /** The commit the page was built from, 7 hex, if the browser said. */
  build: string | null;
}

// C0 and C1 controls, and the two Unicode line and paragraph separators.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
// Invisible format characters (bidi overrides, zero-width ones) make the
// published text read other than it is, and a lone surrogate can make
// GitHub refuse the issue: dropped, not spaced.
const INVISIBLE =
  /\p{Cf}|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/gu;
// A dynamic route's chunks sit under its encoded segment (pdf/%5Bslug%5D).
const FRAME = /^\/_next\/static\/chunks\/[\w./%-]+\.js:\d{1,7}:\d{1,7}$/;

/** The route pattern of a page path: "/", "/pdf/[slug]", else "/(other)". */
export function routeOf(path: string): string {
  if (path === "/") return "/";
  if (/^\/pdf\/[\w-]{1,80}$/.test(path)) return "/pdf/[slug]";
  return "/(other)";
}

/** A report as sent, checked and cut; null if it is not an object. */
export function sanitizeReport(body: unknown): ClientErrorReport | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const { name, message, frame, path, build } = body as Record<string, unknown>;
  const line =
    typeof message === "string"
      ? message
          .replace(INVISIBLE, "")
          .replace(CONTROL, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  // Cut by character, not UTF-16 unit, so no character is cut in half.
  const characters = Array.from(line);
  return {
    name:
      typeof name === "string" && /^[A-Za-z]{1,40}$/.test(name)
        ? name
        : "Error",
    message:
      characters.length > REPORT_LIMITS.message
        ? `${characters.slice(0, REPORT_LIMITS.message - 1).join("")}…`
        : line,
    frame:
      typeof frame === "string" && FRAME.test(frame) && !frame.includes("..")
        ? frame
        : null,
    route: routeOf(typeof path === "string" ? path : ""),
    build:
      typeof build === "string" && /^[0-9a-f]{7,40}$/.test(build)
        ? build.slice(0, 7)
        : null,
  };
}

/**
 * A frame's chunk, without the content hash and the position every build
 * changes ("app/page-<16 hex>.js:1:2345", "1010.<16 hex>.js:3:4").
 */
export function chunkOf(frame: string | null): string {
  if (!frame) return "";
  return frame
    .replace(/:\d+:\d+$/, "")
    .replace(/[-.][0-9a-f]{16}(?=\.js$)/, "");
}

/** The message, with what changes between occurrences of a bug blanked. */
export function messageShape(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<hex>")
    .replace(/\d+/g, "0");
}

/**
 * The same bug gets the same 12 hex, from one deploy to the next: how a
 * recurrence finds its issue. Hashing the frame and the message as sent
 * opened a new issue on every deploy that changed the chunk, and for every
 * number in a message.
 */
export function signatureOf(report: ClientErrorReport): string {
  return createHash("sha256")
    .update(
      `${report.name}\n${messageShape(report.message)}\n${chunkOf(report.frame)}`,
    )
    .digest("hex")
    .slice(0, 12);
}

/** The line a recurrence searches the issues for. */
export const signatureLine = (signature: string) =>
  `client-error-signature: ${signature}`;

/** The issue's title: checked fields only. */
export function issueTitle(report: ClientErrorReport): string {
  return `[client-error] ${report.name} on ${report.route}`;
}

/** The deployment that received the report, as the server knows it. */
export interface Deployment {
  /** The commit the server was built from (next.config.mjs). */
  commit: string;
  environment: string;
}

/**
 * The build that ran into the error, and the one serving now: after a
 * deploy, a tab opened before it still runs the old code.
 */
function buildLine(report: ClientErrorReport, deployment: Deployment): string {
  const build = report.build ? `\`${report.build}\`` : "unknown";
  return report.build === deployment.commit
    ? `${build} (${deployment.environment})`
    : `${build} (served by \`${deployment.commit}\`, ${deployment.environment})`;
}

/** The issue's body; the message is fenced longer than any backtick run in it. */
export function issueBody(
  report: ClientErrorReport,
  deployment: Deployment,
  signature: string,
): string {
  const longestRun = Math.max(
    0,
    ...(report.message.match(/`+/g) ?? []).map((run) => run.length),
  );
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return [
    "An error page reported an error in a visitor's browser.",
    "",
    `- Route: \`${report.route}\``,
    `- Type: \`${report.name}\``,
    `- Where: ${report.frame ? `\`${report.frame}\`` : "not in the site's own chunks"}`,
    `- Build: ${buildLine(report, deployment)}`,
    "",
    "The message, as the browser sent it (unchecked):",
    "",
    `${fence}text`,
    report.message || "(none)",
    fence,
    "",
    signatureLine(signature),
  ].join("\n");
}

/** A closed issue's comment when the build serving now runs into it again. */
export function regressionComment(
  report: ClientErrorReport,
  deployment: Deployment,
  at: Date,
): string {
  return `Back on the build serving now, so reopened: seen on \`${report.route}\`, build ${buildLine(report, deployment)}, ${at.toISOString()}.`;
}

/** A recurrence's comment: nothing a visitor wrote. */
export function recurrenceComment(
  report: ClientErrorReport,
  deployment: Deployment,
  at: Date,
): string {
  return `Seen again on \`${report.route}\`, build ${buildLine(report, deployment)}, ${at.toISOString()}.`;
}
