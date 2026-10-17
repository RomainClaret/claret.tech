import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * The hero's shooting stars: one at a time while the page is visible and
 * animations run, none while they are off, and none left over when the
 * quality setting changes.
 */

const state = vi.hoisted(() => ({
  playing: true,
  reduced: false,
  config: { animate: true, updateFrequency: 10 },
}));
vi.mock("@/lib/hooks/useVisibility", () => ({
  usePageVisibility: () => true,
}));
vi.mock("@/lib/hooks/useReducedMotion", () => ({
  useReducedMotion: () => state.reduced,
}));
vi.mock("@/contexts/animation-state-context", () => ({
  useAnimationState: () => ({ areAnimationsPlaying: state.playing }),
}));
vi.mock("@/contexts/quality-context", () => ({
  useQuality: () => ({ getConfig: () => state.config }),
  SHOOTING_STARS_PROFILE: {},
}));

import { ShootingStars } from "./shooting-stars";

const stars = (container: HTMLElement) =>
  container.querySelectorAll(".shooting-star").length;
const wrapper = (container: HTMLElement) =>
  container.firstElementChild as HTMLElement;
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  state.playing = true;
  state.reduced = false;
  state.config = { animate: true, updateFrequency: 10 };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ShootingStars", () => {
  it("sends a star after each delay, and takes each away once it has crossed", () => {
    // A star then lasts 2 s, and goes 0.1 s after that.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { container } = render(<ShootingStars minDelay={1} maxDelay={1} />);
    expect(stars(container)).toBe(0);
    expect(wrapper(container)).not.toHaveClass("opacity-0");

    advance(1000);
    expect(stars(container)).toBe(1);
    advance(2000);
    expect(stars(container)).toBe(3);
    advance(100);
    expect(stars(container)).toBe(2);
  });

  it("shows nothing while animations are off", () => {
    state.playing = false;
    const { container } = render(<ShootingStars minDelay={1} maxDelay={1} />);

    expect(wrapper(container)).toHaveClass("opacity-0");
    advance(5000);
    expect(stars(container)).toBe(0);
  });

  it("drops its stars when the quality setting changes", () => {
    const { container, rerender } = render(
      <ShootingStars minDelay={1} maxDelay={1} />,
    );
    advance(1000);
    expect(stars(container)).toBe(1);

    state.config = { animate: true, updateFrequency: 5 };
    rerender(<ShootingStars minDelay={1} maxDelay={1} />);

    expect(stars(container)).toBe(0);
  });
});
