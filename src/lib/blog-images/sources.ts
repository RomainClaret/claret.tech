import { createHash } from "node:crypto";
import { fetchMediumFeed, type MediumFeedItem } from "@/lib/utils/medium-feed";

/**
 * The blog's pictures, and only those: what /api/blog-image may fetch.
 *
 * Medium's images used to reach visitors through Next's image optimizer,
 * which allowed any image on Medium's hosts (and on Unsplash, jsDelivr and
 * any GitHub avatar). On Vercel's Hobby plan its 5,000 transformations a
 * month were anyone's to spend, and past them every image not yet cached
 * failed until the month ended. The route resizes an image only when the
 * Medium feed names it, so no outside URL can cost anything.
 */

const MEDIUM_IMAGE_HOSTS = new Set([
  "miro.medium.com",
  "cdn-images-1.medium.com",
  "cdn-images-2.medium.com",
]);

/**
 * An https image on one of Medium's image hosts: those origins exactly, so
 * no other port and no credentials.
 */
export function isMediumImage(url: string): boolean {
  try {
    const { protocol, hostname, port, username, password } = new URL(url);
    return (
      protocol === "https:" &&
      MEDIUM_IMAGE_HOSTS.has(hostname) &&
      port === "" &&
      username === "" &&
      password === ""
    );
  } catch {
    return false;
  }
}

/** The route's id for a source image: short, stable, and not the URL. */
export function blogImageId(source: string): string {
  return createHash("sha256").update(`v1:${source}`).digest("hex").slice(0, 16);
}

type PostImages = Pick<MediumFeedItem, "thumbnail" | "content" | "description">;

function imageSources(html: string | undefined): string[] {
  return [...(html ?? "").matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );
}

/**
 * A post's picture: its first image on Medium's hosts. The feed's posts also
 * hold a tracking pixel (medium.com/_/stat), which is not one.
 */
export function postImage(post: PostImages): string | null {
  const candidates = [
    post.thumbnail,
    ...imageSources(post.content),
    ...imageSources(post.description),
  ];
  return (
    candidates.find(
      (url): url is string => typeof url === "string" && isMediumImage(url),
    ) ?? null
  );
}

/** Where the blog shows a post's picture, or null when it has none. */
export function blogImagePath(post: PostImages): string | null {
  const source = postImage(post);
  return source ? `/api/blog-image/${blogImageId(source)}` : null;
}

/**
 * Every picture the blog shows, by id. The feed is cached for an hour
 * (medium-feed.ts), so this costs no request to Medium most of the time.
 */
export async function blogImageSources(): Promise<Map<string, string>> {
  const feed = await fetchMediumFeed();
  const sources = new Map<string, string>();
  for (const post of feed.items ?? []) {
    const source = postImage(post);
    if (source) sources.set(blogImageId(source), source);
  }
  return sources;
}
