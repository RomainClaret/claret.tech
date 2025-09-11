// Common programming language colors in RGB format for consistent theming
// Colors are based on GitHub's language colors where available

import {
  FileCode2,
  FileCode,
  Bug,
  Coffee,
  Cog,
  Zap,
  Smartphone,
  Hexagon,
  Gem,
  Globe,
  Cpu,
  Terminal,
  Grid3x3,
  Rocket,
  Code,
  Palette,
  Component,
  BarChart,
  Sparkles,
  Activity,
  type LucideIcon,
} from "lucide-react";

export const languageColors: Record<string, string> = {
  // Primary languages
  TypeScript: "49, 120, 198", // #3178C6
  JavaScript: "241, 224, 90", // #F1E05A
  Python: "53, 114, 165", // #3572A5
  Java: "176, 114, 25", // #B07219
  Rust: "222, 165, 132", // #DEA584
  Go: "0, 173, 216", // #00ADD8
  Swift: "255, 172, 68", // #FFAC45
  Kotlin: "169, 123, 255", // #A97BFF
  Ruby: "112, 21, 22", // #701516
  PHP: "79, 93, 149", // #4F5D95
  "C++": "243, 75, 125", // #F34B7D
  C: "85, 85, 85", // #555555
  "C#": "23, 134, 0", // #178600
  Shell: "137, 224, 81", // #89E051
  Dart: "0, 180, 171", // #00B4AB

  // Web technologies
  HTML: "227, 76, 38", // #E34C26
  CSS: "86, 61, 124", // #563D7C
  SCSS: "207, 100, 154", // #CF649A
  Vue: "65, 184, 131", // #41B883

  // Data/ML languages
  R: "25, 129, 222", // #198CE7
  Julia: "153, 55, 168", // #9935A8
  MATLAB: "225, 103, 55", // #E16737

  // Other languages
  Lua: "0, 0, 128", // #000080
  Perl: "2, 152, 195", // #0298C3
  Scala: "194, 45, 64", // #C22D40
  Elixir: "110, 74, 126", // #6E4A7E
  Haskell: "94, 80, 134", // #5E5086
  Clojure: "219, 88, 85", // #DB5855
  Erlang: "184, 50, 138", // #B83998
  Nim: "255, 230, 109", // #FFE66D
  Crystal: "0, 6, 9", // #000609
  F: "184, 69, 252", // #B845FC
  OCaml: "236, 127, 51", // #EC7F33

  // Markup/Config
  JSON: "255, 255, 255", // #FFFFFF
  YAML: "203, 23, 30", // #CB171E
  XML: "1, 88, 178", // #0158B2
  Markdown: "8, 54, 114", // #083672

  // Default fallback
  Unknown: "139, 92, 246", // Purple (matches Research section default)
};

// Get RGB color string for a language
export function getLanguageColor(language: string | null | undefined): string {
  if (!language) return languageColors.Unknown;
  return languageColors[language] || languageColors.Unknown;
}

// Convert hex color to RGB string (utility function)
export function hexToRgb(hex: string): string {
  // Remove # if present
  hex = hex.replace("#", "");

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `${r}, ${g}, ${b}`;
}

// Get color from GitHub API response or fallback to predefined
export function getProjectColor(
  githubColor: string | null | undefined,
  languageName: string | null | undefined,
): string {
  // If GitHub provides a color, use it
  if (githubColor && githubColor.startsWith("#")) {
    return hexToRgb(githubColor);
  }

  // Otherwise, use our predefined colors
  return getLanguageColor(languageName);
}

// Project type icons mapping - returns actual Lucide icon component
export const languageIcons: Record<string, LucideIcon> = {
  TypeScript: FileCode2,
  JavaScript: FileCode,
  Python: Bug, // Python icon
  Java: Coffee,
  Rust: Cog,
  Go: Zap,
  Swift: Smartphone,
  Kotlin: Hexagon,
  Ruby: Gem,
  PHP: Globe,
  "C++": Cpu,
  C: Terminal,
  "C#": Grid3x3,
  Shell: Terminal,
  Dart: Rocket,
  HTML: Code,
  CSS: Palette,
  Vue: Component,
  R: BarChart,
  Julia: Sparkles,
  MATLAB: Activity,
  // Add more mappings
  Lua: Component,
  Perl: Terminal,
  Scala: FileCode2,
  Elixir: Zap,
  Haskell: FileCode,
  Clojure: Component,
  Erlang: Globe,
  Nim: Sparkles,
  Crystal: Gem,
  F: FileCode2,
  OCaml: FileCode,
  JSON: FileCode,
  YAML: FileCode2,
  XML: Code,
  Markdown: FileCode,
};

// Get icon for language with fallback
export function getLanguageIcon(
  language: string | null | undefined,
): LucideIcon {
  if (!language) return Code;
  return languageIcons[language] || Code;
}
