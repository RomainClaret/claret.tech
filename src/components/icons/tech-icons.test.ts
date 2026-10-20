import { describe, it, expect } from "vitest";
import {
  Brain,
  Bug,
  Code2,
  Dna,
  Infinity as InfinityIcon,
  Leaf,
  Network,
  Puzzle,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Zap,
} from "lucide-react";
import { greeting } from "@/data/sections/greeting";
import { skillsSection } from "@/data/sections/skills";
import { getTechIcon, techIconMap } from "./tech-icons";

/**
 * The Font Awesome names the site gives, as Lucide icons: the interests'
 * classes, and the skills' technologies' icons. The map held 57
 * names, 36 of which nothing could reach, and each icon it imported was in
 * the page's JavaScript whether drawn or not.
 */
describe("the tech icons", () => {
  it("maps the names the site gives, each as before, and no other", () => {
    expect(techIconMap).toEqual({
      "fas fa-dna": Dna,
      "fas fa-bolt": Zap,
      "fas fa-sliders": SlidersHorizontal,
      "fas fa-network-wired": Network,
      "fas fa-puzzle-piece": Puzzle,
      "fas fa-seedling": Sprout,
      "fas fa-brain": Brain,
      "fas fa-sparkles": Sparkles,
      "fas fa-infinity": InfinityIcon,
      "fas fa-leaf": Leaf,
      "fas fa-space-shuttle": Rocket,
      // No bacterium icon: the bug is the closest.
      "fas fa-bacterium": Bug,
      "fas fa-code": Code2,
    });
  });

  it("has an icon for each interest", () => {
    for (const { fontAwesomeClassname } of greeting.interests) {
      expect(
        techIconMap[fontAwesomeClassname],
        fontAwesomeClassname,
      ).toBeDefined();
    }
  });

  it("has an icon for each of the skills' technologies", () => {
    // Skills.tsx kept its own map from names to icons, which matched none
    // of the technologies after their renaming: all six drew the fallback.
    // Each technology now names its icon beside it.
    const technologies = skillsSection.coreActivities.flatMap(
      (activity) => activity.technologies,
    );
    expect(technologies).toHaveLength(6);
    for (const { name, icon } of technologies) {
      expect(techIconMap[icon], name).toBeDefined();
    }
    expect(new Set(technologies.map(({ icon }) => icon)).size).toBe(6);
  });

  it("draws anything else as code", () => {
    expect(getTechIcon("fas fa-unknown")).toBe(Code2);
  });
});
