import { describe, it, expect, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { HighContrastToggle } from "./high-contrast-toggle";
import { blockStorage } from "@/test/blocked-storage";
import { memoryStorage } from "@/test/memory-storage";

/**
 * The toggle sits in the navigation on every page and read localStorage on
 * mount. Where the browser blocks storage that threw in an effect, which
 * takes the page down to the nearest error boundary.
 */

let unblock = () => {};

afterEach(() => {
  unblock();
  unblock = () => {};
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("high-contrast");
});

/**
 * A visitor who never used the toggle, on a system that asks for more
 * contrast: the head script (lib/boot/head-boot.ts) has already put
 * high-contrast on <html> before the first paint.
 */
function systemAskedForMoreContrast(): Storage {
  const storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-contrast: more)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  document.documentElement.classList.add("high-contrast");
  return storage;
}

describe("HighContrastToggle", () => {
  it("names its state by CSS, from the class on <html>", () => {
    // The name said "currently off" until hydration, whatever the class.
    // jsdom applies no stylesheet: this checks the classes, and
    // static-shell.spec.ts the name a browser computes before the bundle.
    render(<HighContrastToggle />);

    expect(screen.getByRole("button")).not.toHaveAttribute("aria-label");
    expect(
      screen.getByText("Toggle high contrast mode (currently off)"),
    ).toHaveClass("sr-only", "[.high-contrast_&]:hidden");
    expect(
      screen.getByText("Toggle high contrast mode (currently on)"),
    ).toHaveClass("sr-only", "hidden", "[.high-contrast_&]:inline");
    // Out of the name, still the button's description.
    expect(screen.getByText(/improves visibility/)).toHaveAttribute("hidden");
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-describedby",
      "high-contrast-desc",
    );
  });

  it("works for the page view when the browser blocks storage", () => {
    unblock = blockStorage();

    render(<HighContrastToggle />);
    fireEvent.click(screen.getByRole("button"));

    expect(document.documentElement.classList).toContain("high-contrast");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows as on when the system asked for more contrast", () => {
    systemAskedForMoreContrast();

    render(<HighContrastToggle />);

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList).toContain("high-contrast");
  });

  it("turns the system's high contrast off, and remembers that choice", () => {
    const storage = systemAskedForMoreContrast();

    render(<HighContrastToggle />);
    fireEvent.click(screen.getByRole("button"));

    expect(document.documentElement.classList).not.toContain("high-contrast");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    expect(storage.getItem("highContrast")).toBe("false");
  });
});
