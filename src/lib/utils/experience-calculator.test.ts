import { describe, it, expect, vi, afterEach } from "vitest";
import { isDisplayed, researchSection } from "@/data/sections/research";
import { workExperiences } from "@/data/portfolio";
import {
  calculateTotalExperience,
  getFormattedExperienceYears,
  calculateTotalResearchYears,
  getFormattedResearchYears,
  unreadExperienceDates,
} from "./experience-calculator";

// The day each total counts to. The functions take it from their caller
// (a page passes useToday's day), never from the clock: a default of
// new Date() would hide a clock read in whatever renders them.
const JAN_2024 = new Date("2024-01-01T00:00:00Z");

describe("experience-calculator", () => {
  describe("calculateTotalExperience", () => {
    describe("Single year experiences", () => {
      it("calculates experience for single year periods", () => {
        const experiences = [
          { date: "2020", company: "Test Company" },
          { date: "2022", company: "Another Company" },
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(2); // 2 separate years
      });

      it("handles overlapping years correctly", () => {
        const experiences = [
          { date: "2020", company: "Company A" },
          { date: "2020", company: "Company B" }, // Same year - should not double count
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(1); // Only 1 year total
      });
    });

    describe("Date range experiences", () => {
      it("calculates experience for simple date ranges", () => {
        const experiences = [{ date: "2020 - 2022", company: "Test Company" }];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(2); // 2 years from 2020 to 2022
      });

      it("calculates experience with Present end date", () => {
        const experiences = [
          { date: "2022 - Present", company: "Current Company" },
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(2); // 2022 to 2024 (mocked current date)
      });

      it("handles month-year date ranges", () => {
        const experiences = [
          { date: "Jan 2020 - Dec 2021", company: "Test Company" },
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(2); // ~2 years from Jan 2020 to Dec 2021
      });

      it("handles abbreviated month formats", () => {
        const experiences = [
          { date: "Sep. 2020 - Mar. 2022", company: "Test Company" },
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBeCloseTo(1.5, 0.5); // ~1.5 years from Sep 2020 to Mar 2022
      });
    });

    describe("Overlapping experiences", () => {
      it("merges overlapping date ranges", () => {
        const experiences = [
          { date: "2020 - 2022", company: "Company A" },
          { date: "2021 - 2023", company: "Company B" }, // Overlaps with previous
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(3); // 2020 to 2023, merged
      });

      it("handles multiple overlapping ranges", () => {
        const experiences = [
          { date: "2018 - 2020", company: "Company A" },
          { date: "2019 - 2021", company: "Company B" },
          { date: "2020 - 2022", company: "Company C" },
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(4); // 2018 to 2022, all merged
      });

      it("keeps separate non-overlapping ranges", () => {
        const experiences = [
          { date: "2018 - 2019", company: "Company A" },
          { date: "2021 - 2022", company: "Company B" }, // Gap year 2020
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(2); // 1 year + 1 year = 2 years total
      });
    });

    describe("Internship handling", () => {
      it("handles comma-separated internship years", () => {
        const experiences = [
          { date: "2004, 2005, 2006", company: "Manufacture Claret" },
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        // 3 summers of June 1 to September 30 (121 days each, 0.99 years
        // in all), rounded to the half year.
        expect(result).toBe(1);
      });

      it("handles single internship year", () => {
        const experiences = [{ date: "2012", company: "Manufacture Claret" }];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(1); // Single year counts as full year
      });

      it("treats non-Manufacture Claret comma dates as regular ranges", () => {
        const experiences = [
          { date: "2004, 2005", company: "Other Company" }, // Not Manufacture Claret
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(0); // Invalid range format, returns 0
      });
    });

    describe("Complex scenarios", () => {
      it("handles mixed experience types", () => {
        const experiences = [
          { date: "2018 - 2020", company: "Full-time Job" },
          { date: "2019", company: "Part-time Work" }, // Overlaps
          { date: "2004, 2005", company: "Manufacture Claret" }, // Internships
          { date: "2021 - Present", company: "Current Job" },
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        // Should merge overlapping periods and add internship time
        expect(result).toBeGreaterThan(3); // At least 3+ years
      });

      it("rounds to nearest half year", () => {
        const experiences = [
          { date: "Jan 2020 - Sep 2020", company: "Short Job" }, // ~8 months ≈ 0.67 years
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(0.5); // Should round to nearest 0.5
      });
    });

    describe("Edge cases", () => {
      it("handles empty experience array", () => {
        const result = calculateTotalExperience([], JAN_2024);
        expect(result).toBe(0);
      });

      it("handles invalid date formats gracefully", () => {
        const experiences = [
          { date: "invalid-date", company: "Test Company" },
          { date: "2020 - 2021", company: "Valid Company" },
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        expect(result).toBe(1); // Only counts the valid one
      });

      it("handles malformed date ranges", () => {
        const experiences = [
          { date: "2020 -", company: "Incomplete Range" },
          { date: "- 2021", company: "Incomplete Start" },
          { date: "2022", company: "Valid Year" },
        ];

        const result = calculateTotalExperience(experiences, JAN_2024);
        // "2020 -" runs to `now` (4 years, 2022 inside them). "- 2021" has
        // lost its start: it counts for nothing and is named.
        expect(result).toBe(4);
        expect(unreadExperienceDates(experiences)).toEqual(["- 2021"]);
      });

      it("names a start written as Present, and counts nothing for it", () => {
        const experiences = [{ date: "Present - 2021", company: "Lost" }];

        expect(calculateTotalExperience(experiences, JAN_2024)).toBe(0);
        expect(unreadExperienceDates(experiences)).toEqual(["Present - 2021"]);
      });

      it("names a range that ends before it starts, and counts nothing for it", () => {
        // A typo: it subtracted two years from the total.
        const experiences = [
          { date: "2022 - 2020", company: "Typo" },
          { date: "2010 - 2014", company: "Real" },
        ];

        expect(calculateTotalExperience(experiences, JAN_2024)).toBe(4);
        expect(unreadExperienceDates(experiences)).toEqual(["2022 - 2020"]);
      });

      it("counts nothing for a role to Present that has not begun", () => {
        // Written in before it starts, it subtracted from the total, where a
        // research start in the future counts zero. A year ahead, so that
        // the rounding to the half year cannot hide it.
        const experiences = [
          { date: "Jan. 2025 - Present", company: "Next" },
          { date: "2010 - 2014", company: "Real" },
        ];

        expect(calculateTotalExperience(experiences, JAN_2024)).toBe(4);
        expect(unreadExperienceDates(experiences)).toEqual([]);
      });
    });
  });

  describe("getFormattedExperienceYears", () => {
    it("formats whole years without decimals", () => {
      const experiences = [{ date: "2020 - 2022", company: "Test Company" }];

      const result = getFormattedExperienceYears(experiences, JAN_2024);
      expect(result).toBe("2+");
    });

    it("formats half years with decimals", () => {
      const experiences = [
        { date: "Jan 2020 - Jul 2020", company: "Test Company" }, // ~0.5 years
      ];

      const result = getFormattedExperienceYears(experiences, JAN_2024);
      expect(result).toBe("0.5+");
    });

    it("formats fractional years to one decimal", () => {
      const experiences = [
        { date: "Jan 2020 - Sep 2021", company: "Test Company" }, // ~1.67 years -> 1.5
      ];

      const result = getFormattedExperienceYears(experiences, JAN_2024);
      expect(result).toBe("1.5+");
    });

    it("handles zero experience", () => {
      const result = getFormattedExperienceYears([], JAN_2024);
      expect(result).toBe("0+");
    });
  });

  describe("ongoing research counted from a start date", () => {
    // Every assertion passes an explicit `now`. Reading the real clock here
    // would make these fail on some future day for no reason.
    const AUG_2026 = new Date("2026-08-25T12:00:00Z");

    it("measures an ongoing project against the given date", () => {
      const projects = [{ yearsSpent: 0, researchStart: "2026-07" }];
      const years = calculateTotalResearchYears(projects, 0, AUG_2026);
      // 2026-07-01 to 2026-08-25 is about 55 days.
      expect(years).toBeGreaterThan(0.13);
      expect(years).toBeLessThan(0.17);
    });

    it("ignores yearsSpent when a start date is present", () => {
      const withNumber = [{ yearsSpent: 99, researchStart: "2026-07" }];
      const withoutNumber = [{ yearsSpent: 0, researchStart: "2026-07" }];
      expect(calculateTotalResearchYears(withNumber, 0, AUG_2026)).toBe(
        calculateTotalResearchYears(withoutNumber, 0, AUG_2026),
      );
    });

    it("lets only one displayed project count from a start date", () => {
      // Two ongoing projects both run to today, so they always overlap, and
      // the total would count the present-day months once per card. The
      // emerging-behaviors card counts them; any other concurrent card sets
      // yearsSpent: 0 and no researchStart, as GEENNS does.
      const counting = researchSection.projects
        .filter(isDisplayed)
        .filter((p) => p.researchStart)
        .map((p) => p.anchorId);

      expect(counting.length).toBeLessThanOrEqual(1);
    });

    it("keeps growing as time passes", () => {
      const projects = [{ yearsSpent: 0, researchStart: "2026-07" }];
      const now = calculateTotalResearchYears(projects, 0, AUG_2026);
      const later = calculateTotalResearchYears(
        projects,
        0,
        new Date("2027-08-25T12:00:00Z"),
      );
      expect(later - now).toBeCloseTo(1, 1);
    });

    it("does not go negative on a start date in the future", () => {
      const projects = [{ yearsSpent: 0, researchStart: "2030-01" }];
      expect(calculateTotalResearchYears(projects, 0, AUG_2026)).toBe(0);
    });

    it("adds research time that has no project card", () => {
      const projects = [{ yearsSpent: 2 }];
      expect(calculateTotalResearchYears(projects, 2.5, AUG_2026)).toBe(4.5);
    });

    it("totals the real Evolution Lab data to the expected figure", () => {
      // End to end rather than part by part: fixed durations 0.25 + 1 + 1 +
      // 5.75, GEENNS at 0, the ongoing project from 2026-07, and 2.5 years of
      // uncarded R&D. Change any duration in research.ts and this fails.
      const years = calculateTotalResearchYears(
        researchSection.projects,
        researchSection.additionalResearchYears,
        AUG_2026,
      );
      expect(years).toBeGreaterThan(10.6);
      expect(years).toBeLessThan(10.8);
      expect(
        getFormattedResearchYears(
          researchSection.projects,
          researchSection.additionalResearchYears,
          AUG_2026,
        ),
      ).toBe("10.7");
    });
  });

  describe("calculateTotalResearchYears", () => {
    it("sums research years correctly", () => {
      const projects = [
        { yearsSpent: 2.5 },
        { yearsSpent: 1.0 },
        { yearsSpent: 0.5 },
      ];

      const result = calculateTotalResearchYears(projects, 0, JAN_2024);
      expect(result).toBe(4.0);
    });

    it("handles empty projects array", () => {
      const result = calculateTotalResearchYears([], 0, JAN_2024);
      expect(result).toBe(0);
    });

    it("handles single project", () => {
      const projects = [{ yearsSpent: 3.5 }];
      const result = calculateTotalResearchYears(projects, 0, JAN_2024);
      expect(result).toBe(3.5);
    });

    it("handles zero values", () => {
      const projects = [
        { yearsSpent: 0 },
        { yearsSpent: 2.0 },
        { yearsSpent: 0 },
      ];

      const result = calculateTotalResearchYears(projects, 0, JAN_2024);
      expect(result).toBe(2.0);
    });

    it("handles decimal precision", () => {
      const projects = [
        { yearsSpent: 1.1 },
        { yearsSpent: 2.2 },
        { yearsSpent: 0.1 },
      ];

      const result = calculateTotalResearchYears(projects, 0, JAN_2024);
      expect(result).toBeCloseTo(3.4, 2);
    });
  });

  describe("getFormattedResearchYears", () => {
    it("formats whole years without decimals", () => {
      const projects = [{ yearsSpent: 2.0 }, { yearsSpent: 1.0 }];

      const result = getFormattedResearchYears(projects, 0, JAN_2024);
      expect(result).toBe("3");
    });

    it("formats fractional years with one decimal", () => {
      const projects = [{ yearsSpent: 2.5 }, { yearsSpent: 1.2 }];

      const result = getFormattedResearchYears(projects, 0, JAN_2024);
      expect(result).toBe("3.7");
    });

    it("handles zero research years", () => {
      const result = getFormattedResearchYears([], 0, JAN_2024);
      expect(result).toBe("0");
    });

    it("formats single decimal places correctly", () => {
      const projects = [{ yearsSpent: 4.1 }];
      const result = getFormattedResearchYears(projects, 0, JAN_2024);
      expect(result).toBe("4.1");
    });

    it("handles precise fractional sums", () => {
      const projects = [{ yearsSpent: 1.33 }, { yearsSpent: 2.67 }];

      const result = getFormattedResearchYears(projects, 0, JAN_2024);
      expect(result).toBe("4"); // 4.0 displays as "4" (whole number)
    });

    it("shows a total that rounds to a whole number without its .0", () => {
      // Counted to today, the total is almost never exactly whole: the site
      // would have shown "11.0" from 2026-12-12 for five weeks.
      expect(
        getFormattedResearchYears([{ yearsSpent: 10.96 }], 0, JAN_2024),
      ).toBe("11");
      expect(
        getFormattedResearchYears(
          researchSection.projects.filter(isDisplayed),
          researchSection.additionalResearchYears,
          new Date("2026-12-20T00:00:00Z"),
        ),
      ).toBe("11");
    });
  });

  describe("Date parsing edge cases", () => {
    it("handles various month abbreviations", () => {
      const experiences = [
        { date: "Jan. 2020 - Feb. 2020", company: "Test" },
        { date: "Sept 2020 - Oct 2020", company: "Test" },
        { date: "December 2020 - January 2021", company: "Test" },
      ];

      const result = calculateTotalExperience(experiences, JAN_2024);
      expect(result).toBeGreaterThan(0); // Should parse and calculate some time
    });

    it("handles present with different casing", () => {
      const experiences = [
        { date: "2023 - present", company: "Test" },
        { date: "2020 - PRESENT", company: "Test" },
      ];

      const result = calculateTotalExperience(experiences, JAN_2024);
      expect(result).toBeGreaterThan(2); // Should handle both cases of "present"
    });
  });

  describe("a role to Present, counted to the given day", () => {
    // The page passes the built commit's day while it hydrates and the
    // visitor's today after (useToday): the clock must not leak in
    // underneath.
    it("ends a current role on `now`, not on the clock", () => {
      vi.setSystemTime(new Date("2030-06-01T00:00:00Z"));
      const experiences = [{ date: "2022 - Present", company: "Current" }];
      const now = new Date("2024-01-01T00:00:00Z");

      expect(calculateTotalExperience(experiences, now)).toBe(2);
      expect(getFormattedExperienceYears(experiences, now)).toBe("2+");
    });

    it("counts an open end, as in 2020 -, to `now` too", () => {
      vi.setSystemTime(new Date("2030-06-01T00:00:00Z"));
      const experiences = [{ date: "2020 -", company: "Incomplete" }];

      expect(
        calculateTotalExperience(experiences, new Date("2024-01-01T00:00:00Z")),
      ).toBe(4);
    });
  });

  describe("dates read whole, or named", () => {
    it("reads the site's experience data whole", () => {
      // "Summers 2004" was left out (the internship years had to be bare),
      // so three of four summers counted: 16.5+ shown where 17+ was due.
      // A date in a new format now fails here instead.
      expect(unreadExperienceDates(workExperiences.experience)).toEqual([]);
    });

    it("counts an internship year written after a word", () => {
      const company = "Manufacture Claret";
      expect(
        calculateTotalExperience(
          [{ date: "Summers 2004, 2005, 2006, 2012", company }],
          JAN_2024,
        ),
      ).toBe(
        calculateTotalExperience(
          [{ date: "2004, 2005, 2006, 2012", company }],
          JAN_2024,
        ),
      );
    });

    it("counts each spell of a role joined by &", () => {
      // Two spells of about 11 months each, a year apart: the whole date
      // used to be dropped.
      const experiences = [
        {
          date: "Jan. 2020 - Dec. 2020 & Jan. 2022 - Dec. 2022",
          company: "Two spells",
        },
      ];

      expect(calculateTotalExperience(experiences, JAN_2024)).toBe(2);
      expect(unreadExperienceDates(experiences)).toEqual([]);
    });

    it("leaves a date it cannot read out, and names it", () => {
      // new Date()'s own parser read some such strings in V8 and not in
      // Safari: the server and a browser could reach different totals.
      const experiences = [
        { date: "Spring 2020 - Present", company: "Unread" },
        { date: "2021 - 2022", company: "Read" },
      ];

      expect(calculateTotalExperience(experiences, JAN_2024)).toBe(1);
      expect(unreadExperienceDates(experiences)).toEqual([
        "Spring 2020 - Present",
      ]);
    });
  });

  describe("the same totals in every timezone", () => {
    // The server computes the built commit's day's totals in UTC and every
    // browser computes them again while hydrating. Local-time dates moved each
    // start by the visitor's offset, up to 14 hours, and near a step the
    // rounded total differed: a mismatch for visitors far from UTC alone.
    const zones = [
      "UTC",
      "Pacific/Kiritimati", // UTC+14
      "Pacific/Pago_Pago", // UTC-11
      "Asia/Kolkata", // UTC+5:30
    ];
    const originalZone = process.env.TZ;

    afterEach(() => {
      // An assigned undefined would become the string "undefined".
      if (originalZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalZone;
    });

    /** Every hour from the day before `day` to the day after (UTC). */
    const hoursAround = (day: string) =>
      Array.from(
        { length: 72 },
        (_, hour) =>
          new Date(Date.parse(`${day}T00:00:00Z`) + (hour - 24) * 3_600_000),
      );

    it("formats the real data identically in each, around their steps", () => {
      // Where the totals step (a scan by the minute, 2026-11-07): research
      // 10.8 to 10.9 on 2026-11-05 at 20:07 UTC, experience 17+ to 17.5+
      // on 2027-02-01 at 13:30 UTC.
      const instants = [
        ...hoursAround("2026-11-05"),
        ...hoursAround("2027-02-01"),
      ];
      const totalsIn = (zone: string) => {
        process.env.TZ = zone;
        return instants.map(
          (now) =>
            `${getFormattedResearchYears(
              researchSection.projects.filter(isDisplayed),
              researchSection.additionalResearchYears,
              now,
            )} ${getFormattedExperienceYears(workExperiences.experience, now)}`,
        );
      };
      const offsetIn = (zone: string) => {
        process.env.TZ = zone;
        return new Date(2026, 10, 5).getTimezoneOffset();
      };

      // The zone switch takes effect, or the comparison below proves nothing.
      expect(new Set(zones.map(offsetIn)).size).toBe(zones.length);
      const inUtc = totalsIn("UTC");
      // Each figure steps inside its own window, research in the first and
      // experience in the second, or a data edit that moves a step out
      // would leave that figure compared across zones away from any step.
      const half = instants.length / 2;
      const research = (totals: string) => totals.split(" ")[0];
      const experience = (totals: string) => totals.split(" ")[1];
      expect(
        new Set(inUtc.slice(0, half).map(research)).size,
        "research steps in its window",
      ).toBe(2);
      expect(
        new Set(inUtc.slice(half).map(experience)).size,
        "experience steps in its window",
      ).toBe(2);
      for (const zone of zones.slice(1)) {
        expect(totalsIn(zone), zone).toEqual(inUtc);
      }
    });
  });
});
