import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request may force an expensive cache-bypassing refresh.
 *
 * Two routes accept a `?fresh`/`?refresh` flag that skips their cache and goes
 * out to a third party: publications hits Semantic Scholar, ORCID and Crossref
 * with in-request sleeps, and fetch-all-repos spends one authenticated GitHub
 * GraphQL call per 100 repositories against the owner's token. Neither is a
 * mutation, so this is not authentication; it is there so an anonymous caller
 * cannot make the site spend someone else's quota on demand, which the rate
 * limiter cannot prevent because it is per-instance and its key includes the
 * caller's own User-Agent.
 *
 * The key travels in a header rather than the query string: query strings are
 * recorded in access logs and leak through `Referer`.
 *
 * With no token configured, refresh is off entirely. That is the safer default
 * for a value that is absent in every environment until someone sets it.
 *
 * A missing or wrong key is not an error. The caller is served from cache
 * exactly as an ordinary request, so nothing external can tell the difference
 * or probe for whether a token is configured.
 */
export function mayForceRefresh(request: {
  headers: { get(name: string): string | null };
}): boolean {
  const expected = process.env.PUBLICATIONS_REFRESH_TOKEN;
  if (!expected) return false;

  const provided = request.headers.get("x-refresh-key");
  if (!provided) return false;

  // Compare in constant time. Length has to match first because
  // timingSafeEqual throws on differing lengths, and the length itself is not
  // a useful oracle for a value the caller cannot iterate on.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
