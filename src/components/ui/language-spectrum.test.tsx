import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

/**
 * The languages Romain speaks, each with how well: the proficiency showed on
 * mouse hover only, so keyboards, touch screens and screen readers never got
 * it.
 */

// framer's m.* as plain elements: one component per tag, so a re-render
// does not remount them.
vi.mock("framer-motion", async () => {
  const { createElement } = await import("react");
  const FRAMER = new Set(["initial", "animate", "exit", "transition"]);
  const components = new Map<string, React.FC<Record<string, unknown>>>();
  const m = new Proxy(
    {},
    {
      get: (_, tag: string) => {
        if (!components.has(tag)) {
          components.set(tag, ({ children, ...props }) =>
            createElement(
              tag,
              Object.fromEntries(
                Object.entries(props).filter(([key]) => !FRAMER.has(key)),
              ),
              children as React.ReactNode,
            ),
          );
        }
        return components.get(tag);
      },
    },
  );
  return { m };
});

import { LanguageSpectrum } from "./language-spectrum";

const languages = [
  { language: "French", flag: "FR", proficiency: "Native", level: 100 },
  { language: "English", flag: "EN", proficiency: "Academic", level: 90 },
];

describe("LanguageSpectrum", () => {
  it("shows a language's proficiency when the badge takes focus", () => {
    render(<LanguageSpectrum languages={languages} />);
    const french = screen.getByText("French").parentElement!;

    expect(french).toHaveAttribute("tabindex", "0");
    act(() => french.focus());
    expect(screen.getByText("(Native)")).not.toHaveClass("sr-only");

    act(() => french.blur());
    expect(screen.getByText("(Native)")).toHaveClass("sr-only");
  });

  it("gives every proficiency to a screen reader without pointing at it", () => {
    render(<LanguageSpectrum languages={languages} />);

    expect(screen.getByText("(Native)")).toHaveClass("sr-only");
    expect(screen.getByText("(Academic)")).toHaveClass("sr-only");
  });
});
