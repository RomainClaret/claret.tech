// Utility functions for formatting data

/**
 * Converts bytes to human readable format
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.2 MB", "856 KB")
 */
export function formatFileSizeDisplay(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} KB`;
  }

  const megabytes = bytes / 1024;
  return `${megabytes.toFixed(1)} MB`;
}

/**
 * A date from the site's data or an API, in US English and in UTC, so every
 * visitor (and every test machine) reads the same day. Formatted in the
 * visitor's zone, a date-only value such as a kudos article's "2024-07-01"
 * (midnight UTC) read "Jun 30, 2024" west of UTC, and a post's evening
 * timestamp the next day east of it. Null for an empty or unreadable value.
 */
export function formatDate(
  value: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}
