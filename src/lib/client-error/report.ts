/**
 * The error pages' report of the error that stopped a page, sent to
 * /api/client-error (src/app/api/client-error/route.ts), which files it as
 * an issue in the site's public repository. In production builds only,
 * once per error and page load.
 */

/** What the server receives: it checks and cuts every field again. */
export interface ReportPayload {
  name: string;
  message: string;
  /** The first frame in the site's own chunks, as "/_next/...js:line:col". */
  frame: string | null;
  /** The page's path, without its query or hash. */
  path: string;
  /** The commit the page's code was built from (next.config.mjs). */
  build: string;
}

// Chrome writes "at f (https://host/_next/static/chunks/a.js:1:2)",
// Firefox and Safari "f@https://host/_next/static/chunks/a.js:1:2". The
// frame leaves out a query: Vercel's skew protection, on its paid plans
// (the site runs on Hobby, without it), ends chunk URLs in
// "?dpl=<deployment>". A dynamic route's chunks sit under its encoded
// segment, as in app/pdf/%5Bslug%5D/.
const CHUNK_FRAME =
  /(\/_next\/static\/chunks\/[\w./%-]+\.js)(?:\?[^\s:)]*)?:(\d+):(\d+)/;

/**
 * What was thrown, as an Error's fields. Next passes the boundaries
 * whatever was thrown: `throw null` made the report itself throw, inside
 * the error page, and a thrown string filed an issue named "undefined".
 */
function errorFields(thrown: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  if (thrown instanceof Error) return thrown;
  if (typeof thrown === "object" && thrown !== null) {
    const { name, message, stack } = thrown as Record<string, unknown>;
    if (typeof message === "string") {
      return {
        name: typeof name === "string" ? name : "Error",
        message,
        stack: typeof stack === "string" ? stack : undefined,
      };
    }
  }
  const what =
    thrown === null
      ? "null"
      : typeof thrown === "string"
        ? thrown
        : typeof thrown;
  return { name: "Error", message: `Thrown, not an Error: ${what}` };
}

export function reportPayload(error: unknown, path: string): ReportPayload {
  const { name, message, stack } = errorFields(error);
  const frame = stack?.match(CHUNK_FRAME);
  return {
    name: String(name),
    message: String(message).slice(0, 300),
    frame: frame ? `${frame[1]}:${frame[2]}:${frame[3]}` : null,
    path,
    build: process.env.BUILD_COMMIT ?? "unknown",
  };
}

const sent = new Map<string, Promise<boolean>>();

/**
 * Resolves to whether the error is on record (a 202), as the page may say.
 * Never throws: it runs inside the error pages.
 */
export function reportClientError(error: unknown): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return Promise.resolve(false);
  let body: string;
  try {
    body = JSON.stringify(reportPayload(error, window.location.pathname));
  } catch {
    return Promise.resolve(false);
  }
  const known = sent.get(body);
  if (known) return known;
  const result = fetch("/api/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    // The report says all it means to (the privacy policy's Error Reports):
    // no cookie, and no Referer, which held the page's full address.
    credentials: "omit",
    referrerPolicy: "no-referrer",
  })
    .then((response) => response.status === 202)
    .catch(() => false);
  sent.set(body, result);
  return result;
}
