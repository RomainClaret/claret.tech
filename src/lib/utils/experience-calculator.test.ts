import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateTotalExperience,
  getFormattedExperienceYears,
  calculateTotalResearchYears,
  getFormattedResearchYears,
} from "./experience-calculator";

describe("experience-calculator", () => {
  beforeEach(() => {
    // Mock Date.now() to return a consistent date for testing
    vi.setSystemTime(new Date("2024-01-01"));
  });

  describe("calculateTotalExperience", () => {
    describe("Single year experiences", () => {
      it("calculates experience for single year periods", () => {
        const experiences = [
          { date: "2020", company: "Test Company" },
          { date: "2022", company: "Another Company" },
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(2); // 2 separate years
      });

      it("handles overlapping years correctly", () => {
        const experiences = [
          { date: "2020", company: "Company A" },
          { date: "2020", company: "Company B" }, // Same year - should not double count
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(1); // Only 1 year total
      });
    });

    describe("Date range experiences", () => {
      it("calculates experience for simple date ranges", () => {
        const experiences = [{ date: "2020 - 2022", company: "Test Company" }];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(2); // 2 years from 2020 to 2022
      });

      it("calculates experience with Present end date", () => {
        const experiences = [
          { date: "2022 - Present", company: "Current Company" },
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(2); // 2022 to 2024 (mocked current date)
      });

      it("handles month-year date ranges", () => {
        const experiences = [
          { date: "Jan 2020 - Dec 2021", company: "Test Company" },
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(2); // ~2 years from Jan 2020 to Dec 2021
      });

      it("handles abbreviated month formats", () => {
        const experiences = [
          { date: "Sep. 2020 - Mar. 2022", company: "Test Company" },
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBeCloseTo(1.5, 0.5); // ~1.5 years from Sep 2020 to Mar 2022
      });
    });

    describe("Overlapping experiences", () => {
      it("merges overlapping date ranges", () => {
        const experiences = [
          { date: "2020 - 2022", company: "Company A" },
          { date: "2021 - 2023", company: "Company B" }, // Overlaps with previous
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(3); // 2020 to 2023, merged
      });

      it("handles multiple overlapping ranges", () => {
        const experiences = [
          { date: "2018 - 2020", company: "Company A" },
          { date: "2019 - 2021", company: "Company B" },
          { date: "2020 - 2022", company: "Company C" },
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(4); // 2018 to 2022, all merged
      });

      it("keeps separate non-overlapping ranges", () => {
        const experiences = [
          { date: "2018 - 2019", company: "Company A" },
          { date: "2021 - 2022", company: "Company B" }, // Gap year 2020
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(2); // 1 year + 1 year = 2 years total
      });
    });

    describe("Internship handling", () => {
      it("handles comma-separated internship years", () => {
        const experiences = [
          { date: "2004, 2005, 2006", company: "Manufacture Claret" },
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBeCloseTo(0.75, 0.25); // 3 internships × 3 months each = 9 months ≈ 0.75 years
      });

      it("handles single internship year", () => {
        const experiences = [{ date: "2012", company: "Manufacture Claret" }];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(1); // Single year counts as full year
      });

      it("treats non-Manufacture Claret comma dates as regular ranges", () => {
        const experiences = [
          { date: "2004, 2005", company: "Other Company" }, // Not Manufacture Claret
        ];

        const result = calculateTotalExperience(experiences);
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

        const result = calculateTotalExperience(experiences);
        // Should merge overlapping periods and add internship time
        expect(result).toBeGreaterThan(3); // At least 3+ years
      });

      it("rounds to nearest half year", () => {
        const experiences = [
          { date: "Jan 2020 - Sep 2020", company: "Short Job" }, // ~8 months ≈ 0.67 years
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(0.5); // Should round to nearest 0.5
      });
    });

    describe("Edge cases", () => {
      it("handles empty experience array", () => {
        const result = calculateTotalExperience([]);
        expect(result).toBe(0);
      });

      it("handles invalid date formats gracefully", () => {
        const experiences = [
          { date: "invalid-date", company: "Test Company" },
          { date: "2020 - 2021", company: "Valid Company" },
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(1); // Only counts the valid one
      });

      it("handles malformed date ranges", () => {
        const experiences = [
          { date: "2020 -", company: "Incomplete Range" },
          { date: "- 2021", company: "Incomplete Start" },
          { date: "2022", company: "Valid Year" },
        ];

        const result = calculateTotalExperience(experiences);
        expect(result).toBe(4); // The malformed dates get parsed as fallback current dates, contributing to total
      });
    });
  });

  describe("getFormattedExperienceYears", () => {
    it("formats whole years without decimals", () => {
      const experiences = [{ date: "2020 - 2022", company: "Test Company" }];

      const result = getFormattedExperienceYears(experiences);
      expect(result).toBe("2+");
    });

    it("formats half years with decimals", () => {
      const experiences = [
        { date: "Jan 2020 - Jul 2020", company: "Test Company" }, // ~0.5 years
      ];

      const result = getFormattedExperienceYears(experiences);
      expect(result).toBe("0.5+");
    });

    it("formats fractional years to one decimal", () => {
      const experiences = [
        { date: "Jan 2020 - Sep 2021", company: "Test Company" }, // ~1.67 years -> 1.5
      ];

      const result = getFormattedExperienceYears(experiences);
      expect(result).toBe("1.5+");
    });

    it("handles zero experience", () => {
      const result = getFormattedExperienceYears([]);
      expect(result).toBe("0+");
    });
  });

  describe("calculateTotalResearchYears", () => {
    it("sums research years correctly", () => {
      const projects = [
        { yearsSpent: 2.5 },
        { yearsSpent: 1.0 },
        { yearsSpent: 0.5 },
      ];

      const result = calculateTotalResearchYears(projects);
      expect(result).toBe(4.0);
    });

    it("handles empty projects array", () => {
      const result = calculateTotalResearchYears([]);
      expect(result).toBe(0);
    });

    it("handles single project", () => {
      const projects = [{ yearsSpent: 3.5 }];
      const result = calculateTotalResearchYears(projects);
      expect(result).toBe(3.5);
    });

    it("handles zero values", () => {
      const projects = [
        { yearsSpent: 0 },
        { yearsSpent: 2.0 },
        { yearsSpent: 0 },
      ];

      const result = calculateTotalResearchYears(projects);
      expect(result).toBe(2.0);
    });

    it("handles decimal precision", () => {
      const projects = [
        { yearsSpent: 1.1 },
        { yearsSpent: 2.2 },
        { yearsSpent: 0.1 },
      ];

      const result = calculateTotalResearchYears(projects);
      expect(result).toBeCloseTo(3.4, 2);
    });
  });

  describe("getFormattedResearchYears", () => {
    it("formats whole years without decimals", () => {
      const projects = [{ yearsSpent: 2.0 }, { yearsSpent: 1.0 }];

      const result = getFormattedResearchYears(projects);
      expect(result).toBe("3");
    });

    it("formats fractional years with one decimal", () => {
      const projects = [{ yearsSpent: 2.5 }, { yearsSpent: 1.2 }];

      const result = getFormattedResearchYears(projects);
      expect(result).toBe("3.7");
    });

    it("handles zero research years", () => {
      const result = getFormattedResearchYears([]);
      expect(result).toBe("0");
    });

    it("formats single decimal places correctly", () => {
      const projects = [{ yearsSpent: 4.1 }];
      const result = getFormattedResearchYears(projects);
      expect(result).toBe("4.1");
    });

    it("handles precise fractional sums", () => {
      const projects = [{ yearsSpent: 1.33 }, { yearsSpent: 2.67 }];

      const result = getFormattedResearchYears(projects);
      expect(result).toBe("4"); // 4.0 displays as "4" (whole number)
    });
  });

  describe("Date parsing edge cases", () => {
    it("handles various month abbreviations", () => {
      const experiences = [
        { date: "Jan. 2020 - Feb. 2020", company: "Test" },
        { date: "Sept 2020 - Oct 2020", company: "Test" },
        { date: "December 2020 - January 2021", company: "Test" },
      ];

      const result = calculateTotalExperience(experiences);
      expect(result).toBeGreaterThan(0); // Should parse and calculate some time
    });

    it("handles present with different casing", () => {
      const experiences = [
        { date: "2023 - present", company: "Test" },
        { date: "2020 - PRESENT", company: "Test" },
      ];

      const result = calculateTotalExperience(experiences);
      expect(result).toBeGreaterThan(2); // Should handle both cases of "present"
    });
  });
});
