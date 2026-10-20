import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/hooks/useMotionGate", () => ({
  useAnimationGate: () => ({ ref: () => {}, inView: true, active: true }),
}));
vi.mock("@/contexts/animation-state-context", () => ({
  useAnimationState: () => ({ areAnimationsPlaying: true }),
}));

import { greeting } from "@/data/sections/greeting";
import { InterestConstellation } from "./interest-constellation";
import { ConstellationShell } from "./interest-constellation-shell";

/**
 * The hero shows the shell until the constellation's code arrives (after
 * hydration, on screens wide enough), and the page's HTML is the shell. It
 * has to be the component's own first render: otherwise hydration fails, or
 * the hero shifts when the code arrives.
 */
describe("The constellation's shell", () => {
  it("is the markup the component renders first", () => {
    expect(
      renderToStaticMarkup(
        <ConstellationShell className="pointer-events-auto" />,
      ),
    ).toBe(
      renderToStaticMarkup(
        <InterestConstellation
          interests={greeting.interests}
          className="pointer-events-auto"
          brainNodes={[]}
        />,
      ),
    );
  });
});
