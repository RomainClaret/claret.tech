import {
  Brain,
  Bug,
  Code2,
  Dna,
  Infinity as InfinityIcon,
  Leaf,
  LucideIcon,
  Network,
  Puzzle,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Zap,
} from "lucide-react";

// The Font Awesome names the site gives, as Lucide icons: the interests'
// (src/data/sections/greeting.ts) and the skills' technologies'
// (src/data/sections/skills.ts). Only these: each icon imported here is in
// the page's JavaScript.
export const techIconMap: Record<string, LucideIcon> = {
  // Skills' technologies
  "fas fa-dna": Dna,
  "fas fa-bolt": Zap,
  "fas fa-sliders": SlidersHorizontal,
  "fas fa-network-wired": Network,
  "fas fa-puzzle-piece": Puzzle,
  "fas fa-seedling": Sprout,

  // Interests
  "fas fa-brain": Brain,
  "fas fa-sparkles": Sparkles,
  "fas fa-infinity": InfinityIcon,
  "fas fa-leaf": Leaf,
  "fas fa-space-shuttle": Rocket,
  "fas fa-bacterium": Bug, // Using bug as closest alternative

  // The fallback
  "fas fa-code": Code2,
};

// Get icon component by Font Awesome class name, with fallback
export function getTechIcon(fontAwesomeClass: string): LucideIcon {
  return techIconMap[fontAwesomeClass] || Code2;
}
