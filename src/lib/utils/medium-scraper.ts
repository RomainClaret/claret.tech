// Medium article scraper for extracting images and colors
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { logError } from "@/lib/utils/dev-logger";

interface MediumCacheEntry {
  image: string | null;
  color: string | null;
  title: string;
  fetchedAt: number;
  expiresAt: number;
}

interface MediumCache {
  [url: string]: MediumCacheEntry;
}

const CACHE_FILE = path.join(process.cwd(), "src/lib/utils/medium-cache.json");
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Load cache from file
async function loadCache(): Promise<MediumCache> {
  try {
    const data = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Save cache to file
async function saveCache(cache: MediumCache): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    logError(error, "Medium Scraper - Cache Save");
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
    "&nbsp;": " ",
  };
  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}

// Extract color from image buffer using server-side processing
async function extractColorFromImage(imageUrl: string): Promise<string | null> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());

    // Resize and get dominant color using sharp
    const { data, info } = await sharp(buffer)
      .resize(100, 100, { fit: "cover" }) // Resize for faster processing
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Simple dominant color extraction
    const channels = info.channels;

    let r = 0,
      g = 0,
      b = 0;
    let validPixels = 0;

    for (let i = 0; i < data.length; i += channels) {
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];

      // Skip very dark or very light pixels for better color extraction
      const brightness = (red + green + blue) / 3;
      if (brightness > 20 && brightness < 235) {
        r += red;
        g += green;
        b += blue;
        validPixels++;
      }
    }

    if (validPixels > 0) {
      r = Math.round(r / validPixels);
      g = Math.round(g / validPixels);
      b = Math.round(b / validPixels);

      // Calculate luminance to detect dark colors
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // If the color is too dark, brighten it significantly for better glow visibility
      if (luminance < 0.35) {
        // Convert to HSL for better brightness control
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const l = (max + min) / 2;
        const d = max - min;

        let h = 0;
        let s = 0;

        if (d !== 0) {
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

          switch (max) {
            case r / 255:
              h = ((g / 255 - b / 255) / d + (g < b ? 6 : 0)) / 6;
              break;
            case g / 255:
              h = ((b / 255 - r / 255) / d + 2) / 6;
              break;
            case b / 255:
              h = ((r / 255 - g / 255) / d + 4) / 6;
              break;
          }
        }

        // Increase lightness to at least 0.5 (50%) for dark colors
        const newL = Math.max(0.5, l * 1.8);
        // Boost saturation for more vibrant colors
        const newS = Math.min(1, s * 1.4);

        // Convert back to RGB
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };

        const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
        const p = 2 * newL - q;

        r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
        g = Math.round(hue2rgb(p, q, h) * 255);
        b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

        // Ensure minimum brightness for each channel (at least 80 for visibility)
        r = Math.max(80, r);
        g = Math.max(80, g);
        b = Math.max(80, b);
      } else {
        // For already bright colors, just boost saturation
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        if (delta > 30) {
          // Only boost if there's some color
          const boost = 1.3;
          const mid = (max + min) / 2;
          r = Math.min(255, Math.round(mid + (r - mid) * boost));
          g = Math.min(255, Math.round(mid + (g - mid) * boost));
          b = Math.min(255, Math.round(mid + (b - mid) * boost));
        }
      }

      return `rgb(${r}, ${g}, ${b})`;
    }

    return null;
  } catch (error) {
    logError(error, "Medium Scraper - Color Extraction");
    return null;
  }
}

// Check if an image URL is likely an avatar/profile picture
function isAvatarImage(url: string): boolean {
  // Common avatar patterns
  const avatarPatterns = [
    /resize:fill:96:96/i,
    /resize:fill:150:150/i,
    /resize:fill:152:152/i,
    /resize:fill:240:240/i,
    /resize:fill:304:304/i,
    /\/fit\/c\/\d{1,3}\/\d{1,3}\//i, // Small square images
    /profile/i,
    /avatar/i,
  ];

  return avatarPatterns.some((pattern) => pattern.test(url));
}

// Enhance image URL to get maximum quality
function enhanceImageQuality(imageUrl: string): string {
  // For miro.medium.com v2 API - use maximum quality
  if (imageUrl.includes("miro.medium.com/v2/")) {
    // Replace any resize:fit:{number} with resize:fit:2880 (highest tested resolution)
    imageUrl = imageUrl.replace(/resize:fit:\d+/, "resize:fit:2880");

    // If it has da:true, keep it as it indicates data article image
    if (!imageUrl.includes("da:true")) {
      // Add da:true for better quality if not present
      imageUrl = imageUrl.replace("/v2/", "/v2/da:true/");
    }

    return imageUrl;
  }

  // For cdn-images-X.medium.com
  if (imageUrl.includes("cdn-images-") && imageUrl.includes("/max/")) {
    // Upgrade to 2048px which is commonly supported
    return imageUrl.replace(/\/max\/\d+\//, "/max/2048/");
  }

  // For miro.medium.com max pattern
  if (imageUrl.includes("miro.medium.com/max/")) {
    return imageUrl.replace(/\/max\/\d+\//, "/max/2048/");
  }

  // For miro.medium.com without v2 (older format)
  if (imageUrl.includes("miro.medium.com/") && !imageUrl.includes("/v2/")) {
    // Try to convert to v2 format with high resolution
    const imageId = imageUrl.split("/").pop();
    if (imageId) {
      return `https://miro.medium.com/v2/resize:fit:2880/${imageId}`;
    }
  }

  return imageUrl;
}

// Extract image from Medium HTML content
function extractImageFromHTML(html: string): string | null {
  // First, try to find article images in the content (not meta tags)
  // Look for high-quality article images with specific patterns
  const articleImagePatterns = [
    // Article images with "da:true" flag (data article images)
    /https:\/\/miro\.medium\.com\/v2\/da:true\/resize:fit:\d+\/[^\s"'<>]+/gi,
    // Standard article images with larger dimensions
    /https:\/\/miro\.medium\.com\/v2\/resize:fit:[1-9]\d{3,}\/[^\s"'<>]+/gi,
    // CDN images with max size (usually article images)
    /https:\/\/cdn-images-\d+\.medium\.com\/max\/[1-9]\d{3,}\/[^\s"'<>]+/gi,
    // Miro medium with max pattern
    /https:\/\/miro\.medium\.com\/max\/[1-9]\d{3,}\/[^\s"'<>]+/gi,
  ];

  for (const pattern of articleImagePatterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      // Get the highest resolution version
      let bestImage = matches[0];
      let maxResolution = 0;

      for (const match of matches) {
        // Skip if it looks like an avatar
        if (isAvatarImage(match)) continue;

        // Extract resolution from different patterns
        let resolution = 0;
        const fitMatch = match.match(/resize:fit:(\d+)/);
        const maxMatch = match.match(/\/max\/(\d+)\//);

        if (fitMatch) {
          resolution = parseInt(fitMatch[1]);
        } else if (maxMatch) {
          resolution = parseInt(maxMatch[1]);
        }

        if (resolution > maxResolution) {
          maxResolution = resolution;
          bestImage = match;
        }
      }

      if (maxResolution > 0 && !isAvatarImage(bestImage)) {
        // Enhance the image quality before returning
        return enhanceImageQuality(decodeHTMLEntities(bestImage));
      }
    }
  }

  // Try to find any figure with img tag (article images are often in figures)
  const figurePattern =
    /<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/i;
  const figureMatch = html.match(figurePattern);
  if (figureMatch && figureMatch[1]) {
    let imageUrl = decodeHTMLEntities(figureMatch[1]);
    if (!isAvatarImage(imageUrl)) {
      if (imageUrl.startsWith("//")) {
        imageUrl = "https:" + imageUrl;
      }
      return enhanceImageQuality(imageUrl);
    }
  }

  // Try Twitter card image (often more reliable than OG for articles)
  const twitterImagePattern =
    /<meta\s+name=["']twitter:image:src["']\s+content=["']([^"']+)["']/i;
  const twitterMatch = html.match(twitterImagePattern);
  if (twitterMatch && twitterMatch[1]) {
    let imageUrl = decodeHTMLEntities(twitterMatch[1]);
    if (!isAvatarImage(imageUrl)) {
      if (imageUrl.startsWith("//")) {
        imageUrl = "https:" + imageUrl;
      }
      return enhanceImageQuality(imageUrl);
    }
  }

  // Last resort: Try Open Graph image (but check it's not an avatar)
  const ogImagePattern =
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i;
  const ogMatch = html.match(ogImagePattern);
  if (ogMatch && ogMatch[1]) {
    let imageUrl = decodeHTMLEntities(ogMatch[1]);
    if (!isAvatarImage(imageUrl)) {
      if (imageUrl.startsWith("//")) {
        imageUrl = "https:" + imageUrl;
      }
      return enhanceImageQuality(imageUrl);
    }
  }

  return null;
}

// Fetch and process Medium article
export async function fetchMediumArticle(articleUrl: string): Promise<{
  image: string | null;
  color: string | null;
}> {
  // Skip external API calls in CI environment
  if (process.env.SKIP_EXTERNAL_APIS === "true") {
    return { image: null, color: null };
  }

  // Load cache
  const cache = await loadCache();

  // Check if we have a valid cached entry
  const cached = cache[articleUrl];
  if (cached && cached.expiresAt > Date.now()) {
    return {
      image: cached.image,
      color: cached.color,
    };
  }

  try {
    // Fetch the Medium article page
    const response = await fetch(articleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Portfolio/1.0; +https://claret.tech)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Medium article: ${response.status}`);
    }

    const html = await response.text();
    const image = extractImageFromHTML(html);

    // Extract color from image if found
    let color: string | null = null;
    if (image) {
      color = await extractColorFromImage(image);
    }

    // Use fallback colors based on common Medium themes if no color extracted
    if (!color) {
      // Analyze content to determine category and assign color
      const text = html.toLowerCase();
      if (text.includes("artificial intelligence") || text.includes(" ai ")) {
        color = "rgb(59, 130, 246)"; // Blue for AI
      } else if (text.includes("science") || text.includes("research")) {
        color = "rgb(139, 92, 246)"; // Purple for research
      } else if (text.includes("story") || text.includes("writing")) {
        color = "rgb(236, 72, 153)"; // Pink for stories
      } else if (text.includes("tech") || text.includes("code")) {
        color = "rgb(16, 185, 129)"; // Emerald for tech
      } else {
        color = "rgb(251, 146, 60)"; // Orange as default
      }
    }

    // Extract title for cache
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch
      ? decodeHTMLEntities(titleMatch[1])
      : "Medium Article";

    // Update cache
    cache[articleUrl] = {
      image,
      color,
      title,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION,
    };

    await saveCache(cache);

    return { image, color };
  } catch (error) {
    logError(error, `Medium Scraper - Article Fetch: ${articleUrl}`);

    // If we have an expired cache entry, use it as fallback
    if (cached) {
      return {
        image: cached.image,
        color: cached.color,
      };
    }

    // Return default color if all else fails
    return {
      image: null,
      color: "rgb(107, 114, 128)", // Gray default
    };
  }
}

// Batch fetch articles
export async function fetchMediumArticles(
  articleUrls: string[],
): Promise<Map<string, { image: string | null; color: string | null }>> {
  const results = new Map<
    string,
    { image: string | null; color: string | null }
  >();

  // Process in parallel but with a limit to avoid rate limiting
  const BATCH_SIZE = 3;
  for (let i = 0; i < articleUrls.length; i += BATCH_SIZE) {
    const batch = articleUrls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const data = await fetchMediumArticle(url);
        return { url, data };
      }),
    );

    batchResults.forEach(({ url, data }) => {
      results.set(url, data);
    });

    // Small delay between batches to be respectful
    if (i + BATCH_SIZE < articleUrls.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

// Clear expired cache entries
export async function cleanMediumCache(): Promise<void> {
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

// Get all cached colors for client-side use
export async function getCachedColors(): Promise<{
  [key: string]: { color: string; image: string };
}> {
  const cache = await loadCache();
  const colors: { [key: string]: { color: string; image: string } } = {};

  for (const [url, entry] of Object.entries(cache)) {
    if (entry.color && entry.expiresAt > Date.now()) {
      colors[url] = {
        color: entry.color,
        image: entry.image || "",
      };
    }
  }

  return colors;
}
