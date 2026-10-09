import { describe, it, expect, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { HighContrastToggle } from "./high-contrast-toggle";
import { blockStorage } from "@/test/blocked-storage";

/**
 * The toggle sits in the navigation on every page and read localStorage on
 * mount. Where the browser blocks storage that threw in an effect, which
 * takes the page down to the nearest error boundary.
 */

let unblock = () => {};

afterEach(() => {
  unblock();
  unblock = () => {};
  document.documentElement.classList.remove("high-contrast");
});

describe("HighContrastToggle", () => {
  it("works for the page view when the browser blocks storage", () => {
    unblock = blockStorage();

    render(<HighContrastToggle />);
    fireEvent.click(screen.getByRole("button"));

    expect(document.documentElement.classList).toContain("high-contrast");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});
