import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: () => false,
}));

import { SocialLinks } from "./SocialLinks";

/**
 * Each icon glows in its brand colour on hover: the colour plus "30", an
 * eight-digit hex with its alpha. GitHub's colour was the short "#333",
 * which made "#33330", not a colour, so its glow alone never showed.
 */
describe("SocialLinks", () => {
  it("gives every icon a glow in its colour", () => {
    render(<SocialLinks />);
    const links = screen.getAllByRole("link");

    expect(links.length).toBeGreaterThan(0);
    const withoutGlow = links
      .filter(
        (link) =>
          link.querySelector<HTMLElement>(".blur-xl")?.style.backgroundColor ===
          "",
      )
      .map((link) => link.getAttribute("aria-label"));
    expect(withoutGlow).toEqual([]);
  });
});
