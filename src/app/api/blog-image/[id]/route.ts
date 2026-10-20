import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { blogImageSources, isMediumImage } from "@/lib/blog-images/sources";
import { withRateLimit } from "@/lib/utils/rate-limiter";

/**
 * A blog picture, resized on the site's own function: only an image the
 * Medium feed names (src/lib/blog-images/sources.ts), at the two widths the
 * card draws, so no outside URL can make it fetch or work. The visitor's
 * browser asks this site only, as the privacy policy says.
 */

// The upstream fetch has 8 s; the rest is the resize.
export const maxDuration = 30;

const ID = /^[0-9a-f]{16}$/;
/** The card's image box, 1x and 2x: 192 px tall, up to 440 px wide. */
const WIDTHS = new Set(["480", "960"]);
/** Above any real article image, and small enough that libvips cannot be fed a bomb. */
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 2;
/** A month; an id names one source URL, and Medium's image URLs do not change. */
const CACHED = "public, max-age=2678400, s-maxage=2678400, immutable";

const refuse = (status: number) =>
  new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });

class Upstream extends Error {}

/** Fetches the image, following at most two redirects, each on Medium's hosts. */
async function fetchSource(source: string): Promise<Response> {
  const signal = AbortSignal.timeout(8_000);
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
      throw new Upstream(`redirect to ${next ?? "nowhere"}`);
    }
    url = next;
  }
}

/** The body, or null past MAX_BYTES, counted as it arrives. */
async function readCapped(response: Response): Promise<Buffer | null> {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) {
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
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function handler(request: NextRequest): Promise<NextResponse> {
  // withRateLimit hands over the request only, so the id comes off the path.
  const id = request.nextUrl.pathname.split("/").pop() ?? "";
  if (!ID.test(id)) return refuse(404);

  const query = request.nextUrl.searchParams;
  const width = query.get("w");
  if ([...query.keys()].length !== 1 || !width || !WIDTHS.has(width)) {
    return refuse(400);
  }

  const source = (await blogImageSources()).get(id);
  if (!source) return refuse(404);

  let upstream: Response;
  try {
    upstream = await fetchSource(source);
  } catch (error) {
    // By name: a DOMException is not an Error in every realm.
    const timedOut =
      (error as { name?: unknown } | null)?.name === "TimeoutError";
    return refuse(timedOut ? 504 : 502);
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/") || type.includes("svg")) {
    return refuse(502);
  }

  const original = await readCapped(upstream);
  if (!original) return refuse(502);

  let resized: Buffer;
  try {
    resized = await sharp(original, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: Number(width), fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
  } catch {
    return refuse(502);
  }

  return new NextResponse(new Uint8Array(resized), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(resized.byteLength),
      "Cache-Control": CACHED,
    },
  });
}

// Sixty a minute per client in a bucket of its own: a page shows a few.
const limited = withRateLimit(handler, {
  name: "blog-image",
  maxRequests: 60,
});

export async function GET(request: NextRequest) {
  return limited(request);
}
