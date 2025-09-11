/**
 * Utility functions for optimized image handling
 */

/**
 * Get optimized version of an image path
 * Simply returns the path as-is since our data already references .webp
 */
export function getOptimizedImagePath(originalPath: string): string {
  return originalPath;
}

/**
 * Generate blur data URL for image placeholders
 * This is a simple shimmer effect
 */
export function getBlurDataURL(): string {
  const shimmer = (w: number, h: number) => `
    <svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <linearGradient id="g">
          <stop stop-color="#f6f7f8" offset="20%" />
          <stop stop-color="#edeef1" offset="50%" />
          <stop stop-color="#f6f7f8" offset="70%" />
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="#f6f7f8" />
      <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
      <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
    </svg>`;

  const toBase64 = (str: string) =>
    typeof window === "undefined"
      ? Buffer.from(str).toString("base64")
      : window.btoa(str);

  return `data:image/svg+xml;base64,${toBase64(shimmer(700, 475))}`;
}

/**
 * Image optimization config for Next/Image
 */
export const imageOptimizationConfig = {
  quality: 85,
  formats: ["image/avif", "image/webp"] as const,
  minimumCacheTTL: 31536000, // 1 year
};

/**
 * Common image sizes for responsive loading
 */
export const imageSizes = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 320, height: 240 },
  medium: { width: 640, height: 480 },
  large: { width: 1024, height: 768 },
  full: { width: 1920, height: 1080 },
};
