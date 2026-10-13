/** One post as rss2json gives it. */
export interface MediumFeedItem {
  title: string;
  link: string;
  thumbnail?: string;
  content?: string;
  description?: string;
  pubDate: string;
  author?: string;
  guid?: string;
  categories?: string[];
}

export interface MediumFeed {
  status?: string;
  feed?: unknown;
  items?: MediumFeedItem[];
  [key: string]: unknown;
}

/**
 * An author's Medium feed as JSON (Medium's RSS through rss2json), cached by
 * Next for an hour. The blog section's API (/api/medium-posts) enriches its
 * posts with images and colours; /rss.xml reads it as it is, directly: it
 * used to call that API over HTTP, which cost every poll a request through
 * the rate limiter and the image scraping, and had a local or preview build
 * read production's API.
 */
export async function fetchMediumFeed<T = MediumFeed>(
  username = process.env.NEXT_PUBLIC_MEDIUM_USERNAME || "romainclaret",
): Promise<T> {
  const response = await fetch(
    `https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@${username}`,
    {
      // Cache for 1 hour
      next: { revalidate: 3600 },
    },
  );
  if (!response.ok) {
    throw new Error("Failed to fetch Medium posts");
  }
  return response.json();
}
