import { describe, it, expect } from "vitest";
import precomputedColors from "./precomputed-colors.json";
import { AVAILABLE_CONFERENCE_LOGOS } from "./conference-logos";
import { workExperiences } from "@/data/sections/experience";
import { educationInfo } from "@/data/sections/education";
import { papersSection } from "@/data/sections/papers";

/**
 * Cards take their colour from their logo or image through this table
 * (useColorExtraction), and the table's default grey stops the lookup there.
 * scripts/extract-colors-simple.js named only the .png and .jpg files, while
 * the site loads the .webp, so from the first commit 22 logos and paper
 * images got the grey, and every Experience, Education and Other Work card
 * glowed grey instead of its brand colour.
 */
const DEFAULT_GREY = "rgb(107, 114, 128)";

describe("precomputed-colors.json", () => {
  it("gives every logo and paper image the site shows a colour of its own", () => {
    const images = [
      ...workExperiences.experience.map((role) => role.companyLogo),
      ...educationInfo.schools.map((school) => school.logo),
      ...papersSection.papersCards.map((paper) => paper.image),
      ...[...AVAILABLE_CONFERENCE_LOGOS].map((file) => `/images/${file}`),
    ];
    const table = precomputedColors as Record<string, string | undefined>;

    expect(
      images.filter((src) => {
        const color = table[src.split("?")[0]];
        return !color || color === DEFAULT_GREY;
      }),
    ).toEqual([]);
  });
});
