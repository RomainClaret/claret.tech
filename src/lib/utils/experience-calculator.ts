interface DateRange {
  start: Date;
  end: Date;
}

/** 365.25 so leap years do not drift the total. */
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

/**
 * The first instant of a month in UTC. The totals are computed for the build
 * day on the server, in UTC, and again in each visitor's browser while the
 * page hydrates: a local-time date moved every boundary by the visitor's UTC
 * offset, up to 14 hours, enough to flip a rounded total near a step.
 */
function utcDate(year: number, month: number, day = 1): Date {
  return new Date(Date.UTC(year, month, day));
}

/**
 * Parse date string into Date object
 * Handles formats like:
 * - "Sep. 2023" -> September 1, 2023
 * - "2023" -> January 1, 2023
 * - "Present", or nothing (an open end, "2020 -") -> `now`
 *
 * Null for anything else. It went to `new Date()`'s own parser, whose
 * reading of other formats differs between engines (V8 accepts strings
 * Safari rejects), so the server and a browser could disagree.
 */
function parseDate(dateStr: string, now: Date): Date | null {
  const cleaned = dateStr.trim();

  if (cleaned === "" || cleaned.toLowerCase() === "present") {
    return now;
  }

  // Handle year-only format (e.g., "2023")
  if (/^\d{4}$/.test(cleaned)) {
    return utcDate(parseInt(cleaned), 0); // January 1st of that year
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
      return utcDate(parseInt(yearStr), month);
    }
  }

  return null;
}

/**
 * Parse date range string into start and end dates
 * Handles formats like:
 * - "Sep. 2023 - Present"
 * - "2020 - 2022"
 * - "May 2010 - Aug. 2010"
 */
function parseDateRange(dateStr: string, now: Date): DateRange | null {
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
        start: utcDate(year, 0),
        end: utcDate(year, 11, 31),
      };
    }
    return null;
  }

  const [startStr, endStr] = parts;
  // Only the end may be open ("2020 -") or Present. A start written so has
  // lost its date: counted from `now`, "- 2021" subtracted from the total
  // and named nothing.
  const isOpen = (s: string) => s === "" || s.toLowerCase() === "present";
  if (isOpen(startStr)) return null;
  const start = parseDate(startStr, now);
  const end = parseDate(endStr, now);
  if (!start || !end) return null;
  if (end < start) {
    // A role to Present that has not begun counts nothing, as a research
    // start in the future does; a fixed range that ends before it starts
    // is a mistake, left out and named.
    return isOpen(endStr) ? { start, end: start } : null;
  }
  return { start, end };
}

/**
 * One summer internship, June 1 to September 30: about four months. (This
 * said three months, against the code, until 2026-11-07.)
 */
function summerOf(year: number): DateRange {
  return {
    start: utcDate(year, 5), // June 1
    end: utcDate(year, 8, 30), // September 30
  };
}

/**
 * An experience entry's ranges, and the parts of its date the calculator
 * could not read, which count for nothing.
 *
 * - "Sep. 2023 - Feb. 2024 & Sep. 2024 - Dec. 2024": one range per spell
 *   (the whole date used to be dropped).
 * - Manufacture Claret's "Summers 2004, 2005, 2006, 2012": one summer per
 *   year, read by its four digits ("Summers 2004" used to be dropped, so
 *   three of four summers counted).
 */
function parseExperience(
  exp: { date: string; company: string },
  now: Date,
): { ranges: DateRange[]; unread: string[] } {
  const ranges: DateRange[] = [];
  const unread: string[] = [];

  for (const spell of exp.date.split("&").map((s) => s.trim())) {
    if (exp.company === "Manufacture Claret" && spell.includes(",")) {
      for (const token of spell.split(",").map((s) => s.trim())) {
        const year = token.match(/\b(\d{4})\b/)?.[1];
        if (year) ranges.push(summerOf(parseInt(year)));
        else unread.push(token);
      }
      continue;
    }
    const range = parseDateRange(spell, now);
    if (range) ranges.push(range);
    else unread.push(spell);
  }

  return { ranges, unread };
}

/**
 * The parts of these entries' dates that the experience total leaves out,
 * because the calculator cannot read them. Empty for the site's data: a
 * test holds it there, so an entry written in a new format fails the
 * tests instead of quietly shrinking the figure.
 */
export function unreadExperienceDates(
  experiences: Array<{ date: string; company: string }>,
): string[] {
  // Readability does not depend on the day; any day will do.
  const anyDay = new Date(0);
  return experiences.flatMap((exp) => parseExperience(exp, anyDay).unread);
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
  return totalMs / MS_PER_YEAR;
}

/**
 * Calculate total years of experience from work experiences, a role
 * "- Present" running to `now`. A page renders it through useToday, which
 * passes the built commit's day while hydrating and the visitor's today
 * after.
 *
 * `now` has no default here or below: a default of new Date() is how the
 * stats read the clock during render unseen (React error #418, 2026-11).
 */
export function calculateTotalExperience(
  experiences: Array<{ date: string; company: string }>,
  now: Date,
): number {
  const allRanges = experiences.flatMap(
    (exp) => parseExperience(exp, now).ranges,
  );

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
  now: Date,
): string {
  const years = calculateTotalExperience(experiences, now);

  // If it's a whole number, show without decimal
  if (years % 1 === 0) {
    return `${Math.floor(years)}+`;
  }

  // Otherwise show with one decimal place
  return `${years.toFixed(1)}+`;
}

/**
 * Calculate total years of research from research projects, an ongoing one
 * measured to `now`. A page renders it through useToday, as the experience
 * total.
 */
export function calculateTotalResearchYears(
  projects: Array<{ yearsSpent: number; researchStart?: string }>,
  additionalYears: number,
  now: Date,
): number {
  const fromProjects = projects.reduce((total, project) => {
    // An ongoing project states when it began instead of guessing a duration,
    // so its contribution is measured against today and grows on its own.
    if (project.researchStart) {
      const [year, month] = project.researchStart.split("-").map(Number);
      const start = utcDate(year, (month || 1) - 1);
      const elapsed = (now.getTime() - start.getTime()) / MS_PER_YEAR;
      // Clamped: a start date in the future would otherwise subtract from the
      // total, which is a stranger number to debug than a zero.
      return total + Math.max(0, elapsed);
    }
    return total + project.yearsSpent;
  }, 0);

  return fromProjects + additionalYears;
}

/**
 * Get a formatted string for years of research
 */
export function getFormattedResearchYears(
  projects: Array<{ yearsSpent: number; researchStart?: string }>,
  additionalYears: number,
  now: Date,
): string {
  const years = calculateTotalResearchYears(projects, additionalYears, now);

  // One decimal, and none for a whole number. A total that counts to today
  // is almost never exactly whole, so the `years % 1 === 0` test this had
  // missed it: "11.0" would have shown from 2026-12-12 for five weeks.
  const shown = years.toFixed(1);
  return shown.endsWith(".0") ? shown.slice(0, -2) : shown;
}
