import { Page } from "@playwright/test";

/**
 * Resource types to block for performance optimization
 */
export const BLOCKED_RESOURCE_TYPES = [
  "font", // Block web fonts for faster loading
  "media", // Block audio/video content
  "other", // Block miscellaneous resources
] as const;

/**
 * URLs to block for performance optimization
 */
export const BLOCKED_URLS = [
  // Analytics and tracking
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "facebook.com/tr",
  "connect.facebook.net",
  "google.com/ads",
  "googlesyndication.com",

  // Social media widgets
  "twitter.com/widgets",
  "platform.twitter.com",
  "linkedin.com/px",

  // External CDNs that might slow things down
  "cdnjs.cloudflare.com",
  "unpkg.com",

  // Third-party services that aren't essential for testing
  "hotjar.com",
  "fullstory.com",
  "intercom.io",
] as const;

/**
 * Configure resource blocking for performance optimization in CI
 * @param page - Playwright page instance
 * @param options - Configuration options
 */
export async function setupResourceBlocking(
  page: Page,
  options: {
    blockImages?: boolean;
    blockFonts?: boolean;
    blockAnalytics?: boolean;
    customBlockList?: string[];
  } = {},
) {
  const {
    blockImages = false,
    blockFonts = true,
    blockAnalytics = true,
    customBlockList = [],
  } = options;

  // Only enable resource blocking in CI for performance
  if (!process.env.CI) {
    return;
  }

  await page.route("**/*", async (route, request) => {
    const url = request.url();
    const resourceType = request.resourceType();

    // Block analytics and tracking
    if (
      blockAnalytics &&
      BLOCKED_URLS.some((blockedUrl) => url.includes(blockedUrl))
    ) {
      await route.abort();
      return;
    }

    // Block images if requested
    if (blockImages && resourceType === "image") {
      await route.abort();
      return;
    }

    // Block fonts if requested
    if (blockFonts && resourceType === "font") {
      await route.abort();
      return;
    }

    // Block custom URLs
    if (customBlockList.some((blockedUrl) => url.includes(blockedUrl))) {
      await route.abort();
      return;
    }

    // Allow all other requests
    await route.continue();
  });
}

/**
 * Setup lightweight resource blocking for performance tests
 * Blocks only non-essential resources while keeping functionality intact
 */
export async function setupLightweightBlocking(page: Page) {
  await setupResourceBlocking(page, {
    blockImages: false, // Keep images for visual tests
    blockFonts: true, // Block fonts for speed
    blockAnalytics: true, // Block tracking scripts
    customBlockList: [
      "facebook.com",
      "twitter.com",
      "linkedin.com",
      "instagram.com",
    ],
  });
}

/**
 * Setup aggressive resource blocking for navigation/accessibility tests
 * Blocks more resources for maximum speed when visuals aren't critical
 */
export async function setupAggressiveBlocking(page: Page) {
  await setupResourceBlocking(page, {
    blockImages: true, // Block images for speed
    blockFonts: true, // Block fonts for speed
    blockAnalytics: true, // Block tracking scripts
    customBlockList: [
      "youtube.com",
      "vimeo.com",
      "soundcloud.com",
      "spotify.com",
      "facebook.com",
      "twitter.com",
      "linkedin.com",
      "instagram.com",
    ],
  });
}
