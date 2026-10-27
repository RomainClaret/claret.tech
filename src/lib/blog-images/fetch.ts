import { isMediumImage } from "@/lib/blog-images/sources";

/**
 * Fetching a Medium picture on the server: /api/blog-image and the Medium
 * scraper's color step both fetch a URL that third-party content names, so
 * both keep it on Medium's image hosts, re-check every redirect hop, and
 * count the body as it arrives. A fetch that follows redirects on its own
 * would take a Medium-served 302 to any host (security audit run 1, 4.3).
 */

/** Above any real article image, and small enough that libvips cannot be fed a bomb. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** sharp's input limit for these pictures (its own default is 268 MP). */
export const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_REDIRECTS = 2;

/** A refused hop: a redirect off Medium's image hosts, or too many. */
export class UpstreamError extends Error {}

/** Fetches the image, following at most two redirects, each on Medium's image hosts. */
export async function fetchMediumImage(
  source: string,
  timeoutMs: number,
): Promise<Response> {
  if (!isMediumImage(source))
    throw new UpstreamError(`not an image host: ${source}`);
  const signal = AbortSignal.timeout(timeoutMs);
  let url = source;
  for (let hop = 0; ; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      cache: "no-store",
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    const next = location ? new URL(location, url).href : null;
    if (hop >= MAX_REDIRECTS || !next || !isMediumImage(next)) {
      throw new UpstreamError(`redirect to ${next ?? "nowhere"}`);
    }
    url = next;
  }
}

/** The body, or null past MAX_IMAGE_BYTES, counted as it arrives. */
export async function readCapped(response: Response): Promise<Buffer | null> {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
