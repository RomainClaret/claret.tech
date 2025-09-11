interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Parse date string into Date object
 * Handles formats like:
 * - "Sep. 2023" -> September 1, 2023
 * - "2023" -> January 1, 2023
 * - "Present" -> Current date
 */
function parseDate(dateStr: string): Date {
  const cleaned = dateStr.trim();

  if (cleaned.toLowerCase() === "present") {
    return new Date();
  }

  // Handle year-only format (e.g., "2023")
  if (/^\d{4}$/.test(cleaned)) {
    return new Date(parseInt(cleaned), 0, 1); // January 1st of that year
  }

  // Handle month + year format (e.g., "Sep. 2023", "September 2023", "July 2017")
  const monthYearMatch = cleaned.match(/^(\w+)\.?\s+(\d{4})$/);
  if (monthYearMatch) {
    const [, monthStr, yearStr] = monthYearMatch;
    const monthMap: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };

    const monthLower = monthStr.toLowerCase();
    const month = monthMap[monthLower];

    if (month !== undefined) {
      return new Date(parseInt(yearStr), month, 1);
    }
  }

  // Fallback: try to parse as is
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Parse date range string into start and end dates
 * Handles formats like:
 * - "Sep. 2023 - Present"
 * - "2020 - 2022"
 * - "May 2010 - Aug. 2010"
 */
function parseDateRange(dateStr: string): DateRange | null {
  // Handle single year or comma-separated years (for internships)
  if (dateStr.includes(",")) {
    // For internships like "2004, 2005, 2006, 2012"
    // We'll count this as discrete periods
    return null; // Handle these separately
  }

  const parts = dateStr.split("-").map((s) => s.trim());
  if (parts.length !== 2) {
    // Try to handle single year
    if (/^\d{4}$/.test(dateStr.trim())) {
      const year = parseInt(dateStr.trim());
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31),
      };
    }
    return null;
  }

  const [startStr, endStr] = parts;
  const start = parseDate(startStr);
  const end = parseDate(endStr);

  return { start, end };
}

/**
 * Parse internship years (comma-separated) into multiple ranges
 */
function parseInternshipYears(dateStr: string): DateRange[] {
  if (!dateStr.includes(",")) {
    const range = parseDateRange(dateStr);
    return range ? [range] : [];
  }

  // Handle "2004, 2005, 2006, 2012" format
  const years = dateStr
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{4}$/.test(s));

  // Assume each internship was about 3 months (reasonable for summer internships)
  return years.map((yearStr) => {
    const year = parseInt(yearStr);
    return {
      start: new Date(year, 5, 1), // June 1
      end: new Date(year, 8, 30), // September 30 (3 months later)
    };
  });
}

/**
 * Merge overlapping date ranges
 */
function mergeOverlappingRanges(ranges: DateRange[]): DateRange[] {
  if (ranges.length <= 1) return ranges;

  // Sort by start date
  const sorted = [...ranges].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  const merged: DateRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // Check if current overlaps with last
    if (current.start <= last.end) {
      // Merge by extending the end date if necessary
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      // No overlap, add as new range
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Calculate total years from date ranges
 */
function calculateTotalYears(ranges: DateRange[]): number {
  const totalMs = ranges.reduce((sum, range) => {
    return sum + (range.end.getTime() - range.start.getTime());
  }, 0);

  // Convert milliseconds to years
  return totalMs / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Calculate total years of experience from work experiences
 */
export function calculateTotalExperience(
  experiences: Array<{ date: string; company: string }>,
): number {
  const allRanges: DateRange[] = [];

  for (const exp of experiences) {
    // Special handling for internships
    if (exp.company === "Manufacture Claret" && exp.date.includes(",")) {
      const internshipRanges = parseInternshipYears(exp.date);
      allRanges.push(...internshipRanges);
    } else {
      const range = parseDateRange(exp.date);
      if (range) {
        allRanges.push(range);
      }
    }
  }

  // Merge overlapping periods to avoid double-counting
  const mergedRanges = mergeOverlappingRanges(allRanges);

  // Calculate total years
  const totalYears = calculateTotalYears(mergedRanges);

  // Round to nearest half year
  return Math.round(totalYears * 2) / 2;
}

/**
 * Get a formatted string for years of experience
 */
export function getFormattedExperienceYears(
  experiences: Array<{ date: string; company: string }>,
): string {
  const years = calculateTotalExperience(experiences);

  // If it's a whole number, show without decimal
  if (years % 1 === 0) {
    return `${Math.floor(years)}+`;
  }

  // Otherwise show with one decimal place
  return `${years.toFixed(1)}+`;
}

/**
 * Calculate total years of research from research projects
 */
export function calculateTotalResearchYears(
  projects: Array<{ yearsSpent: number }>,
): number {
  return projects.reduce((total, project) => total + project.yearsSpent, 0);
}

/**
 * Get a formatted string for years of research
 */
export function getFormattedResearchYears(
  projects: Array<{ yearsSpent: number }>,
): string {
  const years = calculateTotalResearchYears(projects);

  // If it's a whole number, show without decimal
  if (years % 1 === 0) {
    return `${Math.floor(years)}`;
  }

  // Otherwise show with one decimal place
  return `${years.toFixed(1)}`;
}
