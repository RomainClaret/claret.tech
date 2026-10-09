import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";

/**
 * Every 8 seconds the hero's brains pulse: for two seconds framer animates
 * the scale around both canvases. That kept running under the splash and
 * the modals, which cover the page.
 */

// The canvases themselves are not under test: stand-ins showing the pulse.
vi.mock("next/dynamic", () => ({
  default: () =>
    function Brain({ isPulsing }: { isPulsing?: boolean }) {
      return <div data-testid="brain" data-pulsing={String(!!isPulsing)} />;
    },
}));
vi.mock("framer-motion", () => ({
  m: {
    div: ({
      children,
      className,
    }: {
      children?: React.ReactNode;
      className?: string;
    }) => <div className={className}>{children}</div>,
  },
}));
vi.mock("@/lib/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));
vi.mock("@/contexts/animation-state-context", () => ({
  useAnimationState: () => ({ areAnimationsPlaying: true }),
}));
const qualityConfig = { animate: true };
vi.mock("@/contexts/quality-context", () => ({
  useQuality: () => ({ getConfig: () => qualityConfig }),
  NEURAL_CANVAS_PROFILE: {},
}));

import { DualBrainAnimation } from "./dual-brain-animation";
import {
  acquireOverlay,
  resetMotionGateForTests,
} from "@/lib/utils/motion-gate";

const pulsing = () =>
  screen
    .getAllByTestId("brain")
    .every((brain) => brain.dataset.pulsing === "true");

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetMotionGateForTests();
});

describe("DualBrainAnimation pulse", () => {
  it("pulses for two seconds every eight while the page runs", () => {
    render(<DualBrainAnimation />);
    expect(pulsing()).toBe(true);

    advance(2000);
    expect(pulsing()).toBe(false);

    advance(6500); // past the next pulse, at 8 s
    expect(pulsing()).toBe(true);
  });

  it("does not pulse under the splash or a modal", () => {
    render(<DualBrainAnimation />);
    advance(2000); // the first pulse ends

    let release = () => {};
    act(() => {
      release = acquireOverlay();
    });
    advance(6500); // past where the next pulse was due
    expect(pulsing()).toBe(false);

    // The page shows again: the rhythm picks up, with no pulse straight
    // away (it never paused for a modal before, so it never pulsed on one
    // closing), and the next comes a cycle later.
    act(() => release());
    expect(pulsing()).toBe(false);
    advance(8000);
    expect(pulsing()).toBe(true);
  });

  it("pulses as it first shows, when the splash lifts", () => {
    let release = () => {};
    act(() => {
      release = acquireOverlay(); // the splash
    });
    render(<DualBrainAnimation />);
    expect(pulsing()).toBe(false);

    act(() => release());

    expect(pulsing()).toBe(true);
  });

  it("does not let an earlier pulse's end cut a newer pulse short", () => {
    // Scrolled away 1 s into a pulse and back at 1.5 s: the new pulse runs
    // to 3.5 s. The first one's timer, due at 2 s, used to end it there.
    const view = render(<DualBrainAnimation isVisible />);
    advance(1000);
    view.rerender(<DualBrainAnimation isVisible={false} />);
    expect(pulsing()).toBe(false); // settled, not frozen mid-pulse
    advance(500);
    view.rerender(<DualBrainAnimation isVisible />);

    advance(1000); // 2.5 s
    expect(pulsing()).toBe(true);
    advance(1100); // 3.6 s
    expect(pulsing()).toBe(false);
  });
});
