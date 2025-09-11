// Conference/Journal logo detection utilities
import { getOptimizedImagePath } from "./image-utils";

/**
 * Normalize a venue name into potential logo file names
 * @param venue - The venue string (e.g., "GECCO Companion • 2024")
 * @returns Array of potential file names to check
 */
export function generateLogoFileNames(venue: string): string[] {
  if (!venue) return [];

  const fileNames: string[] = [];

  // Clean the venue string
  let cleanVenue = venue
    .toLowerCase()
    .replace(/[•·]/g, " ") // Replace bullets with spaces
    .replace(/,\s*/g, " ") // Replace commas with spaces
    .replace(/\s+on\s+\w+/g, "") // Remove "on November", "on December", etc.
    .replace(/\s+/g, " ") // Normalize multiple spaces
    .trim();

  // Extract year if present
  const yearMatch = cleanVenue.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : null;

  // Remove location information (e.g., "San Diego, CA")
  // Only remove actual US state abbreviations, not all 2-letter words
  const stateAbbreviations =
    /\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/gi;
  cleanVenue = cleanVenue.replace(stateAbbreviations, "");

  cleanVenue = cleanVenue.replace(/,?\s*\b[A-Za-z\s]+,/g, ""); // Remove city names with commas

  // Additional cleanup for location patterns like "san diego ca"
  cleanVenue = cleanVenue.replace(
    /\b(san\s+diego|los\s+angeles|new\s+york|washington|chicago|boston|seattle|portland|denver|miami|dallas|houston|atlanta|philadelphia|phoenix|detroit|minneapolis|st\s+louis|kansas\s+city|baltimore|cleveland|pittsburgh|cincinnati|milwaukee|new\s+orleans|las\s+vegas|salt\s+lake\s+city|san\s+francisco|san\s+jose|oakland|sacramento|fresno|long\s+beach|virginia\s+beach|colorado\s+springs|raleigh|omaha|miami\s+beach|oakland|tulsa|honolulu|anaheim|aurora|santa\s+ana|corpus\s+christi|riverside|lexington|stockton|st\s+petersburg|bakersfield|louisville|anchorage|durham|winston\s+salem|lubbock|madison|laredo|gilbert|norfolk|reno|hialeah|glendale|north\s+las\s+vegas|irving|chesapeake|fremont|chandler|baton\s+rouge|spokane|greensboro|tacoma|huntington\s+beach|des\s+moines|augusta|modesto|montgomery|aurora|yonkers|akron|little\s+rock|amarillo|columbus|oxnard|st\s+louis|salt\s+lake\s+city)\b/gi,
    "",
  ); // Remove common US city names

  // Final space normalization
  cleanVenue = cleanVenue.replace(/\s+/g, " ").trim();

  // Generate base name
  const baseName = cleanVenue
    .replace(/[^a-z0-9\s]/g, "") // Remove special characters
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/_+/g, "_") // Replace multiple underscores with single
    .replace(/^_|_$/g, ""); // Remove leading/trailing underscores

  // Try different combinations
  if (year) {
    // Remove year from baseName if it exists
    const baseWithoutYear = baseName
      .replace(new RegExp(`_?\\b${year}\\b_?`), "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    // Add various combinations
    fileNames.push(`${baseName}_logo`);
    fileNames.push(`${baseWithoutYear}_${year}_logo`);

    // Handle special cases like "40th annual meeting"
    if (baseName.includes("annual_meeting")) {
      // For neuroscience: should produce "40th_annual_meeting_of_neuroscience_2010_logo"
      fileNames.push(`${baseWithoutYear}_${year}_logo`);
    }
  } else {
    fileNames.push(`${baseName}_logo`);
  }

  // Try acronym-based names (e.g., GECCO)
  const acronymMatch = venue.match(/\b[A-Z]{3,}\b/);
  if (acronymMatch) {
    const acronym = acronymMatch[0].toLowerCase();
    if (year) {
      fileNames.push(`${acronym}_${year}_logo`);
    }
    fileNames.push(`${acronym}_logo`);
  }

  // Remove duplicates and return
  return [...new Set(fileNames)];
}

/**
 * Get the conference logo path if it exists
 * @param venue - The venue string
 * @param availableLogos - Set of available logo file names (without path)
 * @returns The logo path or null if not found
 */
export function getConferenceLogo(
  venue: string,
  availableLogos: Set<string>,
): string | null {
  const potentialNames = generateLogoFileNames(venue);

  // Check each potential name with WebP first, then fallback to original formats
  for (const name of potentialNames) {
    // Check WebP first
    if (availableLogos.has(`${name}.webp`)) {
      return `/images/${name}.webp`;
    }
    // Fallback to PNG
    if (availableLogos.has(`${name}.png`)) {
      return getOptimizedImagePath(`/images/${name}.png`);
    }
    // Fallback to JPG
    if (availableLogos.has(`${name}.jpg`)) {
      return getOptimizedImagePath(`/images/${name}.jpg`);
    }
  }

  return null;
}

// Pre-computed list of available conference logos
// This helps avoid runtime file system checks
export const AVAILABLE_CONFERENCE_LOGOS = new Set([
  "gecco_2024_logo.webp",
  "gecco_2024_logo.png",
  "gecco_2024_logo.jpg",
  "40th_annual_meeting_of_neuroscience_2010_logo.webp",
  "40th_annual_meeting_of_neuroscience_2010_logo.png",
  "40th_annual_meeting_of_neuroscience_2010_logo.jpg",
]);
