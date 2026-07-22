import { describe, it, expect } from "vitest";
import {
  getConferenceLogo,
  generateLogoFileNames,
  AVAILABLE_CONFERENCE_LOGOS,
} from "./conference-logos";

// DynamicPaperCard (Papers.tsx) passes the venue as `${venue} • ${year}`.
const withYear = (venue: string, year: string) => `${venue} • ${year}`;

describe("getConferenceLogo", () => {
  it("resolves a later acronym when the venue leads with a different one (WCCI regression)", () => {
    // "IEEE World Congress on Computational Intelligence (WCCI)" leads with the
    // "IEEE" acronym, which has no logo. The resolver must still find "WCCI".
    // Before the fix (only the first acronym was checked) this returned null.
    const venue = withYear(
      "IEEE World Congress on Computational Intelligence (WCCI)",
      "2026",
    );
    expect(generateLogoFileNames(venue)).toContain("wcci_2026_logo");
    expect(getConferenceLogo(venue, AVAILABLE_CONFERENCE_LOGOS)).toBe(
      "/images/wcci_2026_logo.webp",
    );
  });

  it.each([
    [
      "Artificial Life Conference (ALIFE)",
      "2026",
      "/images/alife_2026_logo.webp",
    ],
    [
      "Genetic and Evolutionary Computation Conference (GECCO)",
      "2026",
      "/images/gecco_2026_logo.webp",
    ],
    [
      "Parallel Problem Solving from Nature (PPSN)",
      "2026",
      "/images/ppsn_2026_logo.webp",
    ],
    [
      "International Conference on Pattern Recognition (ICPR)",
      "2026",
      "/images/icpr_2026_logo.webp",
    ],
    [
      "Genetic and Evolutionary Computation Conference (GECCO)",
      "2024",
      "/images/gecco_2024_logo.webp",
    ],
  ])("resolves %s (%s) to its logo", (venue, year, expected) => {
    expect(
      getConferenceLogo(withYear(venue, year), AVAILABLE_CONFERENCE_LOGOS),
    ).toBe(expected);
  });

  it("prefers a registered _white variant in dark theme", () => {
    expect(
      getConferenceLogo(
        withYear("Parallel Problem Solving from Nature (PPSN)", "2026"),
        AVAILABLE_CONFERENCE_LOGOS,
        { theme: "dark" },
      ),
    ).toBe("/images/ppsn_2026_logo_white.webp");
  });

  it("falls back to the normal logo in dark theme without a white variant", () => {
    expect(
      getConferenceLogo(
        withYear(
          "IEEE World Congress on Computational Intelligence (WCCI)",
          "2026",
        ),
        AVAILABLE_CONFERENCE_LOGOS,
        { theme: "dark" },
      ),
    ).toBe("/images/wcci_2026_logo.webp");
  });

  it("never picks a _white variant in light theme", () => {
    expect(
      getConferenceLogo(
        withYear("Parallel Problem Solving from Nature (PPSN)", "2026"),
        AVAILABLE_CONFERENCE_LOGOS,
        { theme: "light" },
      ),
    ).toBe("/images/ppsn_2026_logo.webp");
  });

  it("returns null for a venue with no matching logo", () => {
    expect(
      getConferenceLogo(
        withYear("Some Unknown Workshop (XYZ)", "2030"),
        AVAILABLE_CONFERENCE_LOGOS,
      ),
    ).toBeNull();
  });
});
