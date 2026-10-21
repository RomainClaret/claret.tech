import { mediumUsername } from "@/lib/utils/medium-username";
import { parseMediumRss, type MediumRssItem } from "@/lib/utils/medium-rss";

/** One post of the feed (medium-rss.ts reads it). */
export type MediumFeedItem = Partial<MediumRssItem> &
  Pick<MediumRssItem, "title" | "link" | "pubDate"> & {
    /** Some feeds give a summary beside the post's HTML; Medium's do not. */
    description?: string;
  };

export interface MediumFeed {
  status?: string;
  items?: MediumFeedItem[];
  [key: string]: unknown;
}

/** An author's RSS feed on Medium. */
export const mediumFeedUrl = (username = mediumUsername()) =>
  `https://medium.com/feed/@${username}`;

/**
 * An author's Medium posts, from Medium's own RSS feed, cached by Next for
 * an hour. The blog section's API (/api/medium-posts) enriches the posts
 * with images and colours; /rss.xml reads them as they are, directly: it
 * used to call that API over HTTP, which cost every poll a request through
 * the rate limiter and the image scraping, and had a local or preview build
 * read production's API. Throws when the feed cannot be had.
 */
export async function fetchMediumFeed<T = MediumFeed>(
  username = mediumUsername(),
): Promise<T> {
  const response = await fetch(mediumFeedUrl(username), {
    // Cache for 1 hour
    next: { revalidate: 3600 },
    // Only on a cache miss: when Next refreshes a stale entry in the
    // background it drops the signal, so the routes reading this set a
    // maxDuration as well.
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Medium's feed answered ${response.status}`);
  }
  return { status: "ok", items: parseMediumRss(await response.text()) } as T;
}
