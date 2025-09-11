/**
 * Extracts the first image URL from Medium post content
 * Medium RSS feeds include images in the HTML content
 */
export function extractMediumImage(content: string): string | null {
  if (!content || typeof content !== "string") {
    return null;
  }

  // Try to find img tag with src attribute
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    return imgMatch[1];
  }

  // Try to find Medium CDN URLs in the content
  // Medium uses specific CDN patterns
  const cdnPatterns = [
    /https:\/\/cdn-images-\d+\.medium\.com\/[^\s"'<>]+/i,
    /https:\/\/miro\.medium\.com\/[^\s"'<>]+/i,
    /https:\/\/cdn\.jsdelivr\.net\/[^\s"'<>]+/i,
  ];

  for (const pattern of cdnPatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // Try to find figure with img tag (common in Medium posts)
  const figureMatch = content.match(
    /<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
  );
  if (figureMatch && figureMatch[1]) {
    return figureMatch[1];
  }

  // Try to extract from noscript tag (Medium sometimes puts images there)
  const noscriptMatch = content.match(
    /<noscript>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
  );
  if (noscriptMatch && noscriptMatch[1]) {
    return noscriptMatch[1];
  }

  return null;
}

interface RSSItem {
  content?: string;
  thumbnail?: string;
  description?: string;
  enclosure?: {
    link: string;
    url?: string;
  };
  "media:thumbnail"?: {
    $: {
      url: string;
    };
  };
}

/**
 * Extracts thumbnail from Medium RSS item
 * Some RSS readers include thumbnail in a specific field
 */
export function extractMediumThumbnail(item: RSSItem): string | null {
  // Check for thumbnail field
  if (item.thumbnail && item.thumbnail !== "") {
    return item.thumbnail;
  }

  // Check for enclosure field (common in RSS)
  if (item.enclosure && item.enclosure.link) {
    return item.enclosure.link;
  }

  // Check if enclosure has url property
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }

  // Check for media:thumbnail
  if (item["media:thumbnail"] && item["media:thumbnail"].$.url) {
    return item["media:thumbnail"].$.url;
  }

  // Check content for images (most reliable for Medium)
  if (item.content) {
    return extractMediumImage(item.content);
  }

  // Check description for images as fallback
  if (item.description) {
    return extractMediumImage(item.description);
  }

  return null;
}

/**
 * Validates if a URL is a valid image URL
 */
export function isValidImageUrl(url: string | null): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    // Check if URL has image extension
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const hasImageExtension = imageExtensions.some((ext) =>
      urlObj.pathname.toLowerCase().endsWith(ext),
    );

    // Check if it's from known image CDNs
    const imageCDNs = [
      "cdn-images-1.medium.com",
      "cdn-images-2.medium.com",
      "miro.medium.com",
      "cdn.jsdelivr.net",
    ];
    const isFromImageCDN = imageCDNs.some((cdn) =>
      urlObj.hostname.includes(cdn),
    );

    return hasImageExtension || isFromImageCDN;
  } catch {
    return false;
  }
}
