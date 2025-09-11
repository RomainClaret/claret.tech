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
