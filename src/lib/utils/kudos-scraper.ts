// Kudos article scraper for extracting images and metadata
import { promises as fs } from "fs";
import path from "path";
import { logError } from "@/lib/utils/dev-logger";

interface KudosImageCache {
  [url: string]: {
    image: string | null;
    fetchedAt: number;
    expiresAt: number;
  };
}

const CACHE_FILE = path.join(process.cwd(), "src/lib/utils/kudos-cache.json");
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Load cache from file
async function loadCache(): Promise<KudosImageCache> {
  try {
    const data = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Save cache to file
async function saveCache(cache: KudosImageCache): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    logError(error, "Kudos Scraper - Cache Save");
  }
}

// Decode HTML entities
function decodeHTMLEntities(text: string): string {
  const entities: { [key: string]: string } = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#x60;": "`",
    "&#x3D;": "=",
  };
  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}

// Extract image from HTML content
function extractImageFromHTML(html: string): string | null {
  // Try to find Unsplash images first (most common on Kudos)
  const unsplashPattern = /https:\/\/images\.unsplash\.com\/[^"'\s]*/gi;
  const unsplashMatches = html.match(unsplashPattern);
  if (unsplashMatches && unsplashMatches.length > 0) {
    // Get the highest quality version and decode HTML entities
    let imageUrl = decodeHTMLEntities(unsplashMatches[0]);
    // Ensure we get a good quality version
    if (!imageUrl.includes("w=")) {
      imageUrl += (imageUrl.includes("?") ? "&" : "?") + "w=1200&q=80";
    }
    return imageUrl;
  }

  // Try Open Graph image
  const ogImagePattern =
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i;
  const ogMatch = html.match(ogImagePattern);
  if (ogMatch && ogMatch[1]) {
    return decodeHTMLEntities(ogMatch[1]);
  }

  // Try Twitter card image
  const twitterImagePattern =
    /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i;
  const twitterMatch = html.match(twitterImagePattern);
  if (twitterMatch && twitterMatch[1]) {
    return decodeHTMLEntities(twitterMatch[1]);
  }

  // Try to find any image in a figure or article tag
  const figureImagePattern =
    /<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/i;
  const figureMatch = html.match(figureImagePattern);
  if (figureMatch && figureMatch[1]) {
    return decodeHTMLEntities(figureMatch[1]);
  }

  // Last resort: find any img tag
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;
  const imgMatch = html.match(imgPattern);
  if (imgMatch && imgMatch[1]) {
    // Skip tracking pixels and small images
    if (!imgMatch[1].includes("stat") && !imgMatch[1].includes("pixel")) {
      return decodeHTMLEntities(imgMatch[1]);
    }
  }

  return null;
}

// Fetch image from Kudos article URL
export async function fetchKudosImage(
  kudosUrl: string,
): Promise<string | null> {
  // Skip external API calls in CI environment
  if (process.env.SKIP_EXTERNAL_APIS === "true") {
    return null;
  }

  // Load cache
  const cache = await loadCache();

  // Check if we have a valid cached entry
  const cached = cache[kudosUrl];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.image;
  }

  try {
    // Fetch the Kudos page
    const response = await fetch(kudosUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Portfolio/1.0; +https://claret.tech)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Kudos page: ${response.status}`);
    }

    const html = await response.text();
    const image = extractImageFromHTML(html);

    // Update cache
    cache[kudosUrl] = {
      image,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION,
    };

    await saveCache(cache);

    return image;
  } catch (error) {
    logError(error, `Kudos Scraper - Image Fetch: ${kudosUrl}`);

    // If we have an expired cache entry, use it as fallback
    if (cached) {
      return cached.image;
    }

    return null;
  }
}

// Batch fetch images for multiple Kudos URLs
export async function fetchKudosImages(
  kudosUrls: string[],
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  // Process in parallel but with a limit to avoid rate limiting
  const BATCH_SIZE = 3;
  for (let i = 0; i < kudosUrls.length; i += BATCH_SIZE) {
    const batch = kudosUrls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const image = await fetchKudosImage(url);
        return { url, image };
      }),
    );

    batchResults.forEach(({ url, image }) => {
      results.set(url, image);
    });

    // Small delay between batches to be respectful
    if (i + BATCH_SIZE < kudosUrls.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

// Clear expired cache entries
export async function cleanCache(): Promise<void> {
  const cache = await loadCache();
  const now = Date.now();

  let cleaned = false;
  for (const url in cache) {
    if (cache[url].expiresAt < now) {
      delete cache[url];
      cleaned = true;
    }
  }

  if (cleaned) {
    await saveCache(cache);
  }
}
