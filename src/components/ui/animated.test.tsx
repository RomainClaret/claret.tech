import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";

// In view, with motion allowed: every wrapper adds its classes.
vi.mock("@/lib/hooks/useInViewAnimation", () => ({
  useInViewAnimation: () => ({ ref: { current: null }, isInView: true }),
}));
vi.mock("@/lib/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));
vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: () => false,
}));

import * as entrances from "./animated";

/**
 * Tailwind keeps a class only when it sees it written out in a source file.
 * The entrance wrappers built theirs at runtime (`animate-${name}`,
 * `animation-delay-${ms}`), so the build shipped only those some other file
 * happened to spell out: a delay did nothing except at 200 ms, and the
 * slides in from the left and right never moved.
 */
const source = readFileSync(
  join(process.cwd(), "src/components/ui/animated.tsx"),
  "utf8",
);

describe("entrance wrappers", () => {
  const wrappers = Object.entries(entrances) as [
    string,
    ComponentType<{ children: ReactNode }>,
  ][];

  it.each(wrappers)(
    "%s adds only classes written out in its file",
    (_, Wrapper) => {
      const { container } = render(<Wrapper>content</Wrapper>);
      const classes = (container.firstElementChild as HTMLElement).className
        .split(/\s+/)
        .filter(Boolean);

      expect(classes.length).toBeGreaterThan(0);
      for (const name of classes) expect(source).toContain(`"${name}"`);
    },
  );
});
