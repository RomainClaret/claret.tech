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
    ).toHaveClass("sr-only", "in-[.high-contrast]:hidden");
    expect(
      screen.getByText("Toggle high contrast mode (currently on)"),
    ).toHaveClass("sr-only", "hidden", "in-[.high-contrast]:inline");
    // Out of the name, still the button's description.
    expect(screen.getByText(/improves visibility/)).toHaveAttribute("hidden");
    expect(screen.getByRole("button")).toHaveAccessibleDescription(
      /improves visibility/,
    );
  });

  it("gives each copy its own description", () => {
    // The navigation renders one in the desktop bar and one in the phone
    // menu. A fixed id put two elements with the same id on every page.
    render(
      <>
        <HighContrastToggle />
        <HighContrastToggle />
      </>,
    );
    const ids = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-describedby"));

    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(document.getElementById(id ?? "")).toHaveTextContent(
        /improves visibility/,
      );
    }
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

describe("HighContrastToggle after React rendered the document again", () => {
  // A hydration mismatch anywhere makes React render the whole document
  // again, which resets <html> to the layout's attributes: the class the
  // head script had set was gone, and the toggle said off (production,
  // 2026-11-07). Each test starts without the class, as that left it.

  /** A fresh module: the visitor's choice in a page view is module state. */
  async function freshToggle() {
    vi.resetModules();
    return (await import("./high-contrast-toggle")).HighContrastToggle;
  }

  function systemAsksForMoreContrast() {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-contrast: more)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  it("puts the visitor's high contrast back", async () => {
    const storage = memoryStorage();
    storage.setItem("highContrast", "true");
    vi.stubGlobal("localStorage", storage);
    const Toggle = await freshToggle();

    render(<Toggle />);

    expect(document.documentElement.classList).toContain("high-contrast");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("puts the system's back", async () => {
    systemAsksForMoreContrast();
    vi.stubGlobal("localStorage", memoryStorage());
    const Toggle = await freshToggle();

    render(<Toggle />);

    expect(document.documentElement.classList).toContain("high-contrast");
  });

  it("leaves it off for a visitor who turned the system's off", async () => {
    systemAsksForMoreContrast();
    const storage = memoryStorage();
    storage.setItem("highContrast", "false");
    vi.stubGlobal("localStorage", storage);
    const Toggle = await freshToggle();

    render(<Toggle />);

    expect(document.documentElement.classList).not.toContain("high-contrast");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps a choice made in this page view on a copy mounted later", async () => {
    // With storage blocked the choice lives only in the class, and the
    // system's preference would turn it back on.
    unblock = blockStorage();
    systemAsksForMoreContrast();
    const Toggle = await freshToggle();
    render(<Toggle />);
    fireEvent.click(screen.getByRole("button")); // off, for this page view

    render(<Toggle />);

    expect(document.documentElement.classList).not.toContain("high-contrast");
  });

  it("puts it back after every rebuild, not only the first", async () => {
    // global-error's Try again remounts the layout, and React resets <html>
    // a second time: deciding once a page left the class off then.
    const storage = memoryStorage();
    storage.setItem("highContrast", "true");
    vi.stubGlobal("localStorage", storage);
    const Toggle = await freshToggle();
    const first = render(<Toggle />);
    expect(document.documentElement.classList).toContain("high-contrast");

    first.unmount();
    document.documentElement.classList.remove("high-contrast"); // the reset
    render(<Toggle />);

    expect(document.documentElement.classList).toContain("high-contrast");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});
