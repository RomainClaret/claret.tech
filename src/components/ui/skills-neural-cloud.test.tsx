import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import React from "react";

/**
 * The skills cloud spikes its concepts on a timer. Two ways it went wrong: a
 * node settling did not wake the scheduler, so its next spike waited for
 * whatever timer was already set, and a node caught mid-spike when the
 * scheduler paused stayed spiking for good.
 */

const gate = vi.hoisted(() => ({ active: true }));
vi.mock("@/lib/hooks/useMotionGate", () => ({
  useAnimationGate: () => ({
    ref: () => {},
    inView: true,
    active: gate.active,
  }),
}));
// Stable across renders, as the real context's state is.
const background = vi.hoisted(() => ({
  backgroundData: {
    nodes: [],
    curves: [],
    lines: [],
    connections: [],
    neuralPatterns: [
      {
        nodes: [
          { gridX: 2, gridY: 2 },
          { gridX: 5, gridY: 4 },
        ],
      },
    ],
  },
}));
vi.mock("@/contexts/background-context", () => ({
  useBackground: () => background,
}));
vi.mock("@/contexts/animation-state-context", () => ({
  useAnimationState: () => ({ areAnimationsPlaying: true }),
}));
vi.mock("@/lib/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));
const qualityConfig = { animate: true };
vi.mock("@/contexts/quality-context", () => ({
  useQuality: () => ({ getConfig: () => qualityConfig }),
  NEURAL_CANVAS_PROFILE: {},
}));
// Spike intervals taken from a queue (then one second), so the schedule is
// deterministic.
const intervals = vi.hoisted(() => ({ queue: [] as number[] }));
vi.mock("@/lib/utils/neural-animations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/neural-animations")>()),
  getRandomInterval: () => intervals.queue.shift() ?? 1000,
}));

import { SkillsNeuralCloud } from "./skills-neural-cloud";

// Two nodes take one icon and one text (the cloud fills two thirds icons).
const concepts = {
  iconConcepts: [{ id: "brain", icon: "Brain", category: "research" }],
  textConcepts: [{ text: "Neuroevolution", category: "research" }],
};

/** Spiking badges carry the glow filter. */
const spiking = (container: HTMLElement) =>
  container.querySelectorAll('[filter="url(#conceptGlow)"]').length;

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  gate.active = true;
  intervals.queue = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SkillsNeuralCloud spikes", () => {
  it("spikes a node again on time, not at the next unrelated wake-up", () => {
    // One node is due at 1 s, the other at 5 s. When the first settles at
    // 1.3 s its next spike is due at 2.3 s, but the scheduler had already
    // set its timer for 5 s: the settle has to wake it, or that spike waits
    // for the other node.
    intervals.queue = [1000, 5000];
    const { container } = render(<SkillsNeuralCloud concepts={concepts} />);

    advance(1100);
    expect(spiking(container)).toBe(1);
    advance(300); // settles at 1.3 s, next due at 2.3 s
    expect(spiking(container)).toBe(0);

    advance(1100); // 2.4 s
    expect(spiking(container)).toBe(1);
  });

  it("settles a node caught mid-spike when the scheduler pauses", () => {
    const { container, rerender } = render(
      <SkillsNeuralCloud concepts={concepts} />,
    );
    advance(1100); // both nodes due at 1 s
    expect(spiking(container)).toBe(2);

    gate.active = false; // scrolled away, or an overlay opened
    rerender(<SkillsNeuralCloud concepts={concepts} />);

    expect(spiking(container)).toBe(0);
  });

  it("does not spike every overdue node at once when it resumes", () => {
    // Due at 3 s and 6 s, both come due while the cloud is scrolled away
    // for 30 s. Fresh waits (1.5 s and 4 s) keep them apart once it is
    // back; before, both spiked in the same tick.
    intervals.queue = [3000, 6000];
    const { container, rerender } = render(
      <SkillsNeuralCloud concepts={concepts} />,
    );
    advance(500);
    gate.active = false;
    rerender(<SkillsNeuralCloud concepts={concepts} />);
    advance(30_000);

    intervals.queue = [1500, 4000];
    gate.active = true;
    rerender(<SkillsNeuralCloud concepts={concepts} />);

    advance(50);
    expect(spiking(container)).toBe(0);
    advance(1500);
    expect(spiking(container)).toBe(1);
  });

  it("sets no timer while it has no nodes", () => {
    render(
      <SkillsNeuralCloud concepts={{ iconConcepts: [], textConcepts: [] }} />,
    );

    expect(vi.getTimerCount()).toBe(0);
  });

  it("spikes nodes it remade when they are due, not on the old timer", () => {
    // New concepts remake the nodes. The scheduler kept its timer for the
    // old ones (due at 10 s), so the new ones waited for it.
    intervals.queue = [10_000, 10_000];
    const { container, rerender } = render(
      <SkillsNeuralCloud concepts={concepts} />,
    );
    advance(1000); // past the first poll: a timer is set for 10 s

    intervals.queue = [1000, 2500];
    rerender(<SkillsNeuralCloud concepts={{ ...concepts }} />);
    advance(1100);

    expect(spiking(container)).toBe(1);
  });
});
