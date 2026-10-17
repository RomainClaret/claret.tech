import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import React from "react";

/**
 * The hero phrase types, holds, deletes and moves on at the cadence of the
 * typewriter-effect library it replaced, with the whole phrase laid out from
 * the first keystroke so a half-typed word never changes line.
 */

const gate = vi.hoisted(() => ({ active: true }));
vi.mock("@/lib/hooks/useMotionGate", () => ({
  useAnimationGate: () => ({
    ref: () => {},
    inView: true,
    active: gate.active,
  }),
}));
vi.mock("@/lib/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));
vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: () => false,
}));
const animation = vi.hoisted(() => ({ playing: true }));
vi.mock("@/contexts/animation-state-context", () => ({
  useAnimationState: () => ({ areAnimationsPlaying: animation.playing }),
}));
vi.mock("@/contexts/quality-context", () => ({
  useQuality: () => ({ getConfig: () => ({ animate: true }) }),
  TYPEWRITER_PROFILE: {},
}));

import { TypeWriter, TYPE_MS, DELETE_MS, HOLD_MS, NEXT_MS } from "./TypeWriter";

const PHRASES = ["ab", "xyz"];

/** What a reader sees: the typed text, then the laid-out remainder. */
function shown(container: HTMLElement) {
  const root = container.querySelector(".Typewriter") as HTMLElement;
  const [typed, , rest] = Array.from(root.children) as HTMLElement[];
  return { typed: typed.textContent, rest: rest.textContent, root };
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  gate.active = true;
  animation.playing = true;
});

afterEach(() => {
  vi.useRealTimers();
});

/** Mount and let the 50 ms start-up delay pass, as on the page. */
function mount() {
  const view = render(<TypeWriter strings={PHRASES} className="text-blue" />);
  advance(50);
  return view;
}

describe("TypeWriter", () => {
  it("lays the whole phrase out before typing it", () => {
    const { container } = mount();

    expect(shown(container)).toMatchObject({ typed: "", rest: "ab" });
    const rest = shown(container).root.lastElementChild as HTMLElement;
    // Hidden rather than transparent: transparent text is still painted, and
    // its moving start counted as a layout shift on every keystroke.
    expect(rest.style.visibility).toBe("hidden");
    expect(rest).toHaveAttribute("aria-hidden", "true");
  });

  it("types, holds, deletes and moves on at the library's cadence", () => {
    const { container } = mount();

    advance(TYPE_MS);
    expect(shown(container)).toMatchObject({ typed: "a", rest: "b" });
    advance(TYPE_MS);
    expect(shown(container)).toMatchObject({ typed: "ab", rest: "" });

    advance(HOLD_MS - 1);
    expect(shown(container).typed).toBe("ab");
    advance(1);
    expect(shown(container).typed).toBe("a");
    advance(DELETE_MS);
    expect(shown(container).typed).toBe("");

    advance(NEXT_MS);
    expect(shown(container)).toMatchObject({ typed: "x", rest: "yz" });
  });

  it("draws a new cursor per keystroke, so it never counts as a shift", () => {
    const { container } = mount();
    const cursor = () => shown(container).root.children[1].firstElementChild;
    const before = cursor();

    advance(TYPE_MS);

    expect(cursor()).not.toBe(before);
    expect((cursor() as HTMLElement).style.animationDelay).toMatch(/^-?\d/);
  });

  it("keeps a cursor's place in the blink when nothing was typed", () => {
    // A render without a keystroke (a parent's) must not move the glyph's
    // pulse: it is the same glyph, already blinking.
    const clock = vi.spyOn(performance, "now").mockReturnValue(1300);
    const { container, rerender } = mount();
    const cursor = () =>
      shown(container).root.children[1].firstElementChild as HTMLElement;
    const delay = cursor().style.animationDelay;
    expect(delay).toBe("-1300ms");

    clock.mockReturnValue(1800);
    rerender(<TypeWriter strings={PHRASES} className="text-blue" />);

    expect(cursor().style.animationDelay).toBe(delay);
    clock.mockRestore();
  });

  it("keeps the cursor out of the line's layout", () => {
    // As inline text or an inline-block, the cursor would add a line break
    // opportunity in the middle of the word being typed.
    const { container } = mount();

    const anchor = shown(container).root.children[1] as HTMLElement;
    expect(anchor.tagName).toBe("SPAN");
    expect(anchor.className).toBe("relative");
    expect(anchor.firstElementChild).toHaveClass("absolute", "animate-pulse");
  });

  it("waits while the gate is closed and resumes where it stopped", () => {
    const { container, rerender } = mount();
    advance(TYPE_MS);
    expect(shown(container).typed).toBe("a");

    gate.active = false;
    rerender(<TypeWriter strings={PHRASES} className="text-blue" />);
    advance(10 * TYPE_MS);
    expect(shown(container).typed).toBe("a");

    gate.active = true;
    rerender(<TypeWriter strings={PHRASES} className="text-blue" />);
    advance(TYPE_MS);
    expect(shown(container).typed).toBe("ab");
  });

  it("starts over from the first phrase when animations come back on", () => {
    const { container, rerender } = mount();
    advance(TYPE_MS);
    expect(shown(container).typed).toBe("a");

    animation.playing = false;
    rerender(<TypeWriter strings={PHRASES} className="text-blue" />);
    expect(container.querySelector(".Typewriter")).toBeNull();

    animation.playing = true;
    rerender(<TypeWriter strings={PHRASES} className="text-blue" />);
    expect(shown(container)).toMatchObject({ typed: "", rest: "ab" });
    advance(TYPE_MS);
    expect(shown(container).typed).toBe("a");
  });

  it("starts the phrase over when paused, and types on once unpaused", () => {
    const { container, rerender } = mount();
    advance(TYPE_MS);
    expect(shown(container).typed).toBe("a");

    rerender(<TypeWriter strings={PHRASES} className="text-blue" isPaused />);
    expect(shown(container)).toMatchObject({ typed: "", rest: "ab" });
    advance(10 * TYPE_MS);
    expect(shown(container).typed).toBe("");

    rerender(<TypeWriter strings={PHRASES} className="text-blue" />);
    advance(TYPE_MS);
    expect(shown(container).typed).toBe("a");
  });
});
