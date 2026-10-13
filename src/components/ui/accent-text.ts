import type { CSSProperties } from "react";

/**
 * Text in a colour that comes from data (a paper's status, a project's
 * colour), made to read on both themes: pass the colour through this style
 * and add the `accent-text` class (globals.css), which darkens it on the
 * light theme and lightens it on the dark one. Used as they were, the
 * colours read at 1.5 to 4.3:1 on their own light tints.
 */
export function accentStyle(color: string): CSSProperties {
  return { "--accent": color } as CSSProperties;
}
