import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";

const scroll = vi.hoisted(() => ({
  state: {
    isAtTop: true,
    currentIndex: 0,
    sections: ["home", "about", "work"],
    isInitialized: true,
  },
}));
vi.mock("@/lib/hooks/useScrollSection", () => ({
  useScrollSection: () => ({
    ...scroll.state,
    scrollToTop: () => {},
    scrollToPrevious: () => {},
    scrollToNext: () => {},
    scrollToLatest: () => {},
  }),
}));

import { FloatingNav } from "./floating-nav";

// The buttons appear half a second after mount.
function renderShown() {
  render(<FloatingNav />);
  act(() => {
    vi.advanceTimersByTime(500);
  });
}

describe("FloatingNav", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scroll.state.isAtTop = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays out of phones, upright and turned", () => {
    // Below 640 px wide, or 500 px tall (a phone turned), its column fixed
    // at the right covered the hero's View Resume and a strip of content.
    // mobile-navigation.spec.ts holds it in the browsers.
    renderShown();

    const rail = screen
      .getByRole("button", { name: "Scroll to next section" })
      .closest(".fixed");
    expect(rail).toHaveClass(
      "hidden",
      "[@media(min-width:640px)_and_(min-height:501px)]:flex",
    );
    expect(rail).not.toHaveClass("flex");
  });

  it("keeps the Home button out of the Tab order while it is invisible", () => {
    renderShown();

    // It was focusable at the top of the page, where it is transparent.
    expect(
      screen.getByRole("button", { name: "Home, scroll to top" }),
    ).toBeDisabled();
  });

  it("names Home by the label it shows, enabled once the page has scrolled", () => {
    scroll.state.isAtTop = false;
    renderShown();

    // Named "Scroll to top", it did not hold its label, "Home".
    expect(
      screen.getByRole("button", { name: "Home, scroll to top" }),
    ).toBeEnabled();
  });

  it("shows each button's label on keyboard focus, as on hover", () => {
    scroll.state.isAtTop = false;
    renderShown();

    // jsdom applies no :focus-visible styles; the classes are the contract,
    // and tests/e2e/keyboard-paths.spec.ts checks a real browser.
    for (const [name, label] of [
      ["Home, scroll to top", "Home"],
      ["Scroll to previous section", "Previous"],
      ["Scroll to next section", "Next"],
      ["Scroll to latest section", "Latest"],
    ]) {
      const button = screen.getByRole("button", { name });
      expect(within(button).getByText(label)).toHaveClass(
        "group-hover:opacity-100",
        "group-focus-visible:opacity-100",
      );
    }
  });
});
