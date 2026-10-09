import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import React from "react";

/**
 * A hovered interest's label bobs inside a background box. The label moved
 * to the animation gate (on screen, page not covered, not at the battery
 * tier); the box stayed on the old condition, so where the gate is closed
 * it kept a framer loop running every frame and drifted off the text.
 */

// framer's m.* as the plain SVG element, recording what it was asked to do.
vi.mock("framer-motion", async () => {
  const { createElement } = await import("react");
  const FRAMER_PROPS = new Set(["initial", "animate", "transition", "exit"]);
  const encode = (value: unknown) =>
    JSON.stringify(value ?? null, (_, v) => (v === Infinity ? "Infinity" : v));
  const m = new Proxy(
    {},
    {
      get:
        (_, tag: string) =>
        ({ children, ...props }: Record<string, unknown>) => {
          const dom: Record<string, unknown> = {
            "data-animate": encode(props.animate),
            "data-transition": encode(props.transition),
          };
          for (const [key, value] of Object.entries(props)) {
            if (!FRAMER_PROPS.has(key)) dom[key] = value;
          }
          return createElement(tag, dom, children as React.ReactNode);
        },
    },
  );
  return { m };
});
const gate = vi.hoisted(() => ({ active: true }));
vi.mock("@/lib/hooks/useMotionGate", () => ({
  useAnimationGate: () => ({
    ref: () => {},
    inView: true,
    active: gate.active,
  }),
}));
vi.mock("@/contexts/animation-state-context", () => ({
  useAnimationState: () => ({ areAnimationsPlaying: true }),
}));
vi.mock("@/components/icons", () => ({ getTechIcon: () => () => null }));

import { InterestConstellation } from "./interest-constellation";

const interests = [
  { interestName: "Artificial Life", fontAwesomeClassname: "fas fa-dna" },
  { interestName: "Neuroevolution", fontAwesomeClassname: "fas fa-brain" },
];

/** Hover the first interest; return how its label and box are animated. */
function hoverFirst() {
  const { container } = render(
    <InterestConstellation interests={interests} isVisible />,
  );
  fireEvent.mouseEnter(container.querySelector("g.cursor-pointer")!);
  const read = (el: Element | null) => ({
    y: JSON.parse(el!.getAttribute("data-animate")!).y,
    repeat: JSON.parse(el!.getAttribute("data-transition")!).y.repeat,
  });
  return {
    box: read(container.querySelector('rect[rx="6"]')),
    label: read(container.querySelector("text")),
  };
}

const OriginalResizeObserver = globalThis.ResizeObserver;

beforeEach(() => {
  gate.active = true;
  // The setup file's observer is a vi.fn that mockReset empties.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = OriginalResizeObserver;
});

describe("InterestConstellation hovered label", () => {
  it("rests the box with its label where the gate is closed", () => {
    gate.active = false; // battery tier, an overlay, or off screen

    const { box, label } = hoverFirst();

    expect(box).toEqual({ y: 0, repeat: 0 });
    expect(box).toEqual(label);
  });

  it("bobs the box with its label where the gate is open", () => {
    const { box, label } = hoverFirst();

    expect(box).toEqual({ y: [0, -2, 0], repeat: "Infinity" });
    expect(box).toEqual(label);
  });
});
