import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { blogImageSources } from "@/lib/blog-images/sources";
import {
  MAX_IMAGE_PIXELS,
  fetchMediumImage,
  readCapped,
} from "@/lib/blog-images/fetch";
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
/** A month; an id names one source URL, and Medium's image URLs do not change. */
const CACHED = "public, max-age=2678400, s-maxage=2678400, immutable";

const refuse = (status: number) =>
  new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });

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
    upstream = await fetchMediumImage(source, 8_000);
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
    resized = await sharp(original, { limitInputPixels: MAX_IMAGE_PIXELS })
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
