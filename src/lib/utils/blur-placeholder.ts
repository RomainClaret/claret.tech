// Utility to generate blur placeholders for images

/**
 * Generates a shimmer SVG blur placeholder
 * @param width - Width of the placeholder
 * @param height - Height of the placeholder
 * @returns Base64 encoded blur placeholder
 */
export function generateShimmerPlaceholder(
  width: number,
  height: number,
): string {
  const shimmer = `
    <svg width="${width}" height="${height}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <linearGradient id="g">
          <stop stop-color="#e5e7eb" offset="20%" />
          <stop stop-color="#f3f4f6" offset="50%" />
          <stop stop-color="#e5e7eb" offset="70%" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="#e5e7eb" />
      <rect id="r" width="${width}" height="${height}" fill="url(#g)" />
      <animate xlink:href="#r" attributeName="x" from="-${width}" to="${width}" dur="1s" repeatCount="indefinite"  />
    </svg>`;

  const toBase64 = (str: string) =>
    typeof window === "undefined"
      ? Buffer.from(str).toString("base64")
      : window.btoa(str);

  return `data:image/svg+xml;base64,${toBase64(shimmer)}`;
}

/**
 * Default blur placeholder for square images (e.g., logos)
 */
export const DEFAULT_BLUR_PLACEHOLDER = generateShimmerPlaceholder(64, 64);

/**
 * Default blur placeholder for rectangular images
 */
export const RECTANGLE_BLUR_PLACEHOLDER = generateShimmerPlaceholder(320, 180);
