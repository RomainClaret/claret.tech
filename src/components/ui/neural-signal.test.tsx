import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

/**
 * At MAXIMUM each signal sends particles along its path with SMIL. A SMIL
 * begin offset counts from its SVG's own start, not from the moment the
 * element is inserted: signals join a grid whose SVG has been running for
 * seconds, so "0s" was long past and every particle sat frozen at the end
 * of its path instead of travelling.
 */

const quality = vi.hoisted(() => ({ animate: true }));
vi.mock("@/contexts/quality-context", () => ({
  NEURAL_SIGNAL_PROFILE: {},
  useQuality: () => ({
    getConfig: () => ({
      animate: quality.animate,
      particleCount: 3,
      strokeWidth: 6,
      opacity: 1,
      effects: ["glow"],
    }),
  }),
}));

import { NeuralSignal } from "./neural-signal";

const prototypes = {
  length: (SVGElement.prototype as unknown as Record<string, unknown>)
    .getTotalLength,
  time: (SVGSVGElement.prototype as unknown as Record<string, unknown>)
    .getCurrentTime,
};

beforeEach(() => {
  quality.animate = true;
  // jsdom has neither.
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    value: () => 100,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(SVGSVGElement.prototype, "getCurrentTime", {
    value: () => 42, // the grid's SVG has been running for 42 s
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  for (const [proto, key, value] of [
    [SVGElement.prototype, "getTotalLength", prototypes.length],
    [SVGSVGElement.prototype, "getCurrentTime", prototypes.time],
  ] as const) {
    if (value === undefined)
      delete (proto as unknown as Record<string, unknown>)[key];
    else
      Object.defineProperty(proto, key, {
        value,
        configurable: true,
        writable: true,
      });
  }
});

describe("NeuralSignal particles", () => {
  it("start on their SVG's clock when the signal appears", () => {
    const { container } = render(
      <svg>
        <NeuralSignal path="M0,0 L100,0" duration={1.5} />
      </svg>,
    );

    const motions = [...container.querySelectorAll("animateMotion")].map(
      (motion) => motion.getAttribute("begin"),
    );
    expect(motions).toEqual(["42s", "42.05s", "42.1s"]);

    const fades = [
      ...container.querySelectorAll('animate[attributeName="opacity"]'),
    ].map((fade) => fade.getAttribute("begin"));
    expect(fades).toEqual(["42s", "42s", "42s"]);
  });

  it("travel once animations come on, though they were off when it appeared", () => {
    quality.animate = false;
    const { container, rerender } = render(
      <svg>
        <NeuralSignal path="M0,0 L100,0" duration={1.5} />
      </svg>,
    );
    expect(container.querySelectorAll("animateMotion")).toHaveLength(0);

    quality.animate = true;
    rerender(
      <svg>
        <NeuralSignal path="M0,0 L100,0" duration={1.5} />
      </svg>,
    );

    expect(container.querySelectorAll("animateMotion")).toHaveLength(3);
  });
});
